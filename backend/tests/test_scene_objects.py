import math

import pytest
from test_job_completion import first_asset, message, process  # noqa: F401
from test_job_completion import setup as completion_setup  # noqa: F401

from camera_path.persistence.records import SceneObjectRecord


@pytest.fixture
async def scene(completion_setup):  # noqa: F811 - imported pytest fixture
    app, client, root = completion_setup
    payload = await message(app, root)
    await process(app, payload)
    asset = await first_asset(client, payload["job_id"])
    project = (await client.post("/api/v1/projects", json={"name": "Objects"})).json()["id"]
    return app, client, asset, f"/api/v1/projects/{project}/scene-objects"


async def mutate(client, url, method="POST", data=None, expected=201):
    project_url = "/api/v1/projects/" + url.split("/projects/")[1].split("/")[0]
    revision = (await client.get(project_url)).headers["etag"]
    response = await client.request(method, url, json=data, headers={"If-Match": revision})
    assert response.status_code == expected, response.text
    if expected >= 400:
        assert (await client.get(project_url)).headers["etag"] == revision
    return response


async def test_local_transforms_selected_file_and_persistence(scene):
    app, client, asset, url = scene
    parent = (
        await mutate(
            client,
            url,
            data={
                "library_asset_id": asset["id"],
                "library_asset_file_id": "ply",
                "position": [1, 2, 3],
                "quaternion": [0, 0, 2, 2],
                "scale": [2, 3, 4],
            },
        )
    ).json()
    assert parent["format"] == "ply" and parent["library_asset_file_id"] == "ply"
    assert (await client.get(parent["download_url"])).content.startswith(b"ply\n")
    assert parent["quaternion"] == pytest.approx([0, 0, math.sqrt(0.5), math.sqrt(0.5)])
    child = (
        await mutate(
            client,
            url,
            data={
                "library_asset_id": asset["id"],
                "parent_id": parent["id"],
                "position": [4, 5, 6],
            },
        )
    ).json()
    assert child["format"] == "sog" and child["library_asset_file_id"] == "sog"
    await mutate(client, f"{url}/{parent['id']}", "PATCH", {"position": [9, 8, 7]}, 200)
    await app.state.project_repository.close()
    loaded = (await client.get(url)).json()
    assert loaded[0]["position"] == [9, 8, 7] and loaded[1] == child
    async with app.state.project_repository.session_factory() as session:
        row = await session.get(SceneObjectRecord, parent["id"])
        assert (row.scale_x, row.scale_y, row.scale_z) == (2, 3, 4)
    await mutate(client, f"{url}/{child['id']}", "PATCH", {"parent_id": None, "sort_order": 0}, 200)
    detached = (await client.get(url)).json()[0]
    assert detached["parent_id"] is None and detached["position"] == [4, 5, 6]


@pytest.mark.parametrize(
    "patch",
    [
        {"quaternion": [0, 0, 0, 0]},
        {"quaternion": [0, 0, 1]},
        {"quaternion": [0, 0, 0, "NaN"]},
        {"position": ["Infinity", 0, 0]},
        {"scale": [1, 0, 1]},
        {"scale": [1, -1, 1]},
        {"scale": 1},
        {"position": None},
        {"visible": None},
        {},
        {"rotation_deg": [0, 0, 0]},
        {"translation": [0, 0, 0]},
    ],
)
async def test_invalid_updates_are_atomic(scene, patch):
    _, client, asset, url = scene
    obj = (await mutate(client, url, data={"library_asset_id": asset["id"]})).json()
    await mutate(client, f"{url}/{obj['id']}", "PATCH", patch, 422)
    assert (await client.get(url)).json() == [obj]


async def test_cycles_cross_project_parents_and_parent_deletion(scene):
    _, client, asset, url = scene
    parent = (await mutate(client, url, data={"library_asset_id": asset["id"]})).json()
    child = (
        await mutate(client, url, data={"library_asset_id": asset["id"], "parent_id": parent["id"]})
    ).json()
    leaf = (
        await mutate(client, url, data={"library_asset_id": asset["id"], "parent_id": child["id"]})
    ).json()
    await mutate(client, f"{url}/{parent['id']}", "PATCH", {"parent_id": leaf["id"]}, 422)
    await mutate(client, f"{url}/{parent['id']}", "PATCH", {"parent_id": parent["id"]}, 422)
    await mutate(client, f"{url}/{parent['id']}", "DELETE", expected=409)
    other = (await client.post("/api/v1/projects", json={"name": "Other"})).json()["id"]
    await mutate(
        client,
        f"/api/v1/projects/{other}/scene-objects",
        data={"library_asset_id": asset["id"], "parent_id": parent["id"]},
        expected=404,
    )
    await mutate(
        client,
        url,
        data={"library_asset_id": asset["id"], "library_asset_file_id": "missing"},
        expected=404,
    )
    await mutate(client, url.split("/scene-objects")[0] + "/reset", "POST", expected=200)
    assert (await client.get(url)).json() == []


async def test_asset_delete_keeps_unselected_children_and_rolls_back_bytes(scene):
    _, client, asset, url = scene
    upload = (
        await client.post("/api/v1/library/uploads", json={"name": "Child", "size_bytes": 4})
    ).json()
    await client.put(upload["upload_url"], content=b"ply\n")
    await client.post(f"/api/v1/library/{upload['id']}/complete")
    parent = (await mutate(client, url, data={"library_asset_id": asset["id"]})).json()
    await mutate(client, url, data={"library_asset_id": upload["id"], "parent_id": parent["id"]})
    before = await client.get(url)
    assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 409
    after = await client.get(url)
    assert after.json() == before.json() and after.headers["etag"] == before.headers["etag"]
    assert (await client.get(parent["download_url"])).status_code == 200
    result = await client.post(
        "/api/v1/library/bulk-delete", json={"asset_ids": [asset["id"], upload["id"]]}
    )
    assert result.status_code == 204, result.text
    assert (await client.get(url)).json() == []
