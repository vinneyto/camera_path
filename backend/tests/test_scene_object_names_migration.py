import sqlite3

import pytest
from alembic.config import Config

from alembic import command
from camera_path.config import settings


def test_scene_names_snapshot_legacy_labels_without_changing_identity_or_hierarchy(
    tmp_path, monkeypatch
):
    database = tmp_path / "names.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261107_0020")
    with sqlite3.connect(database) as connection:
        connection.execute("INSERT INTO projects VALUES ('p','Scene',7),('other','Other',3)")
        for asset_id, name in [("a", "Chair.png"), ("b", "Gaussians 09")]:
            connection.execute(
                "INSERT INTO library_assets"
                "(id,name,format,object_key,size_bytes,status,created_at) "
                "VALUES (?,?,'ply',?,4,'ready','2026-11-08')",
                (asset_id, name, asset_id + ".ply"),
            )
            connection.execute(
                "INSERT INTO library_asset_files"
                "(asset_id,id,position,is_primary,format,object_key,size_bytes) "
                "VALUES (?,'main',0,1,'ply',?,4)",
                (asset_id, asset_id + ".ply"),
            )
        for object_id, asset_id, parent_id, order in [
            ("parent", "a", None, 0),
            ("child", "a", "parent", 1),
            ("last", "b", None, 2),
        ]:
            connection.execute(
                "INSERT INTO scene_objects"
                "(id,project_id,library_asset_id,library_asset_file_id,"
                "parent_id,sort_order,visible,position_x,position_y,position_z,"
                "quaternion_x,quaternion_y,quaternion_z,quaternion_w,scale_x,scale_y,scale_z) "
                "VALUES (?,'p',?,'main',?,?,1,0,0,0,0,0,0,1,1,1,1)",
                (object_id, asset_id, parent_id, order),
            )
        before = connection.execute("SELECT * FROM scene_objects ORDER BY sort_order").fetchall()
    command.upgrade(config, "20261108_0021")
    with sqlite3.connect(database) as connection:
        rows = connection.execute("SELECT * FROM scene_objects ORDER BY sort_order").fetchall()
        assert [row[:-1] for row in rows] == before
        assert [row[-1] for row in rows] == ["Chair.png", "Chair.png", "Gaussians 09"]
        assert connection.execute(
            "SELECT id,revision,scene_object_sequence FROM projects ORDER BY id"
        ).fetchall() == [("other", 3, 0), ("p", 7, 9)]
        # Simulate an instance created while the draft used generic numbered names.
        connection.execute("UPDATE scene_objects SET name='Gaussians 01' WHERE id='parent'")
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with sqlite3.connect(database) as connection:
        assert connection.execute(
            "SELECT name FROM scene_objects ORDER BY sort_order"
        ).fetchall() == [("Chair.png 01",), ("Chair.png",), ("Gaussians 09",)]
        assert connection.execute(
            "SELECT scene_object_sequence FROM projects WHERE id='p'"
        ).fetchone() == (9,)
        connection.execute("UPDATE library_assets SET name='Changed'")
        assert connection.execute(
            "SELECT name FROM scene_objects ORDER BY sort_order"
        ).fetchall() == [("Chair.png 01",), ("Chair.png",), ("Gaussians 09",)]
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    with pytest.raises(RuntimeError, match="pre-migration backup"):
        command.downgrade(config, "20261107_0020")
