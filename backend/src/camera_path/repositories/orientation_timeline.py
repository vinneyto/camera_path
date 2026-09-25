from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import CameraOrientationKeyframe, OrientationTimeline
from camera_path.persistence.enums import Interpolation
from camera_path.persistence.models import OrientationKeyframeRecord
from camera_path.repositories.camera_track import CameraTrackRepository
from camera_path.repositories.sync import sync_rows


class OrientationTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> OrientationTimeline:
        track = await CameraTrackRepository(self.session).get(project_id)
        records = await self.session.scalars(
            select(OrientationKeyframeRecord).where(
                OrientationKeyframeRecord.project_id == project_id
            )
        )
        return OrientationTimeline(
            default_orientation=track.get_default_orientation(),
            keyframes={
                record.id: CameraOrientationKeyframe(
                    id=record.id,
                    path_position=record.path_position,
                    orientation=record.get_orientation(),
                    interpolation_to_next=record.interpolation_to_next.value,
                )
                for record in records
            },
        )

    async def replace(self, project_id: str, timeline: OrientationTimeline) -> None:
        records = []
        for item in timeline.keyframes.values():
            record = OrientationKeyframeRecord(
                id=item.id,
                project_id=project_id,
                path_position=item.path_position,
                interpolation_to_next=Interpolation(item.interpolation_to_next),
            )
            record.set_orientation(item.orientation)
            records.append(record)
        await sync_rows(
            self.session,
            OrientationKeyframeRecord,
            project_id,
            records,
        )
