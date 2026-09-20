from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import CameraOrientation, CameraOrientationKeyframe, OrientationTimeline
from camera_path.persistence.models import OrientationKeyframeRecord
from camera_path.repositories.sqlalchemy_camera_track import get_or_create_camera_track


class SQLAlchemyOrientationTimelineRepository:
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
            default_orientation=CameraOrientation.model_validate_json(track.default_orientation),
            keyframes={
                record.id: CameraOrientationKeyframe.model_validate_json(record.payload)
                for record in records
            },
        )

    async def replace(self, project_id: str, timeline: OrientationTimeline) -> None:
        track = await get_or_create_camera_track(self.session, project_id)
        track.default_orientation = timeline.default_orientation.model_dump_json()
        await self.session.execute(
            delete(OrientationKeyframeRecord).where(
                OrientationKeyframeRecord.project_id == project_id
            )
        )
        self.session.add_all(
            OrientationKeyframeRecord(
                id=item.id, project_id=project_id, payload=item.model_dump_json()
            )
            for item in timeline.keyframes.values()
        )
