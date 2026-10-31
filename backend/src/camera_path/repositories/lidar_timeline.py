from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import LidarKeyframe, LidarTimeline
from camera_path.persistence.records import LidarKeyframeRecord


class LidarTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> LidarTimeline:
        record = await self.session.get(LidarKeyframeRecord, project_id)
        return LidarTimeline(
            lidar_keyframe=None
            if record is None
            else LidarKeyframe(
                id=record.id,
                vertical_fov_deg=record.vertical_fov_deg,
                horizontal_resolution=record.horizontal_resolution,
                vertical_resolution=record.vertical_resolution,
            )
        )

    async def replace(self, project_id: str, timeline: LidarTimeline) -> None:
        record = await self.session.get(LidarKeyframeRecord, project_id)
        item = timeline.lidar_keyframe
        if item is None:
            if record is not None:
                await self.session.delete(record)
            return
        if record is None:
            record = LidarKeyframeRecord(project_id=project_id)
            self.session.add(record)
        record.id = item.id
        record.vertical_fov_deg = item.vertical_fov_deg
        record.horizontal_resolution = item.horizontal_resolution
        record.vertical_resolution = item.vertical_resolution
