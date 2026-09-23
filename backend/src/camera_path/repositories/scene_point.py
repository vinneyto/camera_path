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
        return {
            record.id: ScenePoint(
                id=record.id,
                label=record.label,
                position=(record.position_x, record.position_y, record.position_z),
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
                position_x=item.position[0],
                position_y=item.position[1],
                position_z=item.position[2],
            )
            for item in points.values()
        )
