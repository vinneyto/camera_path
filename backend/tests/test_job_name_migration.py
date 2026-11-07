import json
import sqlite3

import pytest
from alembic.config import Config

from alembic import command
from camera_path.config import settings


def test_job_name_backfill_preserves_sources_outputs_and_unknown_legacy_jobs(tmp_path, monkeypatch):
    database = tmp_path / "names.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261106_0018")
    prompt = " \n" + "Wooden chair 🪑 " * 25 + "\t "
    with sqlite3.connect(database) as connection:
        for job_id, kind, parameters in [
            ("text", "generation", {"prompt": prompt}),
            ("image", "generation", {"image_asset_id": "original"}),
            ("deleted", "generation", {"image_asset_id": "missing"}),
            ("lost", "generation", {"image_asset_id": "missing-no-results"}),
            ("legacy", None, None),
            ("other", "future", {"prompt": "Not a generation job"}),
        ]:
            connection.execute(
                "INSERT INTO jobs(id,type,input) VALUES (?,?,?)",
                (job_id, kind, json.dumps(parameters) if parameters is not None else None),
            )
        for asset_id, name, job_id, position in [
            ("original", "My source image.png", None, None),
            ("result", "Deleted source.webp", "deleted", 0),
        ]:
            connection.execute(
                "INSERT INTO library_assets(id,name,format,object_key,size_bytes,status,"
                "created_at,job_id,job_position) VALUES (?,?, 'png', ?,1,'ready',"
                "'2026-11-07',?,?)",
                (asset_id, name, f"{asset_id}.png", job_id, position),
            )
    command.upgrade(config, "20261107_0019")
    with sqlite3.connect(database) as connection:
        assert dict(connection.execute("SELECT id,name FROM jobs")) == {
            "text": prompt.strip()[:200],
            "image": "My source image.png",
            "deleted": "Deleted source.webp",
            "lost": None,
            "legacy": None,
            "other": None,
        }
        assert json.loads(
            connection.execute("SELECT input FROM jobs WHERE id='text'").fetchone()[0]
        ) == {"prompt": prompt}
        assert connection.execute(
            "SELECT job_id FROM library_assets WHERE id='result'"
        ).fetchone() == ("deleted",)
        connection.execute("DELETE FROM library_assets WHERE id='original'")
        assert connection.execute("SELECT name FROM jobs WHERE id='image'").fetchone() == (
            "My source image.png",
        )
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    with pytest.raises(RuntimeError, match="Refusing lossy downgrade: preserve job names"):
        command.downgrade(config, "20261106_0018")
