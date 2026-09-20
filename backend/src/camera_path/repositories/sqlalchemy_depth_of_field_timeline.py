from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import DepthOfFieldKeyframe, DepthOfFieldTimeline
from camera_path.persistence.models import DepthOfFieldKeyframeRecord


class SQLAlchemyDepthOfFieldTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> DepthOfFieldTimeline:
        records = await self.session.scalars(
            select(DepthOfFieldKeyframeRecord).where(
                DepthOfFieldKeyframeRecord.project_id == project_id
            )
        )
        return DepthOfFieldTimeline(
            keyframes={
                record.id: DepthOfFieldKeyframe.model_validate_json(record.payload)
                for record in records
            }
        )

    async def replace(self, project_id: str, timeline: DepthOfFieldTimeline) -> None:
        await self.session.execute(
            delete(DepthOfFieldKeyframeRecord).where(
                DepthOfFieldKeyframeRecord.project_id == project_id
            )
        )
        self.session.add_all(
            DepthOfFieldKeyframeRecord(
                id=item.id, project_id=project_id, payload=item.model_dump_json()
            )
            for item in timeline.keyframes.values()
        )
