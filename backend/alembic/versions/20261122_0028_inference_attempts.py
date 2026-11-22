"""Add durable CLI attempt and artifact reservations."""

import sqlalchemy as sa

from alembic import op

revision = "20261122_0028"
down_revision = "20261122_0027"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "inference_attempts",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "job_id", sa.Text(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("worker_id", sa.Text(), nullable=False),
        sa.Column("claim_id", sa.Text(), nullable=False),
        sa.Column("lease_expires_at", sa.Float(), nullable=False),
        sa.Column("state", sa.Text(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("terminal_hash", sa.Text()),
        sa.Column("terminal_result", sa.JSON(none_as_null=True)),
        sa.UniqueConstraint("worker_id", "claim_id", name="uq_inference_claim"),
        sa.UniqueConstraint("job_id", "ordinal", name="uq_inference_attempt_ordinal"),
    )
    for key in ("job", "worker"):
        op.create_index(
            f"uq_inference_active_{key}",
            "inference_attempts",
            [f"{key}_id"],
            unique=True,
            sqlite_where=sa.text("state = 'active'"),
        )
    op.create_index("ix_inference_expiry", "inference_attempts", ["state", "lease_expires_at"])
    op.create_table(
        "inference_uploads",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "job_id", sa.Text(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("attempt_id", sa.Text(), nullable=False),
        sa.Column("file_id", sa.Text(), nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=False),
        sa.UniqueConstraint("attempt_id", "file_id", name="uq_inference_upload_file"),
    )


def downgrade():
    op.drop_table("inference_uploads")
    op.drop_table("inference_attempts")
