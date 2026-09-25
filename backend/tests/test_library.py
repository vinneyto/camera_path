from pathlib import Path

from httpx import ASGITransport, AsyncClient

from camera_path.api import create_app
from camera_path.config import Settings


async def test_library_upload_is_independent_of_projects_and_persists(tmp_path: Path) -> None:
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'test.sqlite3'}"
    settings = Settings(
        _env_file=None, database_url=database_url, library_directory=tmp_path / "files"
    )
    app = create_app(settings)
    await app.state.project_repository.initialize()
    contents = b"ply\nformat ascii 1.0\nend_header\n"
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/api/v1/library")).json() == []
            created = await client.post(
                "/api/v1/library/uploads",
                json={"name": "Test cloud", "format": "ply", "size_bytes": len(contents)},
            )
            assert created.status_code == 201
            asset = created.json()
            assert asset["status"] == "pending"
            assert (await client.get("/api/v1/library")).json() == []
            assert (await client.get(f"/api/v1/library/{asset['id']}")).status_code == 404
            assert (await client.post(f"/api/v1/library/{asset['id']}/complete")).status_code == 422
            uploaded = await client.put(asset["upload_url"], content=contents)
            assert uploaded.status_code == 204
            ready = await client.post(f"/api/v1/library/{asset['id']}/complete")
            assert ready.status_code == 200
            assert ready.json()["status"] == "ready"
            details = await client.get(f"/api/v1/library/{asset['id']}")
            assert details.status_code == 200
            assert details.json()["default_rotation_deg"] == [0, 0, 0]
            assert details.json()["default_scale"] == 1
            listed = (await client.get("/api/v1/library")).json()
            assert len(listed) == 1
            assert listed[0]["name"] == "Test cloud"
            assert (await client.get(listed[0]["download_url"])).content == contents
    finally:
        await app.state.project_repository.close()

    reopened = create_app(settings)
    await reopened.state.project_repository.initialize()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=reopened), base_url="http://test"
        ) as client:
            listed = (await client.get("/api/v1/library")).json()
            assert len(listed) == 1
            assert (await client.get(listed[0]["download_url"])).content == contents
    finally:
        await reopened.state.project_repository.close()


async def test_library_rejects_wrong_size_and_invalid_ply(tmp_path: Path) -> None:
    url = f"sqlite+aiosqlite:///{tmp_path / 'test.sqlite3'}"
    app = create_app(
        Settings(_env_file=None, database_url=url, library_directory=tmp_path / "files")
    )
    await app.state.project_repository.initialize()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = (
                await client.post(
                    "/api/v1/library/uploads", json={"name": "Invalid", "size_bytes": 4}
                )
            ).json()
            assert (await client.put(created["upload_url"], content=b"abcde")).status_code == 413
            assert (await client.put(created["upload_url"], content=b"abcd")).status_code == 204
            assert (
                await client.post(f"/api/v1/library/{created['id']}/complete")
            ).status_code == 422
            assert (await client.get("/api/v1/library")).json() == []
    finally:
        await app.state.project_repository.close()
