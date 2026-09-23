from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import MotionProfile, SpeedKeyframe
from camera_path.persistence.models import MotionProfileRecord, SpeedKeyframeRecord


class SpeedTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> MotionProfile:
        profile = await self.session.get(MotionProfileRecord, project_id)
        if profile is None:
            return MotionProfile()
        records = await self.session.scalars(
            select(SpeedKeyframeRecord).where(SpeedKeyframeRecord.project_id == project_id)
        )
        keyframes = {
            record.id: SpeedKeyframe.model_validate_json(record.payload) for record in records
        }
        return MotionProfile(default_speed=profile.default_speed, keyframes=keyframes)

    async def replace(self, project_id: str, timeline: MotionProfile) -> None:
        profile = await self.session.get(MotionProfileRecord, project_id)
        if profile is None:
            self.session.add(
                MotionProfileRecord(project_id=project_id, default_speed=timeline.default_speed)
            )
        else:
            profile.default_speed = timeline.default_speed
        await self.session.execute(
            delete(SpeedKeyframeRecord).where(SpeedKeyframeRecord.project_id == project_id)
        )
        self.session.add_all(
            SpeedKeyframeRecord(id=item.id, project_id=project_id, payload=item.model_dump_json())
            for item in timeline.keyframes.values()
        )
