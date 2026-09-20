from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import Anchor
from camera_path.persistence.models import AnchorRecord


class SQLAlchemyAnchorRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self, project_id: str) -> dict[str, Anchor]:
        records = await self.session.scalars(
            select(AnchorRecord).where(AnchorRecord.project_id == project_id)
        )
        return {record.id: Anchor.model_validate_json(record.payload) for record in records}

    async def replace(self, project_id: str, anchors: dict[str, Anchor]) -> None:
        await self.session.execute(
            delete(AnchorRecord).where(AnchorRecord.project_id == project_id)
        )
        self.session.add_all(
            AnchorRecord(id=item.id, project_id=project_id, payload=item.model_dump_json())
            for item in anchors.values()
        )
