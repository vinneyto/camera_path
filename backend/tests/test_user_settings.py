import asyncio
import sqlite3

import pytest
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from alembic import command
from camera_path.api import create_app
from camera_path.config import Settings, settings
from camera_path.persistence.models import UserSettingsRecord
from camera_path.repositories import ProjectRepository
from camera_path.routers.profile import get_current_user_id

URL = "/api/v1/profile/settings"


async def test_settings_persist_across_apps_and_are_scoped_to_current_user(tmp_path) -> None:
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'profile.sqlite3'}"
    repo = ProjectRepository(database_url)
    await repo.initialize()
    alice_app = create_app(Settings(_env_file=None, dev_user_id="alice"), repo)
    bob_app = create_app(Settings(_env_file=None, dev_user_id="bob"), repo)
    try:
        async with (
            AsyncClient(transport=ASGITransport(app=alice_app), base_url="http://test") as alice,
            AsyncClient(transport=ASGITransport(app=bob_app), base_url="http://test") as bob,
        ):
            assert (await alice.get(URL)).json() == {
                "webgpu_tile_renderer": True,
                "show_grid": True,
            }
            assert (await alice.patch(URL, json={"webgpu_tile_renderer": False})).json() == {
                "webgpu_tile_renderer": False,
                "show_grid": True,
            }
            assert (await alice.patch(URL, json={"show_grid": False})).json() == {
                "webgpu_tile_renderer": False,
                "show_grid": False,
            }
            assert (await bob.get(URL)).json() == {"webgpu_tile_renderer": True, "show_grid": True}
            # Caller-supplied IDs cannot switch users. CP-49 can replace the dependency.
            assert (await bob.get(URL, headers={"X-User-ID": "alice"})).json()["show_grid"]
            bob_app.dependency_overrides[get_current_user_id] = lambda: "alice"
            assert (await bob.get(URL)).json()["show_grid"] is False
    finally:
        await repo.close()

    reopened = ProjectRepository(database_url)
    application = create_app(Settings(_env_file=None, dev_user_id="alice"), reopened)
    await reopened.initialize()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=application), base_url="http://test"
        ) as c:
            assert (await c.get(URL)).json() == {"webgpu_tile_renderer": False, "show_grid": False}
    finally:
        await reopened.close()


async def test_concurrent_partial_first_writes_preserve_both_fields(tmp_path) -> None:
    repo = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'concurrent.sqlite3'}")
    await repo.initialize()
    app = create_app(Settings(_env_file=None), repo)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            responses = await asyncio.gather(
                client.patch(URL, json={"webgpu_tile_renderer": False}),
                client.patch(URL, json={"show_grid": False}),
            )
            assert all(response.status_code == 200 for response in responses)
            assert (await client.get(URL)).json() == {
                "webgpu_tile_renderer": False,
                "show_grid": False,
            }
    finally:
        await repo.close()


@pytest.mark.parametrize(
    "payload",
    [
        {"show_grid": None},
        {"show_grid": "false"},
        {"user_id": "other"},
        {"webgpu_tile_renderer": 0},
    ],
)
async def test_settings_reject_invalid_fields(tmp_path, payload) -> None:
    repo = ProjectRepository(f"sqlite+aiosqlite:///{tmp_path / 'invalid.sqlite3'}")
    app = create_app(Settings(_env_file=None), repo)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.patch(URL, json=payload)
            assert response.status_code == 422
    finally:
        await repo.close()


def test_settings_migration_and_postgres_ddl(tmp_path, monkeypatch) -> None:
    path = tmp_path / "migration.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260925_0009")
    with sqlite3.connect(path) as connection:
        connection.execute("INSERT INTO projects (id, name, revision) VALUES ('p', 'Keep', 0)")
    command.upgrade(config, "head")
    with sqlite3.connect(path) as connection:
        connection.execute("INSERT INTO user_settings (user_id) VALUES ('u')")
        assert connection.execute(
            "SELECT webgpu_tile_renderer, show_grid FROM user_settings"
        ).fetchone() == (1, 1)
        assert connection.execute("SELECT name FROM projects").fetchone() == ("Keep",)
    ddl = str(CreateTable(UserSettingsRecord.__table__).compile(dialect=postgresql.dialect()))
    assert "BOOLEAN DEFAULT true NOT NULL" in ddl
    command.downgrade(config, "20260925_0009")
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT name FROM projects").fetchone() == ("Keep",)
