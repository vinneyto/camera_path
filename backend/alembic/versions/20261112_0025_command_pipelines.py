"""Persist linear agent command definitions and execution checkpoints."""

import sqlalchemy as sa

from alembic import op

revision = "20261112_0025"
down_revision = "20261112_0024"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "command_pipelines",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message_id", sa.Text(), nullable=False),
        sa.Column("request_key", sa.Text(), nullable=False, unique=True),
        sa.Column("definition", sa.JSON(), nullable=False),
        sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("context", sa.JSON(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("lease_owner", sa.Text()),
        sa.Column("lease_until", sa.Float(), nullable=False),
    )
    op.create_index("ix_command_pipelines_project_id", "command_pipelines", ["project_id"])
    op.create_index("ix_command_pipelines_status", "command_pipelines", ["status"])
    op.create_table(
        "pipeline_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Text(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "pipeline_id",
            sa.Text(),
            sa.ForeignKey("command_pipelines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_pipeline_events_project_id", "pipeline_events", ["project_id"])


def downgrade():
    op.drop_table("pipeline_events")
    op.drop_table("command_pipelines")
