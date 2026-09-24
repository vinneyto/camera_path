"""Add cloud instances to projects.

Revision ID: 20260924_0005
Revises: 20260923_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260924_0005"
down_revision: str | None = "20260923_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_clouds",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "library_asset_id",
            sa.Text(),
            sa.ForeignKey("library_assets.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("project_id", "position", name="uq_project_cloud_position"),
    )
    op.create_index("ix_project_clouds_project_id", "project_clouds", ["project_id"])
    op.create_index("ix_project_clouds_library_asset_id", "project_clouds", ["library_asset_id"])


def downgrade() -> None:
    op.drop_index("ix_project_clouds_library_asset_id", table_name="project_clouds")
    op.drop_index("ix_project_clouds_project_id", table_name="project_clouds")
    op.drop_table("project_clouds")
