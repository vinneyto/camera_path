"""Single editor credentials and revocable JWT sessions."""

import sqlalchemy as sa

from alembic import op

revision = "20261006_0011"
down_revision = "20261005_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_settings", sa.Column("gaussian_dpr", sa.Text(), nullable=False, server_default="1x")
    )
    op.create_table(
        "editors",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("credential_version", sa.Text(), nullable=False),
    )
    op.create_table(
        "editor_sessions",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "gaussian_dpr")
    op.drop_table("editor_sessions")
    op.drop_table("editors")
