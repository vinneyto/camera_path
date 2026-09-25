"""Use stable string enum constraints for persisted resource values.

Revision ID: 20260925_0008
Revises: 20260924_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260925_0008"
down_revision: str | None = "20260924_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Keep the migration independent from application Enum classes so future additions
# cannot silently change the constraints installed by this revision.
VALUES = {
    "anchors": {"lift_axis": ("world_up", "surface_normal")},
    "library_assets": {"status": ("pending", "ready")},
    "trajectory_segments": {
        "kind": ("spline", "spiral"),
        "direction": ("cw", "ccw"),
        "radial_law": ("linear", "smoothstep"),
        "axial_law": ("linear", "smoothstep"),
    },
    "speed_keyframes": {"interpolation_to_next": ("hold", "linear", "smoothstep")},
    "camera_tracks": {
        "default_aim_kind": ("follow_path", "look_at_point"),
        "default_aim_direction": ("forward", "backward"),
    },
    "aim_keyframes": {
        "aim_kind": ("follow_path", "look_at_point"),
        "aim_direction": ("forward", "backward"),
        "interpolation_to_next": ("hold", "linear", "smoothstep"),
    },
    "orientation_keyframes": {"interpolation_to_next": ("hold", "linear", "smoothstep")},
    "depth_of_field_keyframes": {"focus_kind": ("center_weighted_9", "scene_point")},
    "chat_messages": {"role": ("user", "assistant")},
}

OLD_CHECKS = {
    "trajectory_segments": ("ck_segment_kind", "ck_segment_fields"),
    "speed_keyframes": ("ck_speed_interpolation",),
    "camera_tracks": ("ck_camera_track_aim",),
    "aim_keyframes": ("ck_aim_key_aim", "ck_aim_interpolation"),
    "orientation_keyframes": ("ck_orientation_interpolation",),
    "depth_of_field_keyframes": ("ck_dof_focus",),
}

COMPOSITE_CHECKS = {
    "trajectory_segments": (
        "ck_segment_fields",
        "(kind = 'spline' AND tension IS NOT NULL AND turns IS NULL "
        "AND direction IS NULL AND radial_law IS NULL AND axial_law IS NULL) OR "
        "(kind = 'spiral' AND tension IS NULL AND turns IS NOT NULL "
        "AND direction IS NOT NULL AND radial_law IS NOT NULL AND axial_law IS NOT NULL)",
    ),
    "camera_tracks": (
        "ck_camera_track_aim",
        "(default_aim_kind = 'follow_path' AND default_aim_direction IS NOT NULL "
        "AND default_aim_scene_point_id IS NULL) OR "
        "(default_aim_kind = 'look_at_point' AND default_aim_direction IS NULL "
        "AND default_aim_scene_point_id IS NOT NULL)",
    ),
    "aim_keyframes": (
        "ck_aim_key_aim",
        "(aim_kind = 'follow_path' AND aim_direction IS NOT NULL "
        "AND aim_scene_point_id IS NULL) OR "
        "(aim_kind = 'look_at_point' AND aim_direction IS NULL "
        "AND aim_scene_point_id IS NOT NULL)",
    ),
    "depth_of_field_keyframes": (
        "ck_dof_focus",
        "(focus_kind = 'center_weighted_9' AND focus_scene_point_id IS NULL) OR "
        "(focus_kind = 'scene_point' AND focus_scene_point_id IS NOT NULL)",
    ),
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table, columns in VALUES.items():
        reflected = {column["name"]: column for column in inspector.get_columns(table)}
        for column, values in columns.items():
            quoted = ", ".join(f"'{value}'" for value in values)
            count = bind.scalar(
                sa.text(
                    f"SELECT COUNT(*) FROM {table} WHERE {column} IS NOT NULL "
                    f"AND {column} NOT IN ({quoted})"
                )
            )
            if count:
                raise RuntimeError(f"{table}.{column} has {count} unsupported enum values")

        with op.batch_alter_table(table) as batch:
            for old_name in OLD_CHECKS.get(table, ()):
                batch.drop_constraint(old_name, type_="check")
            for column, values in columns.items():
                batch.alter_column(
                    column,
                    existing_type=reflected[column]["type"],
                    type_=sa.String(length=max(map(len, values))),
                    existing_nullable=reflected[column]["nullable"],
                )
                quoted = ", ".join(f"'{value}'" for value in values)
                batch.create_check_constraint(f"ck_{table}_{column}", f"{column} IN ({quoted})")
            if table in COMPOSITE_CHECKS:
                batch.create_check_constraint(*COMPOSITE_CHECKS[table])


def downgrade() -> None:
    raise RuntimeError("CP-67 enum constraints are intentionally forward-only")
