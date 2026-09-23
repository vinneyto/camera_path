from __future__ import annotations

import json

from pydantic import TypeAdapter
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import AimTimeline, CameraAim, CameraKeyframe
from camera_path.persistence.models import AimKeyframeRecord
from camera_path.repositories.camera_track import get_or_create_camera_track

_aim_adapter = TypeAdapter(CameraAim)


class AimTimelineRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, project_id: str) -> AimTimeline:
        track = await get_or_create_camera_track(self.session, project_id)
        records = await self.session.scalars(
            select(AimKeyframeRecord).where(AimKeyframeRecord.project_id == project_id)
        )
        return AimTimeline(
            default_aim=_aim_adapter.validate_json(track.default_aim),
            world_up=tuple(json.loads(track.world_up)),
            keyframes={
                record.id: CameraKeyframe.model_validate_json(record.payload)
                for record in records
            },
        )

    async def replace(self, project_id: str, timeline: AimTimeline) -> None:
        track = await get_or_create_camera_track(self.session, project_id)
        track.default_aim = _aim_adapter.dump_json(timeline.default_aim).decode()
        track.world_up = json.dumps(timeline.world_up)
        await self.session.execute(
            delete(AimKeyframeRecord).where(AimKeyframeRecord.project_id == project_id)
        )
        self.session.add_all(
            AimKeyframeRecord(id=item.id, project_id=project_id, payload=item.model_dump_json())
            for item in timeline.keyframes.values()
        )
