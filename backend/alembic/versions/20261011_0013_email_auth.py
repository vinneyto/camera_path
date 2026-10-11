"""Persist email challenges and authentication throttles; preserve existing credentials."""

import sqlalchemy as sa

from alembic import op

revision = "20261011_0013"
down_revision = "20261011_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_challenges",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("credential_version", sa.Text(), nullable=False),
        sa.Column("code_digest", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("resend_at", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("delivered", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "auth_rate_limits",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )
    # Revoke existing password-only sessions when enabling email confirmation.
    op.execute("DELETE FROM editor_sessions")


def downgrade() -> None:
    op.drop_table("auth_rate_limits")
    op.drop_table("auth_challenges")
