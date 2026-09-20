"""Create aggregate project snapshot tables.

Revision ID: 20260920_0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260920_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing = set(inspector.get_table_names())
    aggregate_tables = {"projects", "project_snapshots"}
    present = existing & aggregate_tables
    if present:
        if present != aggregate_tables:
            raise RuntimeError(
                f"legacy database has only part of the project snapshot schema: {sorted(present)}"
            )
        expected_columns = {
            "projects": {"id", "cursor"},
            "project_snapshots": {"project_id", "position", "payload"},
        }
        for table_name, expected in expected_columns.items():
            actual = {column["name"] for column in inspector.get_columns(table_name)}
            if actual != expected:
                raise RuntimeError(
                    f"legacy table {table_name} has unexpected columns: {sorted(actual)}"
                )
        return

    op.create_table(
        "projects",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("cursor", sa.Integer(), nullable=False),
        sa.CheckConstraint("cursor >= 0", name="ck_projects_cursor_non_negative"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "project_snapshots",
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_project_snapshots_position_non_negative"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "position"),
    )


def downgrade() -> None:
    op.drop_table("project_snapshots")
    op.drop_table("projects")
