"""Allow scene instances to contain client-rendered primitive descriptions."""

import sqlalchemy as sa

from alembic import op

revision = "20261112_0024"
down_revision = "20261109_0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("scene_objects") as batch:
        batch.add_column(sa.Column("primitive", sa.Text(), nullable=True))
        batch.alter_column("library_asset_id", existing_type=sa.Text(), nullable=True)
        batch.alter_column("library_asset_file_id", existing_type=sa.Text(), nullable=True)
        batch.create_check_constraint(
            "ck_scene_objects_source",
            "(primitive IS NOT NULL AND library_asset_id IS NULL AND library_asset_file_id IS NULL)"
            " OR (primitive IS NULL AND library_asset_id IS NOT NULL"
            " AND library_asset_file_id IS NOT NULL)",
        )


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(sa.text("SELECT 1 FROM scene_objects WHERE primitive IS NOT NULL"))
        .first()
    ):
        raise RuntimeError("Primitive instances require a pre-migration backup to downgrade")
    with op.batch_alter_table("scene_objects") as batch:
        batch.drop_constraint("ck_scene_objects_source", type_="check")
        batch.drop_column("primitive")
        batch.alter_column("library_asset_id", existing_type=sa.Text(), nullable=False)
        batch.alter_column("library_asset_file_id", existing_type=sa.Text(), nullable=False)
