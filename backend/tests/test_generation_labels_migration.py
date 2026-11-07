import json
import sqlite3

from alembic.config import Config

from alembic import command
from camera_path.config import settings


def test_generation_labels_migration_updates_old_defaults_and_preserves_custom_labels(
    tmp_path, monkeypatch
):
    database = tmp_path / "labels.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261107_0019")
    prompt = "A small wooden chair with curved legs"
    with sqlite3.connect(database) as connection:
        for job_id, parameters, name in [
            ("text", {"prompt": prompt}, prompt),
            ("text-custom", {"prompt": prompt}, "Hero chair"),
            ("image", {"image_asset_id": "source"}, "chair.v2.PNG"),
            ("image-custom", {"image_asset_id": "source"}, "Hero image job"),
            ("deleted", {"image_asset_id": "gone"}, "Deleted.webp"),
        ]:
            connection.execute(
                "INSERT INTO jobs(id,type,input,name) VALUES (?,'generation',?,?)",
                (job_id, json.dumps(parameters), name),
            )
        for asset_id, name, fmt, job_id, position in [
            ("source", "chair.v2.PNG", "png", None, None),
            ("text-model", prompt, "ply", "text", 0),
            ("text-custom-model", prompt, "sog", "text-custom", 0),
            ("image-model", "chair.v2.PNG", "ply", "image", 0),
            ("image-custom-model", "chair.v2.PNG", "sog", "image-custom", 0),
            ("curated-model", "Curated model", "ply", "image", 1),
            ("deleted-model", "Deleted.webp", "ply", "deleted", 0),
        ]:
            connection.execute(
                "INSERT INTO library_assets(id,name,format,object_key,size_bytes,status,"
                "created_at,job_id,job_position) VALUES (?,?,?,?,1,'ready','2026-11-07',?,?)",
                (asset_id, name, fmt, f"{asset_id}.{fmt}", job_id, position),
            )
    command.upgrade(config, "head")
    with sqlite3.connect(database) as connection:
        assert dict(connection.execute("SELECT id,name FROM jobs")) == {
            "text": "A_small_wooden_chair_with",
            "text-custom": "Hero chair",
            "image": "chair.v2",
            "image-custom": "Hero image job",
            "deleted": "Deleted",
        }
        assert dict(connection.execute("SELECT id,name FROM library_assets")) == {
            "source": "chair.v2.PNG",
            "text-model": "A_small_wooden_chair_with",
            "text-custom-model": "Hero chair",
            "image-model": "chair.v2",
            "image-custom-model": "chair.v2",
            "curated-model": "Curated model",
            "deleted-model": "Deleted",
        }
        assert connection.execute(
            "SELECT object_key FROM library_assets WHERE id='image-model'"
        ).fetchone() == ("image-model.ply",)
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
