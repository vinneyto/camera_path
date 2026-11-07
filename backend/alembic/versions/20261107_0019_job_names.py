"""Snapshot generation job names independently of the lifetime of their source assets."""

import sqlalchemy as sa

from alembic import op

revision = "20261107_0019"
down_revision = "20261106_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("name", sa.Text()))
    jobs = sa.table(
        "jobs",
        sa.column("id", sa.Text()),
        sa.column("type", sa.Text()),
        sa.column("input", sa.JSON()),
        sa.column("name", sa.Text()),
    )
    assets = sa.table(
        "library_assets",
        sa.column("id", sa.Text()),
        sa.column("name", sa.Text()),
        sa.column("job_id", sa.Text()),
        sa.column("job_position", sa.Integer()),
    )
    connection = op.get_bind()
    for job in connection.execute(
        sa.select(jobs.c.id, jobs.c.input).where(jobs.c.type == "generation")
    ).mappings():
        parameters = job["input"] or {}
        name = None
        if isinstance(parameters.get("prompt"), str):
            name = parameters["prompt"].strip()[:200] or None
        elif isinstance(parameters.get("image_asset_id"), str):
            name = connection.scalar(
                sa.select(assets.c.name).where(assets.c.id == parameters["image_asset_id"])
            )
            # Image outputs used the original image name before jobs had a name.
            if name is None:
                name = connection.scalar(
                    sa.select(assets.c.name)
                    .where(assets.c.job_id == job["id"])
                    .order_by(assets.c.job_position)
                    .limit(1)
                )
            name = name[:200] if name else None
        if name is not None:
            connection.execute(jobs.update().where(jobs.c.id == job["id"]).values(name=name))


def downgrade() -> None:
    if op.get_bind().scalar(sa.text("SELECT 1 FROM jobs WHERE name IS NOT NULL LIMIT 1")):
        raise RuntimeError("Refusing lossy downgrade: preserve job names")
    op.drop_column("jobs", "name")
