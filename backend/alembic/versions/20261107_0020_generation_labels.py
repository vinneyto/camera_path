"""Use short automatic job names and remove image extensions from generated asset labels."""

from pathlib import PurePosixPath

import sqlalchemy as sa

from alembic import op

revision = "20261107_0020"
down_revision = "20261107_0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
        sa.column("format", sa.Text()),
        sa.column("job_id", sa.Text()),
        sa.column("job_position", sa.Integer()),
    )
    connection = op.get_bind()
    rows = connection.execute(sa.select(jobs).where(jobs.c.type == "generation")).mappings().all()
    for job in rows:
        parameters = job["input"] or {}
        outputs = (
            connection.execute(
                sa.select(assets)
                .where(
                    assets.c.job_id == job["id"],
                    assets.c.format.in_(("ply", "sog")),
                )
                .order_by(assets.c.job_position)
            )
            .mappings()
            .all()
        )
        if isinstance(parameters.get("prompt"), str):
            original_name = parameters["prompt"].strip()[:200]
            automatic_name = "_".join(parameters["prompt"].split()[:5])[:200] or None
        elif isinstance(parameters.get("image_asset_id"), str):
            original_name = connection.scalar(
                sa.select(assets.c.name).where(assets.c.id == parameters["image_asset_id"])
            )
            if original_name is None and outputs:
                candidate = outputs[0]["name"]
                if PurePosixPath(candidate).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                    original_name = candidate
            if original_name is None:
                continue
            automatic_name = PurePosixPath(original_name).stem.strip()[:200] or "image"
        else:
            continue
        name = automatic_name if job["name"] in (None, original_name) else job["name"]
        if name != job["name"]:
            connection.execute(jobs.update().where(jobs.c.id == job["id"]).values(name=name))
        output_name = automatic_name if "image_asset_id" in parameters else name
        for asset in outputs:
            if asset["name"] == original_name and output_name:
                connection.execute(
                    assets.update()
                    .where(assets.c.id == asset["id"])
                    .values(
                        name=output_name,
                    )
                )


def downgrade() -> None:
    # Labels remain valid with the previous schema; keep names instead of guessing old labels.
    pass
