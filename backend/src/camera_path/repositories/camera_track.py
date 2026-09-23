from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import CameraOrientation, FollowPathAim
from camera_path.persistence.models import CameraTrackRecord
from camera_path.repositories.camera_fields import aim_columns, orientation_columns


async def get_or_create_camera_track(session: AsyncSession, project_id: str) -> CameraTrackRecord:
    record = await session.get(CameraTrackRecord, project_id)
    if record is None:
        record = CameraTrackRecord(
            project_id=project_id,
            **aim_columns("default_aim", FollowPathAim()),
            world_up_x=0.0,
            world_up_y=1.0,
            world_up_z=0.0,
            **orientation_columns("default_orientation_", CameraOrientation()),
        )
        session.add(record)
    return record
