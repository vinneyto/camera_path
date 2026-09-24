from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import AimTimeline, CameraKeyframe
from camera_path.persistence.models import AimKeyframeRecord
from camera_path.repositories.camera_track import CameraTrackRepository
from camera_path.repositories.sync import sync_rows


class AimTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> AimTimeline:
        track = await CameraTrackRepository(self.session).get(project_id)
        records = await self.session.scalars(
            select(AimKeyframeRecord).where(AimKeyframeRecord.project_id == project_id)
        )
        return AimTimeline(
            default_aim=track.get_default_aim(),
            world_up=track.world_up.as_tuple(),
            keyframes={
                record.id: CameraKeyframe(
                    id=record.id,
                    path_position=record.path_position,
                    aim=record.get_aim(),
                    interpolation_to_next=record.interpolation_to_next,
                )
                for record in records
            },
        )

    async def replace(self, project_id: str, timeline: AimTimeline) -> None:
        records = []
        for item in timeline.keyframes.values():
            record = AimKeyframeRecord(
                id=item.id,
                project_id=project_id,
                path_position=item.path_position,
                interpolation_to_next=item.interpolation_to_next,
            )
            record.set_aim(item.aim)
            records.append(record)
        await sync_rows(
            self.session,
            AimKeyframeRecord,
            project_id,
            records,
        )
