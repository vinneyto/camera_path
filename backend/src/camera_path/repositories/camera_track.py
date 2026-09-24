from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import CameraAim, CameraOrientation, CameraTrack
from camera_path.persistence.models import CameraTrackRecord, Vector3


class CameraTrackRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, project_id: str, value: CameraTrack) -> None:
        record = CameraTrackRecord(project_id=project_id, world_up=Vector3(*value.world_up))
        record.set_default_aim(value.default_aim)
        record.set_default_orientation(value.default_orientation)
        self.session.add(record)
        await self.session.flush()

    async def get(self, project_id: str) -> CameraTrackRecord:
        record = await self.session.get(CameraTrackRecord, project_id)
        if record is None:
            raise LookupError(f"camera track missing for project {project_id}")
        return record

    async def set_aim(
        self, project_id: str, aim: CameraAim, world_up: tuple[float, float, float]
    ) -> None:
        record = await self.get(project_id)
        record.set_default_aim(aim)
        record.world_up = Vector3(*world_up)

    async def set_orientation(self, project_id: str, orientation: CameraOrientation) -> None:
        record = await self.get(project_id)
        record.set_default_orientation(orientation)
