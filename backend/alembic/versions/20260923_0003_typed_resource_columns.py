"""Replace serialized resource fields with typed columns.

Revision ID: 20260923_0003
Revises: 20260920_0002
"""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from typing import Any

import sqlalchemy as sa

from alembic import op

revision: str = "20260923_0003"
down_revision: str | None = "20260920_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _vec(prefix: str, values: list[float]) -> dict[str, float]:
    return dict(zip((f"{prefix}_x", f"{prefix}_y", f"{prefix}_z"), values, strict=True))


def _aim(prefix: str, value: dict[str, Any]) -> dict[str, Any]:
    return {
        f"{prefix}_kind": value["kind"],
        f"{prefix}_direction": value.get("direction"),
        f"{prefix}_scene_point_id": value.get("scene_point_id"),
    }


def _orientation(prefix: str, value: dict[str, float]) -> dict[str, float]:
    return {
        f"{prefix}{axis}_deg": value.get(f"{axis}_deg", 0.0) for axis in ("yaw", "pitch", "roll")
    }


def _anchor(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "label": value["label"],
        "lift": value.get("lift", 0.0),
        "lift_axis": value.get("lift_axis", "world_up"),
        **_vec("surface_position", value["surface_position"]),
        **_vec("surface_normal", value.get("surface_normal", [0.0, 1.0, 0.0])),
    }


def _scene_point(value: dict[str, Any]) -> dict[str, Any]:
    return {"label": value["label"], **_vec("position", value["position"])}


def _segment(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": value["kind"],
        "tension": value.get("tension"),
        "turns": value.get("turns"),
        "direction": value.get("direction"),
        "radial_law": value.get("radial_law"),
        "axial_law": value.get("axial_law"),
    }


def _speed(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "path_position": value["path_position"],
        "speed": value["speed"],
        "interpolation_to_next": value.get("interpolation_to_next", "smoothstep"),
    }


def _aim_key(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "path_position": value["path_position"],
        "interpolation_to_next": value.get("interpolation_to_next", "smoothstep"),
        **_aim("aim", value["aim"]),
    }


def _orientation_key(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "path_position": value["path_position"],
        "interpolation_to_next": value.get("interpolation_to_next", "smoothstep"),
        **_orientation("", value["orientation"]),
    }


def _depth_of_field(value: dict[str, Any]) -> dict[str, Any]:
    focus = value.get("focus", {"kind": "center_weighted_9"})
    return {
        "path_position": value["path_position"],
        "focus_kind": focus["kind"],
        "focus_scene_point_id": focus.get("scene_point_id"),
        "focus_range_scale": value.get("focus_range_scale", 0.25),
        "bokeh_scale": value.get("bokeh_scale", 6.0),
    }


def _camera_track(value: dict[str, Any]) -> dict[str, Any]:
    return {
        **_aim("default_aim", json.loads(value["default_aim"])),
        **_vec("world_up", json.loads(value["world_up"])),
        **_orientation("default_orientation_", json.loads(value["default_orientation"])),
    }


# Each field maps to an SQL type and whether the domain requires it.
F = sa.Float
T = sa.Text
TABLES: tuple[
    tuple[
        str,
        dict[str, tuple[Any, bool]],
        Callable[[dict[str, Any]], dict[str, Any]],
        tuple[str, ...],
    ],
    ...,
] = (
    (
        "anchors",
        {
            "label": (T, True),
            "surface_position_x": (F, True),
            "surface_position_y": (F, True),
            "surface_position_z": (F, True),
            "surface_normal_x": (F, True),
            "surface_normal_y": (F, True),
            "surface_normal_z": (F, True),
            "lift": (F, True),
            "lift_axis": (T, True),
        },
        _anchor,
        ("payload",),
    ),
    (
        "scene_points",
        {
            "label": (T, True),
            "position_x": (F, True),
            "position_y": (F, True),
            "position_z": (F, True),
        },
        _scene_point,
        ("payload",),
    ),
    (
        "trajectory_segments",
        {
            "kind": (T, True),
            "tension": (F, False),
            "turns": (F, False),
            "direction": (T, False),
            "radial_law": (T, False),
            "axial_law": (T, False),
        },
        _segment,
        ("payload",),
    ),
    (
        "speed_keyframes",
        {
            "path_position": (F, True),
            "speed": (F, True),
            "interpolation_to_next": (T, True),
        },
        _speed,
        ("payload",),
    ),
    (
        "camera_tracks",
        {
            "default_aim_kind": (T, True),
            "default_aim_direction": (T, False),
            "default_aim_scene_point_id": (T, False),
            "world_up_x": (F, True),
            "world_up_y": (F, True),
            "world_up_z": (F, True),
            "default_orientation_yaw_deg": (F, True),
            "default_orientation_pitch_deg": (F, True),
            "default_orientation_roll_deg": (F, True),
        },
        _camera_track,
        ("default_aim", "world_up", "default_orientation"),
    ),
    (
        "aim_keyframes",
        {
            "path_position": (F, True),
            "aim_kind": (T, True),
            "aim_direction": (T, False),
            "aim_scene_point_id": (T, False),
            "interpolation_to_next": (T, True),
        },
        _aim_key,
        ("payload",),
    ),
    (
        "orientation_keyframes",
        {
            "path_position": (F, True),
            "yaw_deg": (F, True),
            "pitch_deg": (F, True),
            "roll_deg": (F, True),
            "interpolation_to_next": (T, True),
        },
        _orientation_key,
        ("payload",),
    ),
    (
        "depth_of_field_keyframes",
        {
            "path_position": (F, True),
            "focus_kind": (T, True),
            "focus_scene_point_id": (T, False),
            "focus_range_scale": (F, True),
            "bokeh_scale": (F, True),
        },
        _depth_of_field,
        ("payload",),
    ),
)


def upgrade() -> None:
    bind = op.get_bind()
    for name, fields, converter, old_columns in TABLES:
        for field, (column_type, _) in fields.items():
            op.add_column(name, sa.Column(field, column_type(), nullable=True))

        keys = (
            ("project_id", "id")
            if name.endswith("keyframes")
            else (("project_id",) if name == "camera_tracks" else ("id",))
        )
        table = sa.table(
            name,
            *(sa.column(key) for key in keys),
            *(sa.column(column) for column in old_columns),
            *(sa.column(field) for field in fields),
        )
        for row in bind.execute(sa.select(table)).mappings():
            source = dict(row)
            values = converter(source if name == "camera_tracks" else json.loads(source["payload"]))
            bind.execute(
                sa.update(table)
                .where(*(table.c[key] == source[key] for key in keys))
                .values(**values)
            )

        with op.batch_alter_table(name) as batch:
            for old_column in old_columns:
                batch.drop_column(old_column)
            for field, (_, required) in fields.items():
                if required:
                    batch.alter_column(field, nullable=False)


def downgrade() -> None:
    raise RuntimeError("Typed resource columns cannot be downgraded without reserializing data")
