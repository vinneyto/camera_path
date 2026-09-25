import sqlite3

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from alembic import command
from camera_path.config import settings
from camera_path.persistence.enums import ChatRole, SegmentKind
from camera_path.persistence.models import Base, ChatMessageRecord, TrajectorySegmentRecord


def test_enum_migration_preserves_old_values_and_constraints(tmp_path, monkeypatch) -> None:
    path = tmp_path / "enums.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260924_0007")
    with sqlite3.connect(path) as connection:
        connection.execute("INSERT INTO projects (id, name, revision) VALUES ('p', 'Old', 0)")
        connection.execute(
            "INSERT INTO anchors (id, project_id, label, surface_position_x, "
            "surface_position_y, surface_position_z, surface_normal_x, surface_normal_y, "
            "surface_normal_z, lift, lift_axis) VALUES "
            "('a', 'p', 'Anchor', 0, 0, 0, 0, 1, 0, 0, 'world_up')"
        )
        connection.execute(
            "INSERT INTO trajectory_segments (id, project_id, position, kind, tension) "
            "VALUES ('s', 'p', 0, 'spline', 0.5)"
        )
        connection.execute(
            "INSERT INTO chat_messages (id, project_id, position, role, content) "
            "VALUES ('m', 'p', 0, 'user', 'Hello')"
        )

    command.upgrade(config, "head")
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT lift_axis FROM anchors").fetchone() == ("world_up",)
        assert connection.execute("SELECT kind FROM trajectory_segments").fetchone() == ("spline",)
        assert connection.execute("SELECT role FROM chat_messages").fetchone() == ("user",)
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
        for statement in (
            "UPDATE anchors SET lift_axis = 'other' WHERE id = 'a'",
            "UPDATE chat_messages SET role = 'system' WHERE id = 'm'",
            "UPDATE trajectory_segments SET kind = 'other' WHERE id = 's'",
            "UPDATE trajectory_segments SET direction = 'cw' WHERE id = 's'",
        ):
            with pytest.raises(sqlite3.IntegrityError):
                connection.execute(statement)

    engine = create_engine(f"sqlite:///{path}")
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    with Session(engine) as session:
        assert session.scalar(select(ChatMessageRecord)).role is ChatRole.USER
        assert session.scalar(select(TrajectorySegmentRecord)).kind is SegmentKind.SPLINE
    engine.dispose()


def test_enum_migration_rejects_unsupported_legacy_value(tmp_path, monkeypatch) -> None:
    path = tmp_path / "bad-enum.sqlite3"
    monkeypatch.setattr(settings, "database_url", f"sqlite+aiosqlite:///{path}")
    config = Config("alembic.ini")
    command.upgrade(config, "20260924_0007")
    with sqlite3.connect(path) as connection:
        connection.execute("INSERT INTO projects (id, name, revision) VALUES ('p', 'Old', 0)")
        connection.execute(
            "INSERT INTO chat_messages (id, project_id, position, role, content) "
            "VALUES ('m', 'p', 0, 'system', 'Invalid')"
        )
    with pytest.raises(RuntimeError, match="chat_messages.role has 1 unsupported enum values"):
        command.upgrade(config, "head")
