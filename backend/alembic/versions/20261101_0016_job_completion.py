"""Replace producer asset identities with minimal persisted jobs."""

from uuid import uuid4

import sqlalchemy as sa

from alembic import op

revision = "20261101_0016"
down_revision = "20261101_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT COUNT(*) FROM (SELECT thumbnail_key FROM library_assets "
            "WHERE thumbnail_key IS NOT NULL GROUP BY thumbnail_key HAVING COUNT(*) > 1)"
        )
    ):
        raise RuntimeError("Repair duplicate thumbnail ownership before upgrading")
    op.create_table(
        "jobs",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    with op.batch_alter_table("library_assets") as batch:
        batch.drop_constraint("fk_library_assets_client_id", type_="foreignkey")
        batch.drop_constraint("uq_library_assets_client_id", type_="unique")
        batch.drop_column("client_id")
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
    op.drop_table("library_client_ids")
    with op.batch_alter_table("dev_queue_messages") as batch:
        batch.drop_column("asset_id")
        batch.add_column(sa.Column("job_id", sa.Text(), nullable=True))
    connection.execute(
        sa.text(
            "UPDATE dev_queue_messages SET status='failed', error_code='obsolete_message_schema', "
            "lease_token=NULL, lease_until=NULL "
            "WHERE status IN ('queued','processing') "
            "AND json_extract(body,'$.schema_version') IS NOT 2"
        )
    )
    connection.execute(
        sa.text(
            "UPDATE dev_queue_messages SET job_id=json_extract(body,'$.job_id') "
            "WHERE json_extract(body,'$.schema_version')=2"
        )
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT COUNT(*) FROM jobs")) or connection.scalar(
        sa.text("SELECT COUNT(*) FROM dev_queue_messages WHERE status IN ('queued','processing')")
    ):
        raise RuntimeError("Refusing lossy downgrade: preserve jobs/results and drain inbox")
    op.create_table(
        "library_client_ids",
        sa.Column("client_id", sa.Text(), primary_key=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("import_descriptor", sa.JSON(none_as_null=True)),
    )
    op.add_column("library_assets", sa.Column("client_id", sa.Text(), nullable=True))
    assets = sa.table("library_assets", sa.column("id"), sa.column("client_id"))
    ledger = sa.table("library_client_ids", sa.column("client_id"))
    for asset_id in connection.scalars(sa.select(assets.c.id)).all():
        identity = str(uuid4())
        connection.execute(ledger.insert().values(client_id=identity))
        connection.execute(
            assets.update().where(assets.c.id == asset_id).values(client_id=identity)
        )
    with op.batch_alter_table("library_assets") as batch:
        batch.drop_constraint("fk_library_assets_job_id", type_="foreignkey")
        batch.drop_constraint("uq_library_assets_job_position", type_="unique")
        batch.drop_constraint("uq_library_assets_thumbnail_key", type_="unique")
        batch.drop_constraint("ck_library_assets_job_position", type_="check")
        batch.drop_index("ix_library_assets_job_id")
        batch.drop_column("job_id")
        batch.drop_column("job_position")
        batch.alter_column("client_id", existing_type=sa.Text(), nullable=False)
        batch.create_unique_constraint("uq_library_assets_client_id", ["client_id"])
        batch.create_foreign_key(
            "fk_library_assets_client_id",
            "library_client_ids",
            ["client_id"],
            ["client_id"],
            ondelete="RESTRICT",
        )
    op.drop_table("jobs")
    with op.batch_alter_table("dev_queue_messages") as batch:
        batch.drop_column("job_id")
        batch.add_column(sa.Column("asset_id", sa.Text(), nullable=True))
