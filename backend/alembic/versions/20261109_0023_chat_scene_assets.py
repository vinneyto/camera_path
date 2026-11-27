"""Persist chat context, staged images and generation placement intent."""

import sqlalchemy as sa

from alembic import op

revision = "20261109_0023"
down_revision = "20261108_0022"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("chat_messages", sa.Column("context", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("scene_placement", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("request_key", sa.Text(), nullable=True))
    op.create_index("ix_jobs_request_key", "jobs", ["request_key"], unique=True)
    op.create_table(
        "chat_attachments",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("asset_id", sa.Text(), sa.ForeignKey("library_assets.id", ondelete="SET NULL")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("ready", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_chat_attachments_project_id", "chat_attachments", ["project_id"])
    op.create_index("ix_chat_attachments_asset_id", "chat_attachments", ["asset_id"])


def downgrade():
    op.drop_table("chat_attachments")
    op.drop_index("ix_jobs_request_key", "jobs")
    op.drop_column("jobs", "request_key")
    op.drop_column("jobs", "scene_placement")
    op.drop_column("chat_messages", "context")
