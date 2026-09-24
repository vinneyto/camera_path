from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def sync_rows(
    session: AsyncSession,
    record_type: type,
    project_id: str,
    values: Sequence[dict[str, Any] | object],
    *,
    ordered: bool = False,
) -> None:
    """Apply a resource's changed rows without touching unrelated records."""
    values = [
        item
        if isinstance(item, dict)
        else {column.name: getattr(item, column.name) for column in record_type.__table__.columns}
        for item in values
    ]
    existing = {
        record.id: record
        for record in await session.scalars(
            select(record_type).where(record_type.project_id == project_id)
        )
    }
    wanted = {item["id"] for item in values}
    for key, record in existing.items():
        if key not in wanted:
            await session.delete(record)
    await session.flush()

    # Unique (project_id, position) constraints are checked after each UPDATE on SQLite.
    if ordered:
        moving = [
            record
            for item in values
            if (record := existing.get(item["id"])) is not None
            and record.position != item["position"]
        ]
        if moving:
            # Move all existing positions away first; new rows still receive positive positions.
            for record in existing.values():
                if record.id in wanted:
                    record.position = -record.position - 1
            await session.flush()

    for item in values:
        record = existing.get(item["id"])
        if record is None:
            session.add(record_type(**item))
        else:
            for name, value in item.items():
                if name != "id" and getattr(record, name) != value:
                    setattr(record, name, value)
