import math
import sqlite3

import numpy as np
import pytest
from alembic.config import Config

from alembic import command
from camera_path.config import settings


def test_populated_scene_upgrade_preserves_world_placement_and_identity(tmp_path, monkeypatch):
    path = tmp_path / "scene.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261101_0015")
    with sqlite3.connect(path) as connection:
        connection.execute("INSERT INTO projects VALUES ('p','Keep scene',7)")
        connection.execute("""INSERT INTO library_assets
            (id,name,format,object_key,size_bytes,status,created_at)
            VALUES ('a','Asset','ply','unchanged.ply',4,'ready','2026-11-01')""")
        connection.execute("""INSERT INTO library_asset_files
            (asset_id,id,position,is_primary,format,object_key,size_bytes)
            VALUES ('a','lod-0',0,1,'ply','unchanged.ply',4)""")
        connection.execute("""INSERT INTO project_clouds
            (id,project_id,library_asset_id,position,visible,
             translation_x,translation_y,translation_z,
             rotation_x_deg,rotation_y_deg,rotation_z_deg,scale,offset_x,offset_y,offset_z)
            VALUES ('object','p','a',0,0,3,-2,5,30,-40,70,2.5,0.4,-0.8,1)""")
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with sqlite3.connect(path) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute("SELECT * FROM scene_objects").fetchone()
        assert (
            row["id"],
            row["project_id"],
            row["library_asset_id"],
            row["library_asset_file_id"],
        ) == ("object", "p", "a", "lod-0")
        assert row["parent_id"] is None and row["sort_order"] == 0 and row["visible"] == 0
        assert connection.execute("SELECT revision FROM projects").fetchone()[0] == 7
        assert (
            connection.execute("SELECT object_key FROM library_assets").fetchone()[0]
            == "unchanged.ply"
        )
        assert (
            connection.execute(
                "SELECT name FROM sqlite_master WHERE name='project_clouds'"
            ).fetchall()
            == []
        )
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        # Compare transformed points, not only stored components or Euler roundtrips.
        a, b, c = map(math.radians, (30, -40, 70))
        rx = np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])
        ry = np.array([[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]])
        rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
        x, y, z, w = [row[f"quaternion_{axis}"] for axis in "xyzw"]
        assert math.hypot(x, y, z, w) == pytest.approx(1)
        rotation = np.array(
            [
                [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
            ]
        )
        position = np.array([row[f"position_{axis}"] for axis in "xyz"])
        scale = np.array([row[f"scale_{axis}"] for axis in "xyz"])
        for point in np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [2, -3, 5]]):
            old = np.array([3, -2, 5]) + rx @ ry @ rz @ (2.5 * (point + np.array([0.4, -0.8, 1])))
            new = position + rotation @ (scale * point)
            assert new == pytest.approx(old, abs=1e-12)
    with pytest.raises(RuntimeError, match="pre-migration backup"):
        command.downgrade(config, "20261101_0015")


def test_empty_scene_migration_roundtrip(tmp_path, monkeypatch):
    path = tmp_path / "empty.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{path}")
    config = Config("alembic.ini")
    command.upgrade(config, "head")
    command.downgrade(config, "20261101_0015")
    command.upgrade(config, "head")
    with sqlite3.connect(path) as connection:
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        assert connection.execute("SELECT COUNT(*) FROM scene_objects").fetchone() == (0,)
