"""Normalize project snapshots into resource tables.

Revision ID: 20260920_0002
Revises: 20260920_0001
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa

from alembic import op

revision: str = "20260920_0002"
down_revision: str | None = "20260920_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"))


def _create_resource_tables() -> None:
    op.create_table(
        "anchors",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_anchors_project_id", "anchors", ["project_id"])
    op.create_table(
        "scene_points",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scene_points_project_id", "scene_points", ["project_id"])
    op.create_table(
        "trajectory_segments",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "position", name="uq_trajectory_segments_position"),
    )
    op.create_index(
        "ix_trajectory_segments_project_id", "trajectory_segments", ["project_id"]
    )
    op.create_table(
        "segment_anchors",
        sa.Column("segment_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("anchor_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["anchor_id"], ["anchors.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["segment_id"], ["trajectory_segments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("segment_id", "position"),
    )
    op.create_index("ix_segment_anchors_anchor_id", "segment_anchors", ["anchor_id"])
    op.create_table(
        "motion_profiles",
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.Column("default_speed", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id"),
    )
    op.create_table(
        "speed_keyframes",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_speed_keyframes_project_id", "speed_keyframes", ["project_id"])
    op.create_table(
        "camera_tracks",
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.Column("default_aim", sa.Text(), nullable=False),
        sa.Column("world_up", sa.Text(), nullable=False),
        sa.Column("default_orientation", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id"),
    )
    for table_name in (
        "aim_keyframes",
        "orientation_keyframes",
        "depth_of_field_keyframes",
    ):
        op.create_table(
            table_name,
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("payload", sa.Text(), nullable=False),
            sa.Column("project_id", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(f"ix_{table_name}_project_id", table_name, ["project_id"])
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "position", name="uq_chat_messages_position"),
    )
    op.create_index("ix_chat_messages_project_id", "chat_messages", ["project_id"])


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("projects")}
    if {"name", "revision"}.issubset(columns):
        return

    rows = bind.execute(
        sa.text(
            "SELECT s.payload FROM project_snapshots s "
            "JOIN projects p ON p.id = s.project_id AND p.cursor = s.position"
        )
    ).scalars()
    projects = [json.loads(payload) for payload in rows]

    op.drop_table("project_snapshots")
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("name", sa.Text(), nullable=True))
        batch.add_column(sa.Column("revision", sa.Integer(), nullable=True))
        batch.drop_constraint("ck_projects_cursor_non_negative", type_="check")
        batch.drop_column("cursor")
    _create_resource_tables()

    for project in projects:
        project_id = project["id"]
        bind.execute(
            sa.text("UPDATE projects SET name=:name, revision=:revision WHERE id=:id"),
            {
                "id": project_id,
                "name": project.get("name", "Untitled camera path"),
                "revision": project.get("revision", 0),
            },
        )
        for item in project.get("anchors", {}).values():
            bind.execute(
                sa.text(
                    "INSERT INTO anchors (id, project_id, payload) "
                    "VALUES (:id, :project_id, :payload)"
                ),
                {"id": item["id"], "project_id": project_id, "payload": _json(item)},
            )
        for item in project.get("scene_points", {}).values():
            bind.execute(
                sa.text(
                    "INSERT INTO scene_points (id, project_id, payload) "
                    "VALUES (:id, :project_id, :payload)"
                ),
                {"id": item["id"], "project_id": project_id, "payload": _json(item)},
            )
        for position, item in enumerate(project.get("segments", [])):
            bind.execute(
                sa.text(
                    "INSERT INTO trajectory_segments (id, project_id, position, payload) "
                    "VALUES (:id, :project_id, :position, :payload)"
                ),
                {
                    "id": item["id"],
                    "project_id": project_id,
                    "position": position,
                    "payload": _json(item),
                },
            )
            anchor_ids = item.get("anchor_ids") or [
                item["start_anchor_id"],
                item["center_anchor_id"],
                item["end_anchor_id"],
            ]
            for anchor_position, anchor_id in enumerate(anchor_ids):
                bind.execute(
                    sa.text(
                        "INSERT INTO segment_anchors (segment_id, position, anchor_id) "
                        "VALUES (:segment_id, :position, :anchor_id)"
                    ),
                    {
                        "segment_id": item["id"],
                        "position": anchor_position,
                        "anchor_id": anchor_id,
                    },
                )

        motion = project.get("motion_profile", {})
        bind.execute(
            sa.text(
                "INSERT INTO motion_profiles (project_id, default_speed) "
                "VALUES (:project_id, :default_speed)"
            ),
            {"project_id": project_id, "default_speed": motion.get("default_speed", 1.0)},
        )
        for item in motion.get("keyframes", {}).values():
            bind.execute(
                sa.text(
                    "INSERT INTO speed_keyframes (id, project_id, payload) "
                    "VALUES (:id, :project_id, :payload)"
                ),
                {"id": item["id"], "project_id": project_id, "payload": _json(item)},
            )

        camera = project.get("camera_track", {})
        bind.execute(
            sa.text(
                "INSERT INTO camera_tracks "
                "(project_id, default_aim, world_up, default_orientation) "
                "VALUES (:project_id, :default_aim, :world_up, :default_orientation)"
            ),
            {
                "project_id": project_id,
                "default_aim": _json(
                    camera.get("default_aim", {"kind": "follow_path", "direction": "forward"})
                ),
                "world_up": _json(camera.get("world_up", [0.0, 1.0, 0.0])),
                "default_orientation": _json(
                    camera.get(
                        "default_orientation",
                        {"yaw_deg": 0.0, "pitch_deg": 0.0, "roll_deg": 0.0},
                    )
                ),
            },
        )
        for table_name, key in (
            ("aim_keyframes", "keyframes"),
            ("orientation_keyframes", "orientation_keyframes"),
            ("depth_of_field_keyframes", "depth_of_field_keyframes"),
        ):
            for item in camera.get(key, {}).values():
                bind.execute(
                    sa.text(
                        f"INSERT INTO {table_name} (id, project_id, payload) "
                        "VALUES (:id, :project_id, :payload)"
                    ),
                    {"id": item["id"], "project_id": project_id, "payload": _json(item)},
                )
        for position, item in enumerate(project.get("chat_history", [])):
            bind.execute(
                sa.text(
                    "INSERT INTO chat_messages "
                    "(id, project_id, position, role, content) "
                    "VALUES (:id, :project_id, :position, :role, :content)"
                ),
                {
                    "id": item["id"],
                    "project_id": project_id,
                    "position": position,
                    "role": item["role"],
                    "content": item["content"],
                },
            )

    with op.batch_alter_table("projects") as batch:
        batch.alter_column("name", nullable=False)
        batch.alter_column("revision", nullable=False)


def downgrade() -> None:
    raise RuntimeError(
        "CP-40 cannot be downgraded without discarding normalized resource changes"
    )
