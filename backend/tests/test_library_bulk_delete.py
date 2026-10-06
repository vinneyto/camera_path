from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from conftest import create_editor_app as create_app
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from test_library_delete import upload

from camera_path.config import Settings


@pytest.mark.parametrize("failure", [None, "missing", "storage", "commit"])
async def test_bulk_delete_is_one_revision_and_restores_batch_on_failure(
    tmp_path: Path, monkeypatch, failure: str | None
) -> None:
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
            removed = [await upload(client, "First"), await upload(client, "Second")]
            kept = await upload(client, "Keep")
            project = (await client.post("/api/v1/projects", json={"name": "Scene"})).json()["id"]
            url = f"/api/v1/projects/{project}/clouds"
            for index, asset in enumerate([removed[0], kept, removed[1], removed[0], kept]):
                assert (
                    await client.post(
                        url,
                        json={"library_asset_id": asset["id"]},
                        headers={"If-Match": f'"{index}"'},
                    )
                ).status_code == 201
            before = await client.get(url)
            second_project = (
                await client.post("/api/v1/projects", json={"name": "Second scene"})
            ).json()["id"]
            second_url = f"/api/v1/projects/{second_project}/clouds"
            for index, asset in enumerate(removed):
                assert (
                    await client.post(
                        second_url,
                        json={"library_asset_id": asset["id"]},
                        headers={"If-Match": f'"{index}"'},
                    )
                ).status_code == 201
            ids = [asset["id"] for asset in removed]
            if failure is None:
                ids.append(ids[0])  # Duplicate IDs are harmless and still count once.
            if failure == "missing":
                ids.append("missing")
            if failure == "storage":
                original_replace = Path.replace
                # Fail on the second staging rename, after the first file was moved.
                failing_key = f"{sorted(ids)[1]}.ply"

                def failing_replace(path, target):
                    if path.name == failing_key and path.parent == tmp_path / "files":
                        raise OSError("Cannot stage second file")
                    return original_replace(path, target)

                monkeypatch.setattr(Path, "replace", failing_replace)
            if failure == "commit":
                monkeypatch.setattr(
                    AsyncSession, "commit", AsyncMock(side_effect=RuntimeError("SQL commit failed"))
                )
                with pytest.raises(RuntimeError, match="SQL commit failed"):
                    await client.post("/api/v1/library/bulk-delete", json={"asset_ids": ids})
            else:
                result = await client.post("/api/v1/library/bulk-delete", json={"asset_ids": ids})
                assert result.status_code == {None: 204, "missing": 404, "storage": 502}[failure]
            after = await client.get(url)
            second_after = await client.get(second_url)
            if failure:
                assert after.json() == before.json()
                assert after.headers["etag"] == '"5"'
                assert second_after.headers["etag"] == '"2"'
                assert len(second_after.json()) == 2
                for asset in removed:
                    assert (await client.get(asset["upload_url"])).status_code == 200
            else:
                assert after.headers["etag"] == '"6"'
                assert second_after.headers["etag"] == '"3"'
                assert second_after.json() == []
                assert [cloud["position"] for cloud in after.json()] == [0, 1]
                assert all(cloud["library_asset_id"] == kept["id"] for cloud in after.json())
                for asset in removed:
                    assert (await client.get(asset["upload_url"])).status_code == 404
            assert not list((tmp_path / "files").glob(".delete-*"))
            assert (await client.get(kept["upload_url"])).status_code == 200
            assert (
                await client.post("/api/v1/library/bulk-delete", json={"asset_ids": []})
            ).status_code == 422
    finally:
        await app.state.project_repository.close()
