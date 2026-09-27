"""Add library offsets and copy them to project cloud instances.

Revision ID: 20260925_0009
Revises: 20260925_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260925_0009"
down_revision: str | None = "20260925_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("library_assets") as batch:
        for axis in "xyz":
            batch.add_column(
                sa.Column(f"default_offset_{axis}", sa.Float(), nullable=False, server_default="0")
            )
    with op.batch_alter_table("project_clouds") as batch:
        for axis in "xyz":
            batch.add_column(
                sa.Column(f"offset_{axis}", sa.Float(), nullable=False, server_default="0")
            )


def downgrade() -> None:
    with op.batch_alter_table("project_clouds") as batch:
        for axis in "xyz":
            batch.drop_column(f"offset_{axis}")
    with op.batch_alter_table("library_assets") as batch:
        for axis in "xyz":
            batch.drop_column(f"default_offset_{axis}")
