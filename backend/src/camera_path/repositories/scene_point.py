from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import ScenePoint
from camera_path.persistence.models import ScenePointRecord


class ScenePointRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self, project_id: str) -> dict[str, ScenePoint]:
        records = await self.session.scalars(
            select(ScenePointRecord).where(ScenePointRecord.project_id == project_id)
        )
        return {record.id: ScenePoint.model_validate_json(record.payload) for record in records}

    async def replace(self, project_id: str, points: dict[str, ScenePoint]) -> None:
        await self.session.execute(
            delete(ScenePointRecord).where(ScenePointRecord.project_id == project_id)
        )
        self.session.add_all(
            ScenePointRecord(id=item.id, project_id=project_id, payload=item.model_dump_json())
            for item in points.values()
        )
