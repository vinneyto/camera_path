import asyncio
import sqlite3

import pytest
from alembic.config import Config

from alembic import command
from camera_path.api import create_app
from camera_path.config import settings


@pytest.fixture
def previous_database(tmp_path, monkeypatch):
    database = tmp_path / "camera_path.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261115_0026")
    return database, config


@pytest.mark.parametrize("partial", [False, True])
def test_upgrade_adopts_tables_created_by_backend(previous_database, partial):
    database, config = previous_database

    async def initialize():
        repository = create_app().state.project_repository
        try:
            await repository.initialize()
        finally:
            await repository.close()

    asyncio.run(initialize())
    with sqlite3.connect(database) as connection:
        connection.execute("INSERT INTO projects(id,name,revision) VALUES ('project','Existing',7)")
        connection.execute(
            "INSERT INTO cli_sessions(token_digest,worker_id,credential_version,expires_at) "
            "VALUES ('digest','worker','credentials',123)"
        )
        if partial:
            connection.execute("DROP TABLE cli_devices")
            connection.execute("DROP INDEX uq_inference_active_job")
            connection.execute("DROP TABLE inference_uploads")

    command.upgrade(config, "head")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchall() == [
            ("20261122_0028",)
        ]
        assert connection.execute("SELECT name,revision FROM projects").fetchall() == [
            ("Existing", 7)
        ]
        assert connection.execute("SELECT worker_id FROM cli_sessions").fetchall() == [("worker",)]
        schema = dict(
            connection.execute(
                "SELECT name, sql FROM sqlite_master "
                "WHERE name IN ('cli_devices','inference_uploads','uq_inference_active_job')"
            )
        )
        assert set(schema) == {"cli_devices", "inference_uploads", "uq_inference_active_job"}
        assert "WHERE state = 'active'" in schema["uq_inference_active_job"]


def test_upgrade_rejects_an_incompatible_existing_cli_table(previous_database):
    database, config = previous_database
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE cli_devices (id TEXT PRIMARY KEY)")
        connection.execute("INSERT INTO cli_devices(id) VALUES ('old')")
    with pytest.raises(RuntimeError, match="Existing table cli_devices is incompatible"):
        command.upgrade(config, "head")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
            "20261115_0026",
        )
        assert connection.execute("SELECT id FROM cli_devices").fetchall() == [("old",)]
