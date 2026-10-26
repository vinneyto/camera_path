"""Default new renderer preferences to Spark; preserve every stored choice."""

import sqlalchemy as sa

from alembic import op

revision = "20261026_0014"
down_revision = "20261011_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("user_settings") as batch:
        batch.alter_column(
            "webgpu_tile_renderer", existing_type=sa.Boolean(), server_default=sa.false()
        )


def downgrade() -> None:
    with op.batch_alter_table("user_settings") as batch:
        batch.alter_column(
            "webgpu_tile_renderer", existing_type=sa.Boolean(), server_default=sa.true()
        )
