from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import MotionProfile, SpeedKeyframe
from camera_path.persistence.enums import Interpolation
from camera_path.persistence.models import MotionProfileRecord, SpeedKeyframeRecord
from camera_path.repositories.sync import sync_rows


class SpeedTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> MotionProfile:
        profile = await self.session.get(MotionProfileRecord, project_id)
        if profile is None:
            raise LookupError(f"motion profile missing for project {project_id}")
        records = await self.session.scalars(
            select(SpeedKeyframeRecord).where(SpeedKeyframeRecord.project_id == project_id)
        )
        keyframes = {
            record.id: SpeedKeyframe(
                id=record.id,
                path_position=record.path_position,
                speed=record.speed,
                interpolation_to_next=record.interpolation_to_next.value,
            )
            for record in records
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
        await sync_rows(
            self.session,
            SpeedKeyframeRecord,
            project_id,
            [
                dict(
                    id=item.id,
                    project_id=project_id,
                    path_position=item.path_position,
                    speed=item.speed,
                    interpolation_to_next=Interpolation(item.interpolation_to_next),
                )
                for item in timeline.keyframes.values()
            ],
        )
