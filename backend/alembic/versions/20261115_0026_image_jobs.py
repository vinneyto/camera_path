"""Persist the selected image provider, configuration and execution checkpoint."""

import sqlalchemy as sa

from alembic import op

revision = "20261115_0026"
down_revision = "20261112_0025"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("jobs", sa.Column("execution", sa.JSON(none_as_null=True), nullable=True))


def downgrade():
    op.drop_column("jobs", "execution")
