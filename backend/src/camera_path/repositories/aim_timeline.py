from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import AimTimeline, CameraKeyframe
from camera_path.persistence.models import AimKeyframeRecord, Vector3
from camera_path.repositories.camera_fields import aim_columns, aim_from_record
from camera_path.repositories.camera_track import get_or_create_camera_track


class AimTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> AimTimeline:
        track = await get_or_create_camera_track(self.session, project_id)
        records = await self.session.scalars(
            select(AimKeyframeRecord).where(AimKeyframeRecord.project_id == project_id)
        )
        return AimTimeline(
            default_aim=aim_from_record(track, "default_aim"),
            world_up=track.world_up.as_tuple(),
            keyframes={
                record.id: CameraKeyframe(
                    id=record.id,
                    path_position=record.path_position,
                    aim=aim_from_record(record, "aim"),
                    interpolation_to_next=record.interpolation_to_next,
                )
                for record in records
            },
        )

    async def replace(self, project_id: str, timeline: AimTimeline) -> None:
        track = await get_or_create_camera_track(self.session, project_id)
        for name, value in aim_columns("default_aim", timeline.default_aim).items():
            setattr(track, name, value)
        track.world_up = Vector3(*timeline.world_up)
        await self.session.execute(
            delete(AimKeyframeRecord).where(AimKeyframeRecord.project_id == project_id)
        )
        self.session.add_all(
            AimKeyframeRecord(
                id=item.id,
                project_id=project_id,
                path_position=item.path_position,
                interpolation_to_next=item.interpolation_to_next,
                **aim_columns("aim", item.aim),
            )
            for item in timeline.keyframes.values()
        )
