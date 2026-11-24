"""Adopt matching tables that application startup already created."""

import sqlalchemy as sa

from alembic import op


def _table_shape(table, dialect):
    return (
        {column.name: (column.type.compile(dialect), column.nullable) for column in table.columns},
        tuple(table.primary_key.columns.keys()),
        {
            tuple(constraint.columns.keys())
            for constraint in table.constraints
            if isinstance(constraint, sa.UniqueConstraint)
        },
        {
            (
                tuple((key.parent.name, key.target_fullname) for key in constraint.elements),
                constraint.ondelete,
            )
            for constraint in table.foreign_key_constraints
        },
    )


def ensure_table(name, *elements):
    context = op.get_context()
    bind = op.get_bind()
    if context.as_sql or not sa.inspect(bind).has_table(name):
        op.create_table(name, *elements)
        return

    expected = sa.Table(name, sa.MetaData(), *elements)
    actual = sa.Table(name, sa.MetaData(), autoload_with=bind, resolve_fks=False)
    if _table_shape(actual, bind.dialect) != _table_shape(expected, bind.dialect):
        raise RuntimeError(f"Existing table {name} is incompatible with this migration")


def ensure_index(name, table_name, columns, *, unique=False, where=None):
    context = op.get_context()
    if not context.as_sql:
        indexes = sa.inspect(op.get_bind()).get_indexes(table_name)
        existing = next((index for index in indexes if index["name"] == name), None)
        if existing is not None:
            predicate = existing.get("dialect_options", {}).get("sqlite_where")
            if (
                existing["column_names"] != columns
                or bool(existing["unique"]) != unique
                or str(predicate) != str(where)
            ):
                raise RuntimeError(f"Existing index {name} is incompatible with this migration")
            return

    options = {"sqlite_where": sa.text(where)} if where is not None else {}
    op.create_index(name, table_name, columns, unique=unique, **options)
