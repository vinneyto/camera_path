"""Store library defaults and independent project cloud transforms.

Revision ID: 20260924_0007
Revises: 20260924_0006
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_0007"
down_revision: str | None = "20260924_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("library_assets") as batch:
        for axis in "xyz":
            batch.add_column(
                sa.Column(
                    f"default_rotation_{axis}_deg", sa.Float(), nullable=False, server_default="0"
                )
            )
        batch.add_column(sa.Column("default_scale", sa.Float(), nullable=False, server_default="1"))
    with op.batch_alter_table("project_clouds") as batch:
        for axis in "xyz":
            batch.add_column(
                sa.Column(f"translation_{axis}", sa.Float(), nullable=False, server_default="0")
            )
            batch.add_column(
                sa.Column(f"rotation_{axis}_deg", sa.Float(), nullable=False, server_default="0")
            )
        batch.add_column(sa.Column("scale", sa.Float(), nullable=False, server_default="1"))


def downgrade() -> None:
    with op.batch_alter_table("project_clouds") as batch:
        batch.drop_column("scale")
        for axis in "xyz":
            batch.drop_column(f"rotation_{axis}_deg")
            batch.drop_column(f"translation_{axis}")
    with op.batch_alter_table("library_assets") as batch:
        batch.drop_column("default_scale")
        for axis in "xyz":
            batch.drop_column(f"default_rotation_{axis}_deg")
