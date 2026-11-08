"""Persist instance names and a project-scoped, non-reusable naming sequence."""

import re

import sqlalchemy as sa

from alembic import op

revision = "20261108_0021"
down_revision = "20261107_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("scene_object_sequence", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("scene_objects", sa.Column("name", sa.Text()))
    connection = op.get_bind()
    # Preserve exactly the labels previously returned by the API, including duplicates.
    connection.execute(
        sa.text("""UPDATE scene_objects SET name = (
            SELECT name FROM library_assets WHERE library_assets.id = scene_objects.library_asset_id
        )""")
    )
    # A legacy asset can already have a numbered name; do not allocate that number again.
    counters: dict[str, int] = {}
    for project_id, name in connection.execute(
        sa.text("SELECT project_id,name FROM scene_objects")
    ):
        match = re.fullmatch(r"Gaussians ([0-9]+)", name)
        if match:
            counters[project_id] = max(counters.get(project_id, 0), int(match[1]))
    for project_id, number in counters.items():
        connection.execute(
            sa.text("UPDATE projects SET scene_object_sequence=:number WHERE id=:project_id"),
            {"project_id": project_id, "number": number},
        )
    with op.batch_alter_table("scene_objects") as batch:
        batch.alter_column("name", existing_type=sa.Text(), nullable=False)


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT 1 FROM scene_objects LIMIT 1")) or connection.scalar(
        sa.text("SELECT 1 FROM projects WHERE scene_object_sequence > 0 LIMIT 1")
    ):
        raise RuntimeError(
            "Scene object names cannot be downgraded losslessly; restore a pre-migration backup"
        )
    op.drop_column("scene_objects", "name")
    op.drop_column("projects", "scene_object_sequence")
