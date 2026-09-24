from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from camera_path.persistence.models import LibraryAssetRecord


class LibraryRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def list_ready(self) -> list[LibraryAssetRecord]:
        async with self.sessions() as session:
            return list(
                (
                    await session.scalars(
                        select(LibraryAssetRecord)
                        .where(LibraryAssetRecord.status == "ready")
                        .order_by(LibraryAssetRecord.created_at.desc())
                    )
                ).all()
            )

    async def get(self, asset_id: str) -> LibraryAssetRecord | None:
        async with self.sessions() as session:
            return await session.get(LibraryAssetRecord, asset_id)

    async def create(self, record: LibraryAssetRecord) -> None:
        async with self.sessions.begin() as session:
            session.add(record)

    async def mark_ready(self, asset_id: str) -> None:
        async with self.sessions.begin() as session:
            await session.execute(
                update(LibraryAssetRecord)
                .where(LibraryAssetRecord.id == asset_id, LibraryAssetRecord.status == "pending")
                .values(status="ready")
            )
