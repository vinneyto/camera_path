"""Static, singleton LiDAR presence timeline."""

import sqlalchemy as sa

from alembic import op

revision = "20261011_0012"
down_revision = "20261006_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lidar_keyframes",
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("vertical_fov_deg", sa.Float(), nullable=False),
        sa.Column("horizontal_resolution", sa.Integer(), nullable=False),
        sa.Column("vertical_resolution", sa.Integer(), nullable=False),
        sa.CheckConstraint("vertical_fov_deg > 0 AND vertical_fov_deg < 180", name="ck_lidar_fov"),
        sa.CheckConstraint("horizontal_resolution BETWEEN 1 AND 4096", name="ck_lidar_width"),
        sa.CheckConstraint("vertical_resolution BETWEEN 1 AND 256", name="ck_lidar_height"),
    )


def downgrade() -> None:
    op.drop_table("lidar_keyframes")
