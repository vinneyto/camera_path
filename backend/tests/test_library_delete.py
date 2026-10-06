from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from camera_path.api import create_app
from camera_path.config import Settings


async def upload(client: AsyncClient, name: str) -> dict:
    contents = b"ply\nformat ascii 1.0\nend_header\n"
    asset = (
        await client.post(
            "/api/v1/library/uploads", json={"name": name, "size_bytes": len(contents)}
        )
    ).json()
    assert (await client.put(asset["upload_url"], content=contents)).status_code == 204
    assert (await client.post(f"/api/v1/library/{asset['id']}/complete")).status_code == 200
    return asset


async def test_delete_removes_all_instances_and_preserves_other_project_data(
    tmp_path: Path,
) -> None:
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
        library_directory=tmp_path / "files",
    )
    app = create_app(settings)
    await app.state.project_repository.initialize()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            target = await upload(client, "Remove me")
            other = await upload(client, "Keep me")
            projects = [
                (await client.post("/api/v1/projects", json={"name": name})).json()["id"]
                for name in ["Multiple copies", "Only removed asset", "Unaffected"]
            ]
            combinations = [
                [target, other, target, other, target],
                [target],
                [other],
            ]
            for project_id, assets in zip(projects, combinations, strict=True):
                for index, asset in enumerate(assets):
                    added = await client.post(
                        f"/api/v1/projects/{project_id}/clouds",
                        json={"library_asset_id": asset["id"], "translation": [index, 0, 0]},
                        headers={"If-Match": f'"{index}"'},
                    )
                    assert added.status_code == 201
            first_url = f"/api/v1/projects/{projects[0]}"
            anchor = await client.post(
                f"{first_url}/anchors",
                json={"label": "Preserved", "surface_position": [0, 0, 0]},
                headers={"If-Match": '"5"'},
            )
            assert anchor.status_code == 201
            anchors_before = (await client.get(f"{first_url}/anchors")).json()
            removed = await client.delete(f"/api/v1/library/{target['id']}")
            assert removed.status_code == 204
            assert removed.content == b""
            assert (await client.get(f"/api/v1/library/{target['id']}")).status_code == 404
            assert (await client.get(target["upload_url"])).status_code == 404
            assert not (settings.library_directory / f"{target['id']}.ply").exists()
            assert (settings.library_directory / f"{other['id']}.ply").exists()
            assert [item["id"] for item in (await client.get("/api/v1/library")).json()] == [
                other["id"]
            ]
            for project_id, revision, translations in zip(
                projects, [7, 2, 1], [[1, 3], [], [0]], strict=True
            ):
                response = await client.get(f"/api/v1/projects/{project_id}/clouds")
                assert response.headers["etag"] == f'"{revision}"'
                assert [cloud["position"] for cloud in response.json()] == list(
                    range(len(translations))
                )
                assert [cloud["translation"][0] for cloud in response.json()] == translations
                assert all(cloud["library_asset_id"] == other["id"] for cloud in response.json())
                assert (await client.get(f"/api/v1/projects/{project_id}")).status_code == 200
            assert (await client.get(f"{first_url}/anchors")).json() == anchors_before
            assert (
                await client.post(
                    f"{first_url}/clouds",
                    json={"library_asset_id": other["id"]},
                    headers={"If-Match": '"6"'},
                )
            ).status_code == 409
            assert (
                await client.post(
                    f"{first_url}/clouds",
                    json={"library_asset_id": other["id"]},
                    headers={"If-Match": '"7"'},
                )
            ).json()["position"] == 2
            assert (await client.delete(f"/api/v1/library/{target['id']}")).status_code == 404
    finally:
        await app.state.project_repository.close()

    reopened = create_app(settings)
    await reopened.state.project_repository.initialize()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=reopened), base_url="http://test"
        ) as client:
            assert len((await client.get(f"{first_url}/clouds")).json()) == 3
            assert (await client.get(f"/api/v1/library/{target['id']}")).status_code == 404
    finally:
        await reopened.state.project_repository.close()


async def test_storage_failure_rolls_back_and_can_be_retried(tmp_path: Path, monkeypatch) -> None:
    app = create_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
            library_directory=tmp_path / "files",
        )
    )
    await app.state.project_repository.initialize()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            asset = await upload(client, "Retry me")
            project = (await client.post("/api/v1/projects", json={"name": "Scene"})).json()["id"]
            url = f"/api/v1/projects/{project}/clouds"
            assert (
                await client.post(
                    url, json={"library_asset_id": asset["id"]}, headers={"If-Match": '"0"'}
                )
            ).status_code == 201
            before = await client.get(url)
            storage = app.state.library_service.storage
            real_delete = storage.delete
            monkeypatch.setattr(storage, "delete", AsyncMock(side_effect=OSError("Unavailable")))
            assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 502
            after = await client.get(url)
            assert after.json() == before.json()
            assert after.headers["etag"] == before.headers["etag"]
            assert (await client.get(asset["upload_url"])).status_code == 200
            monkeypatch.setattr(storage, "delete", real_delete)
            assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 204
            assert (await client.get(url)).json() == []
    finally:
        await app.state.project_repository.close()


@pytest.mark.parametrize("ready", [False, True])
async def test_delete_unused_asset_with_missing_content(tmp_path: Path, ready: bool) -> None:
    app = create_app(
        Settings(
            _env_file=None,
            database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
            library_directory=tmp_path / "files",
        )
    )
    await app.state.project_repository.initialize()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            if ready:
                asset = await upload(client, "Missing content")
                (tmp_path / "files" / f"{asset['id']}.ply").unlink()
            else:
                asset = (
                    await client.post(
                        "/api/v1/library/uploads", json={"name": "Pending", "size_bytes": 4}
                    )
                ).json()
            assert (await client.delete(f"/api/v1/library/{asset['id']}")).status_code == 204
            assert (await client.get("/api/v1/library")).json() == []
    finally:
        await app.state.project_repository.close()
