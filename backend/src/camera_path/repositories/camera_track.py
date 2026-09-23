from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import CameraOrientation, FollowPathAim
from camera_path.persistence.models import CameraTrackRecord


async def get_or_create_camera_track(
    session: AsyncSession, project_id: str
) -> CameraTrackRecord:
    record = await session.get(CameraTrackRecord, project_id)
    if record is None:
        record = CameraTrackRecord(
            project_id=project_id,
            default_aim=FollowPathAim().model_dump_json(),
            world_up="[0.0,1.0,0.0]",
            default_orientation=CameraOrientation().model_dump_json(),
        )
        session.add(record)
    return record
