import sqlite3

from alembic.config import Config

from alembic import command
from camera_path.config import settings


def test_pipeline_migration_preserves_project_and_can_downgrade(tmp_path, monkeypatch):
    database = tmp_path / "pipelines.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261112_0024")
    with sqlite3.connect(database) as connection:
        connection.execute("INSERT INTO projects(id,name,revision) VALUES ('project','Existing',7)")
    command.upgrade(config, "head")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT name,revision FROM projects").fetchone() == (
            "Existing",
            7,
        )
        connection.execute(
            "INSERT INTO command_pipelines(id,project_id,message_id,request_key,definition,steps,"
            "context,status,created_at,updated_at,version,lease_until) VALUES "
            "('pipeline','project','message','key','{}','[]','{}','queued',"
            "'2026-11-12','2026-11-12',1,0)"
        )
        connection.execute(
            "INSERT INTO pipeline_events(project_id,pipeline_id,payload) "
            "VALUES ('project','pipeline','{}')"
        )
    command.downgrade(config, "20261112_0024")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT name,revision FROM projects").fetchone() == (
            "Existing",
            7,
        )
        assert not connection.execute(
            "SELECT name FROM sqlite_master WHERE name IN ('command_pipelines','pipeline_events')"
        ).fetchall()
