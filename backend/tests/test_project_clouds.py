from pathlib import Path

from httpx import ASGITransport, AsyncClient

from camera_path.api import create_app
from camera_path.config import Settings


async def test_project_clouds_are_independent_and_persist(tmp_path: Path) -> None:
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'db.sqlite3'}",
        library_directory=tmp_path / "files",
    )
    app = create_app(settings)
    await app.state.project_repository.initialize()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            project = await client.post("/api/v1/projects", json={"name": "Scene"})
            project_id = project.json()["id"]
            assert project.headers["etag"] == '"0"'
            url = f"/api/v1/projects/{project_id}/clouds"
            assert (await client.get(url)).json() == []
            assert (await client.post(url, json={"library_asset_id": "missing"})).status_code == 428
            data = b"ply\nformat ascii 1.0\nend_header\n"
            upload = (
                await client.post(
                    "/api/v1/library/uploads", json={"name": "Cloud", "size_bytes": len(data)}
                )
            ).json()
            assert (
                await client.post(
                    url, json={"library_asset_id": upload["id"]}, headers={"If-Match": '"0"'}
                )
            ).status_code == 404
            assert (await client.put(upload["upload_url"], content=data)).status_code == 204
            assert (
                await client.post(f"/api/v1/library/{upload['id']}/complete")
            ).status_code == 200
            first = await client.post(
                url, json={"library_asset_id": upload["id"]}, headers={"If-Match": '"0"'}
            )
            assert first.status_code == 201
            assert first.headers["etag"] == '"1"'
            assert (
                await client.post(
                    url, json={"library_asset_id": upload["id"]}, headers={"If-Match": '"0"'}
                )
            ).status_code == 409
            second = await client.post(
                url, json={"library_asset_id": upload["id"]}, headers={"If-Match": '"1"'}
            )
            assert second.status_code == 201
            assert second.json()["id"] != first.json()["id"]
            changed = await client.patch(
                f"{url}/{second.json()['id']}",
                json={"position": 0, "visible": False},
                headers={"If-Match": '"2"'},
            )
            assert changed.status_code == 200
            assert changed.json()["visible"] is False
            listed = await client.get(url)
            assert listed.headers["etag"] == '"3"'
            assert [item["id"] for item in listed.json()] == [
                second.json()["id"],
                first.json()["id"],
            ]
            assert (await client.get(listed.json()[0]["download_url"])).content == data
            other = (await client.post("/api/v1/projects", json={"name": "Other"})).json()["id"]
            reused = await client.post(
                f"/api/v1/projects/{other}/clouds",
                json={"library_asset_id": upload["id"]},
                headers={"If-Match": '"0"'},
            )
            assert reused.status_code == 201
            assert reused.json()["id"] not in {first.json()["id"], second.json()["id"]}
    finally:
        await app.state.project_repository.close()

    reopened = create_app(settings)
    await reopened.state.project_repository.initialize()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=reopened), base_url="http://test"
        ) as client:
            assert len((await client.get(url)).json()) == 2
            removed = await client.delete(
                f"{url}/{second.json()['id']}", headers={"If-Match": '"3"'}
            )
            assert removed.status_code == 204
            assert [cloud["position"] for cloud in (await client.get(url)).json()] == [0]
            assert len((await client.get("/api/v1/library")).json()) == 1
            reset = await client.post(
                f"/api/v1/projects/{project_id}/reset", headers={"If-Match": '"4"'}
            )
            assert reset.status_code == 200
            assert (await client.get(url)).json() == []
            assert len((await client.get(f"/api/v1/projects/{other}/clouds")).json()) == 1
            assert len((await client.get("/api/v1/library")).json()) == 1
    finally:
        await reopened.state.project_repository.close()
