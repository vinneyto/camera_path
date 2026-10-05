"""Store profile settings independently of projects."""

import sqlalchemy as sa

from alembic import op

revision = "20261005_0010"
down_revision = "20260925_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Text(), primary_key=True),
        sa.Column("webgpu_tile_renderer", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("show_grid", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_table("user_settings")
