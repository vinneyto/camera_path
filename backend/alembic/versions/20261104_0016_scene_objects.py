"""Migrate flat instances to local-TRS scene objects, preserving rendered placement."""

import math

import sqlalchemy as sa

from alembic import op

revision = "20261104_0016"
down_revision = "20261101_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    rows = (
        op.get_bind()
        .execute(
            sa.text("""
        SELECT c.*, f.id AS file_id FROM project_clouds c
        LEFT JOIN library_asset_files f ON f.asset_id = c.library_asset_id AND f.is_primary = 1
    """)
        )
        .mappings()
        .all()
    )
    converted = []
    for row in rows:
        if row["file_id"] is None:
            raise RuntimeError("Scene migration requires primary asset files; restore a backup")
        angles = [row[f"rotation_{axis}_deg"] for axis in "xyz"]
        translation = [row[f"translation_{axis}"] for axis in "xyz"]
        offset = [row[f"offset_{axis}"] for axis in "xyz"]
        scale = row["scale"]
        if not all(math.isfinite(v) for v in [*angles, *translation, *offset, scale]) or scale <= 0:
            raise RuntimeError("Scene migration found an invalid transform; restore a backup")
        # Frozen Three.js intrinsic XYZ convention; quaternion components are x,y,z,w.
        a, b, c = [math.radians(v) / 2 for v in angles]
        cx, cy, cz = math.cos(a), math.cos(b), math.cos(c)
        sx, sy, sz = math.sin(a), math.sin(b), math.sin(c)
        q = (
            sx * cy * cz + cx * sy * sz,
            cx * sy * cz - sx * cy * sz,
            cx * cy * sz + sx * sy * cz,
            cx * cy * cz - sx * sy * sz,
        )
        length = math.hypot(*q)
        x, y, z, w = [v / length for v in q]
        vx, vy, vz = [v * scale for v in offset]
        shift = (
            (1 - 2 * (y * y + z * z)) * vx + 2 * (x * y - z * w) * vy + 2 * (x * z + y * w) * vz,
            2 * (x * y + z * w) * vx + (1 - 2 * (x * x + z * z)) * vy + 2 * (y * z - x * w) * vz,
            2 * (x * z - y * w) * vx + 2 * (y * z + x * w) * vy + (1 - 2 * (x * x + y * y)) * vz,
        )
        position = [translation[i] + shift[i] for i in range(3)]
        if not all(math.isfinite(v) for v in position):
            raise RuntimeError("Scene migration transform overflow; restore a backup")
        converted.append(
            dict(
                id=row["id"],
                project_id=row["project_id"],
                parent_id=None,
                library_asset_id=row["library_asset_id"],
                library_asset_file_id=row["file_id"],
                sort_order=row["position"],
                visible=row["visible"],
                **{f"position_{axis}": value for axis, value in zip("xyz", position, strict=True)},
                **{
                    f"quaternion_{axis}": value
                    for axis, value in zip("xyzw", (x, y, z, w), strict=True)
                },
                **{f"scale_{axis}": scale for axis in "xyz"},
            )
        )
    table = op.create_table(
        "scene_objects",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("parent_id", sa.Text()),
        sa.Column(
            "library_asset_id",
            sa.Text(),
            sa.ForeignKey("library_assets.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("library_asset_file_id", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False),
        *[sa.Column(f"position_{axis}", sa.Float(), nullable=False) for axis in "xyz"],
        *[sa.Column(f"quaternion_{axis}", sa.Float(), nullable=False) for axis in "xyzw"],
        *[sa.Column(f"scale_{axis}", sa.Float(), nullable=False) for axis in "xyz"],
        sa.UniqueConstraint("project_id", "id", name="uq_scene_objects_project_id_id"),
        sa.UniqueConstraint("project_id", "sort_order", name="uq_scene_objects_order"),
        sa.ForeignKeyConstraint(
            ["project_id", "parent_id"],
            ["scene_objects.project_id", "scene_objects.id"],
            name="fk_scene_objects_parent",
            deferrable=True,
            initially="DEFERRED",
        ),
        sa.ForeignKeyConstraint(
            ["library_asset_id", "library_asset_file_id"],
            ["library_asset_files.asset_id", "library_asset_files.id"],
            name="fk_scene_objects_file",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("parent_id IS NULL OR parent_id != id", name="ck_scene_objects_parent"),
        sa.CheckConstraint(
            "scale_x > 0 AND scale_y > 0 AND scale_z > 0", name="ck_scene_objects_scale"
        ),
    )
    for name, columns in (
        ("ix_scene_objects_project_id", ["project_id"]),
        ("ix_scene_objects_library_asset_id", ["library_asset_id"]),
        ("ix_scene_objects_parent", ["project_id", "parent_id"]),
    ):
        op.create_index(name, "scene_objects", columns)
    if converted:
        op.bulk_insert(table, converted)
    op.drop_table("project_clouds")


def downgrade() -> None:
    if op.get_bind().execute(sa.text("SELECT 1 FROM scene_objects LIMIT 1")).first():
        raise RuntimeError(
            "Scene objects cannot be downgraded losslessly; restore a pre-migration backup"
        )
    op.create_table(
        "project_clouds",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "library_asset_id",
            sa.Text(),
            sa.ForeignKey("library_assets.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False),
        *[
            sa.Column(f"translation_{axis}", sa.Float(), nullable=False, server_default="0")
            for axis in "xyz"
        ],
        *[
            sa.Column(f"rotation_{axis}_deg", sa.Float(), nullable=False, server_default="0")
            for axis in "xyz"
        ],
        sa.Column("scale", sa.Float(), nullable=False, server_default="1"),
        *[
            sa.Column(f"offset_{axis}", sa.Float(), nullable=False, server_default="0")
            for axis in "xyz"
        ],
        sa.UniqueConstraint("project_id", "position", name="uq_project_cloud_position"),
    )
    op.create_index("ix_project_clouds_project_id", "project_clouds", ["project_id"])
    op.create_index("ix_project_clouds_library_asset_id", "project_clouds", ["library_asset_id"])
    op.drop_table("scene_objects")
