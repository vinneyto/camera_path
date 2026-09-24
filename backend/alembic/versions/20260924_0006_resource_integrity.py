"""Constrain camera resource values and scene point references.

Revision ID: 20260924_0006
Revises: 20260924_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_0006"
down_revision: str | None = "20260924_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INTERPOLATION = "interpolation_to_next IN ('hold', 'linear', 'smoothstep')"
AIM = (
    "({p}kind = 'follow_path' AND {p}direction IS NOT NULL "
    "AND {p}direction IN ('forward', 'backward') "
    "AND {p}scene_point_id IS NULL) OR "
    "({p}kind = 'look_at_point' AND {p}direction IS NULL "
    "AND {p}scene_point_id IS NOT NULL)"
)
SEGMENT_FIELDS = (
    "(kind = 'spline' AND tension IS NOT NULL AND turns IS NULL AND direction IS NULL "
    "AND radial_law IS NULL AND axial_law IS NULL) OR "
    "(kind = 'spiral' AND tension IS NULL AND turns IS NOT NULL "
    "AND direction IS NOT NULL AND direction IN ('cw', 'ccw') "
    "AND radial_law IS NOT NULL AND radial_law IN ('linear', 'smoothstep') "
    "AND axial_law IS NOT NULL AND axial_law IN ('linear', 'smoothstep'))"
)
FOCUS = (
    "(focus_kind = 'center_weighted_9' AND focus_scene_point_id IS NULL) OR "
    "(focus_kind = 'scene_point' AND focus_scene_point_id IS NOT NULL)"
)


def _require_valid(table: str, condition: str) -> None:
    count = op.get_bind().scalar(sa.text(f"SELECT COUNT(*) FROM {table} WHERE NOT ({condition})"))
    if count:
        raise RuntimeError(f"{table} contains {count} rows incompatible with CP-62 constraints")


def _require_scene_points(table: str, column: str) -> None:
    missing = op.get_bind().scalar(
        sa.text(
            f"SELECT COUNT(*) FROM {table} AS source "
            "LEFT JOIN scene_points AS point ON "
            f"point.project_id = source.project_id AND point.id = source.{column} "
            f"WHERE source.{column} IS NOT NULL AND point.id IS NULL"
        )
    )
    if missing:
        raise RuntimeError(
            f"{table}.{column} contains {missing} missing/cross-project scene points"
        )


def upgrade() -> None:
    op.get_bind().execute(
        sa.text(
            "INSERT INTO motion_profiles (project_id, default_speed) "
            "SELECT projects.id, 1.0 FROM projects "
            "LEFT JOIN motion_profiles ON motion_profiles.project_id = projects.id "
            "WHERE motion_profiles.project_id IS NULL"
        )
    )
    # Older reads synthesized a camera track for projects missing its row.
    op.get_bind().execute(
        sa.text(
            "INSERT INTO camera_tracks (project_id, default_aim_kind, default_aim_direction, "
            "default_aim_scene_point_id, world_up_x, world_up_y, world_up_z, "
            "default_orientation_yaw_deg, default_orientation_pitch_deg, "
            "default_orientation_roll_deg) "
            "SELECT projects.id, 'follow_path', 'forward', NULL, 0, 1, 0, 0, 0, 0 "
            "FROM projects LEFT JOIN camera_tracks ON camera_tracks.project_id = projects.id "
            "WHERE camera_tracks.project_id IS NULL"
        )
    )
    for table, checks in (
        ("trajectory_segments", ["kind IN ('spline', 'spiral')", SEGMENT_FIELDS]),
        ("speed_keyframes", [INTERPOLATION]),
        ("camera_tracks", [AIM.format(p="default_aim_")]),
        ("aim_keyframes", [AIM.format(p="aim_"), INTERPOLATION]),
        ("orientation_keyframes", [INTERPOLATION]),
        ("depth_of_field_keyframes", [FOCUS]),
    ):
        for check in checks:
            _require_valid(table, check)
    for table, column in (
        ("camera_tracks", "default_aim_scene_point_id"),
        ("aim_keyframes", "aim_scene_point_id"),
        ("depth_of_field_keyframes", "focus_scene_point_id"),
    ):
        _require_scene_points(table, column)

    with op.batch_alter_table("scene_points") as batch:
        batch.create_unique_constraint("uq_scene_points_project_id_id", ["project_id", "id"])

    with op.batch_alter_table("trajectory_segments") as batch:
        batch.create_check_constraint("ck_segment_kind", "kind IN ('spline', 'spiral')")
        batch.create_check_constraint("ck_segment_fields", SEGMENT_FIELDS)
    with op.batch_alter_table("speed_keyframes") as batch:
        batch.create_check_constraint("ck_speed_interpolation", INTERPOLATION)
    with op.batch_alter_table("camera_tracks") as batch:
        batch.create_check_constraint("ck_camera_track_aim", AIM.format(p="default_aim_"))
        batch.create_foreign_key(
            "fk_camera_track_scene_point",
            "scene_points",
            ["project_id", "default_aim_scene_point_id"],
            ["project_id", "id"],
            deferrable=True,
            initially="DEFERRED",
        )
    with op.batch_alter_table("aim_keyframes") as batch:
        batch.create_check_constraint("ck_aim_key_aim", AIM.format(p="aim_"))
        batch.create_check_constraint("ck_aim_interpolation", INTERPOLATION)
        batch.create_foreign_key(
            "fk_aim_key_scene_point",
            "scene_points",
            ["project_id", "aim_scene_point_id"],
            ["project_id", "id"],
            deferrable=True,
            initially="DEFERRED",
        )
    with op.batch_alter_table("orientation_keyframes") as batch:
        batch.create_check_constraint("ck_orientation_interpolation", INTERPOLATION)
    with op.batch_alter_table("depth_of_field_keyframes") as batch:
        batch.create_check_constraint("ck_dof_focus", FOCUS)
        batch.create_foreign_key(
            "fk_dof_scene_point",
            "scene_points",
            ["project_id", "focus_scene_point_id"],
            ["project_id", "id"],
            deferrable=True,
            initially="DEFERRED",
        )


def downgrade() -> None:
    raise RuntimeError("CP-62 integrity constraints are intentionally forward-only")
