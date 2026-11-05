import sqlite3

import pytest
from alembic.config import Config

from alembic import command
from camera_path.config import settings


def test_job_input_migration_preserves_legacy_jobs_and_result_links(tmp_path, monkeypatch):
    database = tmp_path / "jobs.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261104_0016")
    with sqlite3.connect(database) as connection:
        connection.execute("INSERT INTO jobs(id) VALUES ('pending')")
        connection.execute("INSERT INTO jobs(id,completed_at) VALUES ('done','2026-11-01')")
        connection.execute(
            "INSERT INTO library_assets(id,job_id,job_position,name,format,object_key,size_bytes,"
            "status,created_at) VALUES "
            "('asset','done',0,'Chair','ply','a.ply',8,'ready','2026-11-01')"
        )
    command.upgrade(config, "head")
    with sqlite3.connect(database) as connection:
        assert connection.execute(
            "SELECT id,type,input,status,created_at,completed_at FROM jobs ORDER BY id"
        ).fetchall() == [
            ("done", None, None, "succeeded", None, "2026-11-01"),
            ("pending", None, None, "draft", None, None),
        ]
        assert connection.execute("SELECT id,job_id FROM library_assets").fetchall() == [
            ("asset", "done")
        ]
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    command.downgrade(config, "20261104_0016")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT id,completed_at FROM jobs ORDER BY id").fetchall() == [
            ("done", "2026-11-01"),
            ("pending", None),
        ]
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    command.upgrade(config, "head")
    with sqlite3.connect(database) as connection:
        connection.execute(
            "INSERT INTO jobs(id,type,input,status) VALUES ('new','generation',"
            "'{\"prompt\":\"Chair\"}','draft')"
        )
    with pytest.raises(RuntimeError, match="Refusing lossy downgrade"):
        command.downgrade(config, "20261104_0016")
