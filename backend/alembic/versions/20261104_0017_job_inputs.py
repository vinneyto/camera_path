"""Add typed input and explicit lifecycle without inventing legacy job metadata."""

import sqlalchemy as sa

from alembic import op

revision = "20261104_0017"
down_revision = "20261104_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("jobs") as batch:
        batch.add_column(sa.Column("type", sa.Text()))
        batch.add_column(sa.Column("input", sa.JSON(none_as_null=True)))
        batch.add_column(sa.Column("status", sa.String(9), nullable=False, server_default="draft"))
        batch.add_column(sa.Column("error", sa.JSON(none_as_null=True)))
        batch.add_column(sa.Column("created_at", sa.DateTime(timezone=True)))
        batch.add_column(sa.Column("started_at", sa.DateTime(timezone=True)))
    op.execute("UPDATE jobs SET status='succeeded' WHERE completed_at IS NOT NULL")
    with op.batch_alter_table("jobs") as batch:
        batch.create_check_constraint(
            "ck_jobs_status",
            "status IN ('draft','queued','running','succeeded','failed','cancelled')",
        )
        batch.create_check_constraint(
            "ck_jobs_input_type",
            "(type IS NULL AND input IS NULL) OR (type IS NOT NULL AND input IS NOT NULL)",
        )
        batch.create_check_constraint(
            "ck_jobs_completion",
            "(status IN ('succeeded','failed','cancelled') AND completed_at IS NOT NULL) OR "
            "(status IN ('draft','queued','running') AND completed_at IS NULL)",
        )


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT 1 FROM jobs WHERE type IS NOT NULL OR input IS NOT NULL "
                "OR error IS NOT NULL "
                "OR created_at IS NOT NULL OR started_at IS NOT NULL "
                "OR status NOT IN ('draft','succeeded') LIMIT 1"
            )
        )
        .first()
    ):
        raise RuntimeError("Refusing lossy downgrade: preserve job inputs and lifecycle metadata")
    with op.batch_alter_table("jobs") as batch:
        for name in ("ck_jobs_status", "ck_jobs_input_type", "ck_jobs_completion"):
            batch.drop_constraint(name, type_="check")
        for name in ("type", "input", "status", "error", "created_at", "started_at"):
            batch.drop_column(name)
