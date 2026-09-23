import sqlite3

import pytest
from alembic.config import Config

from alembic import command
from camera_path.config import settings
from camera_path.models import (
    Anchor,
    CameraKeyframe,
    ChatHistoryMessage,
    FollowPathAim,
    Project,
    ScenePoint,
    SpeedKeyframe,
    SplineSegment,
)


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
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
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
                "INSERT INTO project_snapshots (project_id, position, payload) "
                "VALUES (?, 0, ?)",
                (project.id, project.model_dump_json()),
            )

    command.upgrade(config, "head")

    with sqlite3.connect(database_path) as connection:
        assert connection.execute(
            "SELECT project_id, id FROM aim_keyframes ORDER BY project_id"
        ).fetchall() == [(project.id, "shared") for project in sorted(projects, key=lambda p: p.id)]
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
