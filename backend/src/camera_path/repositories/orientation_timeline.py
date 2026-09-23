from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import CameraOrientationKeyframe, OrientationTimeline
from camera_path.persistence.models import OrientationKeyframeRecord
from camera_path.repositories.camera_fields import orientation_columns, orientation_from_record
from camera_path.repositories.camera_track import get_or_create_camera_track


class OrientationTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> OrientationTimeline:
        track = await get_or_create_camera_track(self.session, project_id)
        records = await self.session.scalars(
            select(OrientationKeyframeRecord).where(
                OrientationKeyframeRecord.project_id == project_id
            )
        )
        return OrientationTimeline(
            default_orientation=orientation_from_record(track, "default_orientation_"),
            keyframes={
                record.id: CameraOrientationKeyframe(
                    id=record.id,
                    path_position=record.path_position,
                    orientation=orientation_from_record(record, ""),
                    interpolation_to_next=record.interpolation_to_next,
                )
                for record in records
            },
        )

    async def replace(self, project_id: str, timeline: OrientationTimeline) -> None:
        track = await get_or_create_camera_track(self.session, project_id)
        for name, value in orientation_columns(
            "default_orientation_", timeline.default_orientation
        ).items():
            setattr(track, name, value)
        await self.session.execute(
            delete(OrientationKeyframeRecord).where(
                OrientationKeyframeRecord.project_id == project_id
            )
        )
        self.session.add_all(
            OrientationKeyframeRecord(
                id=item.id,
                project_id=project_id,
                path_position=item.path_position,
                interpolation_to_next=item.interpolation_to_next,
                **orientation_columns("", item.orientation),
            )
            for item in timeline.keyframes.values()
        )
