"""Persist the generation dispatch marker and the asset bounding box."""

import sqlalchemy as sa

from alembic import op

revision = "20261106_0018"
down_revision = "20261104_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column(
            "generation_dispatch_pending", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column("library_assets", sa.Column("bbox", sa.JSON(none_as_null=True)))


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT 1 FROM jobs WHERE generation_dispatch_pending "
                "UNION ALL SELECT 1 FROM library_assets WHERE bbox IS NOT NULL LIMIT 1"
            )
        )
        .first()
    ):
        raise RuntimeError("Refusing lossy downgrade of generation dispatch state or bounds")
    op.drop_column("library_assets", "bbox")
    op.drop_column("jobs", "generation_dispatch_pending")
