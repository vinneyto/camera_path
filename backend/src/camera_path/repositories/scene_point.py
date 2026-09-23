from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import ScenePoint
from camera_path.persistence.models import ScenePointRecord, Vector3


class ScenePointRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self, project_id: str) -> dict[str, ScenePoint]:
        records = await self.session.scalars(
            select(ScenePointRecord).where(ScenePointRecord.project_id == project_id)
        )
        return {
            record.id: ScenePoint(
                id=record.id,
                label=record.label,
                position=record.position.as_tuple(),
            )
            for record in records
        }

    async def replace(self, project_id: str, points: dict[str, ScenePoint]) -> None:
        await self.session.execute(
            delete(ScenePointRecord).where(ScenePointRecord.project_id == project_id)
        )
        self.session.add_all(
            ScenePointRecord(
                id=item.id,
                project_id=project_id,
                label=item.label,
                position=Vector3(*item.position),
            )
            for item in points.values()
        )
