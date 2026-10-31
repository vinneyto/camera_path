"""Library identity, representations and durable dev inbox."""

from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision = "20261101_0015"
down_revision = "20261026_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "library_client_ids",
        sa.Column("client_id", sa.Text(), primary_key=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("import_descriptor", sa.JSON(none_as_null=True)),
    )
    op.add_column("library_assets", sa.Column("client_id", sa.Text(), nullable=True))
    op.add_column("library_assets", sa.Column("thumbnail_key", sa.Text()))
    op.add_column(
        "library_assets", sa.Column("tags", sa.JSON(), nullable=False, server_default="[]")
    )
    connection = op.get_bind()
    assets = sa.table("library_assets", sa.column("id"), sa.column("client_id"))
    ledger = sa.table("library_client_ids", sa.column("client_id"))
    for asset_id in connection.scalars(sa.select(assets.c.id)).all():
        client_id = str(uuid4())
        connection.execute(ledger.insert().values(client_id=client_id))
        connection.execute(
            assets.update().where(assets.c.id == asset_id).values(client_id=client_id)
        )
    with op.batch_alter_table("library_assets") as batch:
        batch.alter_column("client_id", existing_type=sa.Text(), nullable=False)
        batch.create_unique_constraint("uq_library_assets_client_id", ["client_id"])
        batch.create_foreign_key(
            "fk_library_assets_client_id",
            "library_client_ids",
            ["client_id"],
            ["client_id"],
            ondelete="RESTRICT",
        )
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
        sa.Column("asset_id", sa.Text()),
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
    if connection.scalar(
        sa.text(
            "SELECT COUNT(*) FROM (SELECT asset_id FROM library_asset_files GROUP BY asset_id "
            "HAVING COUNT(*) > 1)"
        )
    ) or connection.scalar(
        sa.text("SELECT COUNT(*) FROM dev_queue_messages WHERE status IN ('queued','processing')")
    ):
        raise RuntimeError(
            "Refusing lossy downgrade: back up/convert multiple files and drain inbox"
        )
    op.drop_table("dev_queue_messages")
    op.drop_table("library_asset_files")
    with op.batch_alter_table("library_assets") as batch:
        batch.drop_constraint("fk_library_assets_client_id", type_="foreignkey")
        batch.drop_constraint("uq_library_assets_client_id", type_="unique")
        batch.drop_column("client_id")
        batch.drop_column("thumbnail_key")
        batch.drop_column("tags")
    op.drop_table("library_client_ids")
