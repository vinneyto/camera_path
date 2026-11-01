"""Jobs, library result representations and durable dev inbox."""

import sqlalchemy as sa

from alembic import op

revision = "20261101_0015"
down_revision = "20261026_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    with op.batch_alter_table("library_assets") as batch:
        batch.add_column(sa.Column("thumbnail_key", sa.Text()))
        batch.add_column(sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("job_id", sa.Text(), nullable=True))
        batch.add_column(sa.Column("job_position", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_library_assets_job_id", "jobs", ["job_id"], ["id"], ondelete="RESTRICT"
        )
        batch.create_unique_constraint("uq_library_assets_job_position", ["job_id", "job_position"])
        batch.create_unique_constraint("uq_library_assets_thumbnail_key", ["thumbnail_key"])
        batch.create_check_constraint(
            "ck_library_assets_job_position",
            "(job_id IS NULL AND job_position IS NULL) OR "
            "(job_id IS NOT NULL AND job_position IS NOT NULL AND job_position >= 0)",
        )
        batch.create_index("ix_library_assets_job_id", ["job_id"])
    connection = op.get_bind()
    op.create_table(
        "library_asset_files",
        sa.Column("asset_id", sa.Text(), nullable=False),
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.Text()),
        sa.PrimaryKeyConstraint("asset_id", "id"),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["library_assets.id"],
            ondelete="CASCADE",
            name="fk_library_asset_files_asset",
        ),
        sa.UniqueConstraint("object_key", name="uq_library_asset_files_object_key"),
        sa.UniqueConstraint("asset_id", "position", name="uq_library_asset_files_position"),
    )
    op.create_index(
        "uq_library_asset_files_primary",
        "library_asset_files",
        ["asset_id"],
        unique=True,
        sqlite_where=sa.text("is_primary = 1"),
    )
    connection.execute(
        sa.text(
            "INSERT INTO library_asset_files "
            "(asset_id,id,position,is_primary,format,object_key,size_bytes) "
            "SELECT id,'main',0,1,format,object_key,size_bytes FROM library_assets"
        )
    )
    op.create_table(
        "dev_queue_messages",
        sa.Column("message_id", sa.Text(), primary_key=True),
        sa.Column("body", sa.JSON(), nullable=False),
        sa.Column("body_sha256", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_token", sa.Text()),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("job_id", sa.Text()),
        sa.Column("error_code", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'processing', 'succeeded', 'failed')",
            name="ck_dev_queue_messages_status",
        ),
        sa.CheckConstraint("attempts >= 0", name="ck_dev_queue_messages_attempts"),
    )
    op.create_index("ix_dev_queue_messages_ready", "dev_queue_messages", ["status", "available_at"])
    op.create_index("ix_dev_queue_messages_lease", "dev_queue_messages", ["status", "lease_until"])


def downgrade() -> None:
    connection = op.get_bind()
    if (
        connection.scalar(sa.text("SELECT COUNT(*) FROM jobs"))
        or connection.scalar(
            sa.text(
                "SELECT COUNT(*) FROM (SELECT asset_id FROM library_asset_files GROUP BY asset_id "
                "HAVING COUNT(*) > 1)"
            )
        )
        or connection.scalar(
            sa.text(
                "SELECT COUNT(*) FROM dev_queue_messages WHERE status IN ('queued','processing')"
            )
        )
    ):
        raise RuntimeError(
            "Refusing lossy downgrade: preserve jobs/results, "
            "convert multiple files and drain inbox"
        )
    op.drop_table("dev_queue_messages")
    op.drop_table("library_asset_files")
    with op.batch_alter_table("library_assets") as batch:
        batch.drop_constraint("fk_library_assets_job_id", type_="foreignkey")
        batch.drop_constraint("uq_library_assets_job_position", type_="unique")
        batch.drop_constraint("uq_library_assets_thumbnail_key", type_="unique")
        batch.drop_constraint("ck_library_assets_job_position", type_="check")
        batch.drop_index("ix_library_assets_job_id")
        batch.drop_column("job_id")
        batch.drop_column("job_position")
        batch.drop_column("thumbnail_key")
        batch.drop_column("tags")
    op.drop_table("jobs")
