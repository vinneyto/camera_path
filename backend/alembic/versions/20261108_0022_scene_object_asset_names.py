"""Restore library names in labels created by the initial numbered-names implementation."""

import re

import sqlalchemy as sa

from alembic import op

revision = "20261108_0022"
down_revision = "20261108_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    rows = (
        connection.execute(
            sa.text("""SELECT scene_objects.id, scene_objects.name,
            library_assets.name AS asset_name, projects.scene_object_sequence AS sequence
            FROM scene_objects
            JOIN library_assets ON library_assets.id = scene_objects.library_asset_id
            JOIN projects ON projects.id = scene_objects.project_id""")
        )
        .mappings()
        .all()
    )
    for row in rows:
        match = re.fullmatch(r"Gaussians ([0-9]{2,19})", row["name"])
        if not match or row["name"] == row["asset_name"]:
            continue
        number = int(match[1])
        if number > row["sequence"] or row["name"] != f"Gaussians {number:02d}":
            continue
        connection.execute(
            sa.text("UPDATE scene_objects SET name=:name WHERE id=:id"),
            {"id": row["id"], "name": f"{row['asset_name']} {number:02d}"},
        )


def downgrade() -> None:
    # Names remain valid with the previous schema; preserve the descriptive labels.
    pass
