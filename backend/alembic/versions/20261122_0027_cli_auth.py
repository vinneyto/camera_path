"""Store CLI device challenges and revocable, inference-only sessions."""

import sqlalchemy as sa

from alembic import op
from camera_path.persistence.migration_schema import ensure_table

revision = "20261122_0027"
down_revision = "20261115_0026"
branch_labels = None
depends_on = None


def upgrade():
    ensure_table(
        "cli_devices",
        sa.Column("device_digest", sa.Text(), primary_key=True),
        sa.Column("user_digest", sa.Text(), nullable=False, unique=True),
        sa.Column("credential_version", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("next_poll_at", sa.Integer(), nullable=False),
        sa.Column("interval", sa.Integer(), nullable=False),
        sa.Column("approved", sa.Boolean(), nullable=True),
    )
    ensure_table(
        "cli_sessions",
        sa.Column("token_digest", sa.Text(), primary_key=True),
        sa.Column("worker_id", sa.Text(), nullable=False, unique=True),
        sa.Column("credential_version", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("cli_sessions")
    op.drop_table("cli_devices")
