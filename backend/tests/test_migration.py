import asyncio
import sqlite3

import pytest
from alembic.config import Config

from alembic import command
from camera_path.config import settings
from camera_path.models import (
    Anchor,
    CameraKeyframe,
    CameraOrientation,
    CameraOrientationKeyframe,
    ChatHistoryMessage,
    DepthOfFieldKeyframe,
    FollowPathAim,
    LookAtPointAim,
    Project,
    ScenePoint,
    ScenePointDepthOfFieldFocus,
    SpeedKeyframe,
    SpiralSegment,
    SplineSegment,
)
from camera_path.repositories import ProjectRepository


def test_cloud_defaults_migration_preserves_existing_rows(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "clouds.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260924_0006")
    with sqlite3.connect(database_path) as connection:
        connection.execute("INSERT INTO projects (id, name, revision) VALUES ('p', 'P', 0)")
        connection.execute(
            "INSERT INTO library_assets "
            "(id, name, format, object_key, size_bytes, status, created_at) "
            "VALUES ('a', 'A', 'ply', 'a.ply', 1, 'ready', '2026-09-24')"
        )
        connection.execute(
            "INSERT INTO project_clouds (id, project_id, library_asset_id, position, visible) "
            "VALUES ('c', 'p', 'a', 0, 1)"
        )
    command.upgrade(config, "head")
    with sqlite3.connect(database_path) as connection:
        assert connection.execute(
            "SELECT default_rotation_x_deg, default_rotation_y_deg, "
            "default_rotation_z_deg, default_scale FROM library_assets"
        ).fetchone() == (0, 0, 0, 1)
        assert connection.execute(
            "SELECT translation_x, translation_y, translation_z, "
            "rotation_x_deg, rotation_y_deg, rotation_z_deg, scale FROM project_clouds"
        ).fetchone() == (0, 0, 0, 0, 0, 0, 1)


@pytest.mark.parametrize("unnamed_check", [False, True])
def test_legacy_snapshot_is_migrated_to_normalized_tables(
    tmp_path, monkeypatch, unnamed_check
) -> None:
    database_path = tmp_path / "legacy.sqlite3"
    database_url = f"sqlite+aiosqlite:///{database_path}"
    monkeypatch.setattr(settings, "database_url", database_url)
    config = Config("alembic.ini")
    command.upgrade(config, "20260920_0001")

    if unnamed_check:
        with sqlite3.connect(database_path) as connection:
            connection.execute("DROP TABLE project_snapshots")
            connection.execute("DROP TABLE projects")
            connection.execute(
                "CREATE TABLE projects (id TEXT PRIMARY KEY NOT NULL, "
                "cursor INTEGER NOT NULL CHECK (cursor >= 0))"
            )
            connection.execute(
                "CREATE TABLE project_snapshots (project_id TEXT NOT NULL, "
                "position INTEGER NOT NULL, payload TEXT NOT NULL, "
                "PRIMARY KEY (project_id, position), "
                "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE)"
            )

    project = Project(name="Legacy project", revision=7)
    first = Anchor(label="First", surface_position=(0, 0, 0))
    second = Anchor(label="Second", surface_position=(1, 0, 0))
    point = ScenePoint(label="Subject", position=(0, 1, 0))
    segment = SplineSegment(anchor_ids=[first.id, second.id])
    speed = SpeedKeyframe(path_position=0.5, speed=2.0)
    project.anchors = {first.id: first, second.id: second}
    project.scene_points = {point.id: point}
    project.segments = [segment]
    project.motion_profile.keyframes = {speed.id: speed}
    project.chat_history = [ChatHistoryMessage(role="user", content="Keep me")]

    with sqlite3.connect(database_path) as connection:
        connection.execute("INSERT INTO projects (id, cursor) VALUES (?, ?)", (project.id, 3))
        connection.execute(
            "INSERT INTO project_snapshots (project_id, position, payload) VALUES (?, ?, ?)",
            (project.id, 3, project.model_dump_json()),
        )

    command.upgrade(config, "head")

    with sqlite3.connect(database_path) as connection:
        assert connection.execute(
            "SELECT name, revision FROM projects WHERE id = ?", (project.id,)
        ).fetchone() == ("Legacy project", 7)
        assert connection.execute("SELECT COUNT(*) FROM anchors").fetchone() == (2,)
        assert connection.execute("SELECT COUNT(*) FROM scene_points").fetchone() == (1,)
        assert connection.execute("SELECT COUNT(*) FROM trajectory_segments").fetchone() == (1,)
        assert connection.execute("SELECT COUNT(*) FROM segment_anchors").fetchone() == (2,)
        assert connection.execute("SELECT COUNT(*) FROM speed_keyframes").fetchone() == (1,)
        assert connection.execute("SELECT content FROM chat_messages").fetchone() == ("Keep me",)
        table_names = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        assert "project_snapshots" not in table_names
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []


def test_missing_snapshots_requires_restore(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "interrupted.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260920_0001")
    with sqlite3.connect(database_path) as connection:
        connection.execute("DROP TABLE project_snapshots")

    with pytest.raises(RuntimeError, match="restore a pre-migration backup"):
        command.upgrade(config, "head")


def test_shared_aim_keyframe_id_is_scoped_to_project(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "shared-aim.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260920_0001")
    projects = [Project(name=f"Project {index}") for index in range(2)]
    for project in projects:
        keyframe = CameraKeyframe(id="shared", path_position=0, aim=FollowPathAim())
        project.camera_track.keyframes = {keyframe.id: keyframe}

    with sqlite3.connect(database_path) as connection:
        for project in projects:
            connection.execute("INSERT INTO projects (id, cursor) VALUES (?, 0)", (project.id,))
            connection.execute(
                "INSERT INTO project_snapshots (project_id, position, payload) VALUES (?, 0, ?)",
                (project.id, project.model_dump_json()),
            )

    command.upgrade(config, "head")

    with sqlite3.connect(database_path) as connection:
        assert connection.execute(
            "SELECT project_id, id FROM aim_keyframes ORDER BY project_id"
        ).fetchall() == [(project.id, "shared") for project in sorted(projects, key=lambda p: p.id)]
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []


def test_existing_normalized_data_moves_to_columns(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "normalized.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260920_0001")

    project = Project(name="Typed", revision=8)
    anchors = [
        Anchor(
            label=f"Anchor {i}",
            surface_position=(i, 2, 3),
            surface_normal=(0, 0, 1),
            lift=0.5,
            lift_axis="surface_normal",
        )
        for i in range(3)
    ]
    project.anchors = {anchor.id: anchor for anchor in anchors}
    point = ScenePoint(label="Focus", position=(4, 5, 6))
    project.scene_points = {point.id: point}
    project.segments = [
        SplineSegment(anchor_ids=[anchors[0].id, anchors[1].id], tension=0.25),
        SpiralSegment(
            start_anchor_id=anchors[0].id,
            center_anchor_id=anchors[1].id,
            end_anchor_id=anchors[2].id,
            turns=2.5,
            direction="cw",
            radial_law="linear",
            axial_law="linear",
        ),
    ]
    speed = SpeedKeyframe(path_position=0.3, speed=2, interpolation_to_next="linear")
    project.motion_profile.keyframes[speed.id] = speed
    project.camera_track.default_aim = LookAtPointAim(scene_point_id=point.id)
    project.camera_track.world_up = (0, 0, 1)
    aim = CameraKeyframe(path_position=0.5, aim=LookAtPointAim(scene_point_id=point.id))
    project.camera_track.keyframes[aim.id] = aim
    orientation = CameraOrientationKeyframe(
        path_position=0.6, orientation=CameraOrientation(yaw_deg=1, pitch_deg=2, roll_deg=3)
    )
    project.camera_track.default_orientation = CameraOrientation(yaw_deg=4)
    project.camera_track.orientation_keyframes[orientation.id] = orientation
    focus = DepthOfFieldKeyframe(
        path_position=0.8,
        focus=ScenePointDepthOfFieldFocus(scene_point_id=point.id),
        focus_range_scale=0.4,
        bokeh_scale=3.5,
    )
    project.camera_track.depth_of_field_keyframes[focus.id] = focus
    project.chat_history = [ChatHistoryMessage(role="user", content="Preserve")]

    with sqlite3.connect(database_path) as connection:
        connection.execute("INSERT INTO projects (id, cursor) VALUES (?, 0)", (project.id,))
        connection.execute(
            "INSERT INTO project_snapshots (project_id, position, payload) VALUES (?, 0, ?)",
            (project.id, project.model_dump_json()),
        )
    command.upgrade(config, "20260920_0002")
    command.upgrade(config, "head")

    async def check_project() -> None:
        repository = ProjectRepository(settings.database_url)
        try:
            assert await repository.get(project.id) == project
        finally:
            await repository.close()

    asyncio.run(check_project())
    with sqlite3.connect(database_path) as connection:
        for table in (
            "anchors",
            "scene_points",
            "trajectory_segments",
            "speed_keyframes",
            "camera_tracks",
            "aim_keyframes",
            "orientation_keyframes",
            "depth_of_field_keyframes",
        ):
            columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
            assert "payload" not in columns
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []


def test_email_auth_migration_preserves_editor_and_revokes_password_only_sessions(
    tmp_path, monkeypatch
):
    database_path = tmp_path / "email-migration.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261011_0012")
    with sqlite3.connect(database_path) as connection:
        connection.execute("INSERT INTO editors VALUES ('editor', 'legacy', 'hash', 'version')")
        connection.execute("INSERT INTO editor_sessions VALUES ('old-session', 9999999999)")
        connection.execute("INSERT INTO projects (id,name,revision) VALUES ('p','Keep me',0)")
    command.upgrade(config, "head")
    with sqlite3.connect(database_path) as connection:
        assert connection.execute(
            "SELECT username,password_hash,credential_version FROM editors"
        ).fetchone() == ("legacy", "hash", "version")
        assert connection.execute("SELECT COUNT(*) FROM editor_sessions").fetchone() == (0,)
        assert connection.execute("SELECT name FROM projects").fetchone() == ("Keep me",)
        assert connection.execute("SELECT COUNT(*) FROM auth_challenges").fetchone() == (0,)
    command.downgrade(config, "20261011_0012")
    with sqlite3.connect(database_path) as connection:
        assert connection.execute("SELECT username FROM editors").fetchone() == ("legacy",)


def test_library_file_upgrade_preserves_populated_database_and_ownership(tmp_path, monkeypatch):
    database_path = tmp_path / "library-upgrade.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261026_0014")
    with sqlite3.connect(database_path) as connection:
        connection.execute("INSERT INTO projects(id,name,revision) VALUES ('p','Scene',7)")
        for asset_id, status in [("ready", "ready"), ("pending", "pending")]:
            connection.execute(
                "INSERT INTO library_assets(id,name,format,object_key,size_bytes,status,created_at,"
                "default_rotation_x_deg,default_scale) VALUES (?,?,?,?,?,?,?,23,2)",
                (asset_id, asset_id, "ply", f"{asset_id}.ply", 4, status, "2026-10-26"),
            )
        connection.execute(
            "INSERT INTO project_clouds(id,project_id,library_asset_id,position,visible) "
            "VALUES ('c','p','ready',0,1)"
        )
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with sqlite3.connect(database_path) as connection:
        assets = connection.execute(
            "SELECT id,job_id,object_key,default_rotation_x_deg,default_scale,"
            "thumbnail_key,tags "
            "FROM library_assets ORDER BY id"
        ).fetchall()
        assert all(row[1] is None for row in assets)
        assert "client_id" not in {
            r[1] for r in connection.execute("PRAGMA table_info(library_assets)")
        }
        assert connection.execute("SELECT COUNT(*) FROM jobs").fetchone() == (0,)
        assert all(row[2:] == (f"{row[0]}.ply", 23, 2, None, "[]") for row in assets)
        assert connection.execute(
            "SELECT asset_id,id,position,is_primary,object_key,sha256 FROM library_asset_files "
            "ORDER BY asset_id"
        ).fetchall() == [
            ("pending", "main", 0, 1, "pending.ply", None),
            ("ready", "main", 0, 1, "ready.ply", None),
        ]
        assert connection.execute("SELECT revision FROM projects").fetchone() == (7,)
        assert connection.execute("SELECT library_asset_id FROM project_clouds").fetchone() == (
            "ready",
        )
        assert connection.execute("SELECT COUNT(*) FROM dev_queue_messages").fetchone() == (0,)
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        connection.execute(
            "INSERT INTO library_asset_files(asset_id,id,position,is_primary,format,object_key,"
            "size_bytes) VALUES ('ready','extra',1,0,'sog','other.sog',8)"
        )
    with pytest.raises(RuntimeError, match="Refusing lossy downgrade"):
        command.downgrade(config, "20261026_0014")


def test_job_migration_preserves_legacy_assets_and_quarantines_old_inbox(tmp_path, monkeypatch):
    import json
    from uuid import uuid4

    database_path = tmp_path / "job-upgrade.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261101_0015")
    legacy_id = str(uuid4())
    thumbnail = f"thumbnails/{legacy_id}/tree.png"
    with sqlite3.connect(database_path) as connection:
        connection.execute("INSERT INTO library_client_ids(client_id) VALUES (?)", (legacy_id,))
        connection.execute(
            "INSERT INTO library_assets(id,client_id,name,format,object_key,size_bytes,status,"
            "created_at,tags,thumbnail_key,default_scale) "
            "VALUES ('a',?,'Tree','ply','tree.ply',4,'ready','2026-11-01','[\"tree\"]',?,2)",
            (legacy_id, thumbnail),
        )
        connection.execute(
            "INSERT INTO library_asset_files(asset_id,id,position,is_primary,format,object_key,"
            "size_bytes,sha256) VALUES ('a','main',0,1,'ply','tree.ply',4,?)",
            ("a" * 64,),
        )
        connection.execute("INSERT INTO projects(id,name,revision) VALUES ('p','Keep',9)")
        connection.execute(
            "INSERT INTO project_clouds(id,project_id,library_asset_id,position,visible) "
            "VALUES ('c','p','a',0,1)"
        )
        for status in ("queued", "processing", "succeeded", "failed"):
            connection.execute(
                "INSERT INTO dev_queue_messages(message_id,body,body_sha256,status,attempts,"
                "available_at,created_at,updated_at,lease_token,lease_until,asset_id,error_code) "
                "VALUES (?,?,?, ?,3,'2026-11-01','2026-11-01','2026-11-01',"
                "'old-lease','2026-11-02','a',?)",
                (
                    status,
                    json.dumps({"schema_version": 1, "item": {"client_id": legacy_id}}),
                    "a" * 64,
                    status,
                    "old_error" if status == "failed" else None,
                ),
            )
    command.upgrade(config, "head")
    with sqlite3.connect(database_path) as connection:
        assert "client_id" not in {
            r[1] for r in connection.execute("PRAGMA table_info(library_assets)")
        }
        assert connection.execute(
            "SELECT name,object_key,tags,thumbnail_key,default_scale,job_id,job_position "
            "FROM library_assets"
        ).fetchone() == ("Tree", "tree.ply", '["tree"]', thumbnail, 2, None, None)
        assert connection.execute("SELECT COUNT(*) FROM jobs").fetchone() == (0,)
        assert (
            connection.execute(
                "SELECT name FROM sqlite_master WHERE name='library_client_ids'"
            ).fetchall()
            == []
        )
        for name in ("queued", "processing"):
            row = connection.execute(
                "SELECT status,error_code,lease_token,lease_until,attempts,body,job_id,updated_at "
                "FROM dev_queue_messages WHERE message_id=?",
                (name,),
            ).fetchone()
            assert row[:5] == ("failed", "obsolete_message_schema", None, None, 3)
            assert json.loads(row[5])["schema_version"] == 1 and row[6] is None
            assert row[7] == "2026-11-01"
        assert connection.execute(
            "SELECT status,error_code,job_id FROM dev_queue_messages WHERE message_id='succeeded'"
        ).fetchone() == ("succeeded", None, None)
        assert connection.execute("SELECT sha256 FROM library_asset_files").fetchone() == (
            "a" * 64,
        )
        assert connection.execute("SELECT library_asset_id FROM project_clouds").fetchone() == (
            "a",
        )
        assert connection.execute("SELECT revision FROM projects").fetchone() == (9,)
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        connection.execute("INSERT INTO jobs(id,completed_at) VALUES ('job','2026-11-01')")
    with pytest.raises(RuntimeError, match="Refusing lossy downgrade"):
        command.downgrade(config, "20261101_0015")


def test_job_migration_requires_duplicate_thumbnail_repair(tmp_path, monkeypatch):
    database_path = tmp_path / "duplicate-thumbnails.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{database_path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20261101_0015")
    with sqlite3.connect(database_path) as connection:
        for identity in ("a", "b"):
            connection.execute("INSERT INTO library_client_ids(client_id) VALUES (?)", (identity,))
            connection.execute(
                "INSERT INTO library_assets(id,client_id,name,format,object_key,size_bytes,status,"
                "created_at,thumbnail_key) VALUES (?,?,'Tree','ply',?,4,'ready','2026-11-01',"
                "'thumbnails/shared/image.png')",
                (identity, identity, f"{identity}.ply"),
            )
    with pytest.raises(RuntimeError, match="Repair duplicate thumbnail ownership"):
        command.upgrade(config, "head")
    with sqlite3.connect(database_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM library_assets").fetchone() == (2,)
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
            "20261101_0015",
        )
