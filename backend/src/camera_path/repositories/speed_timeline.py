from __future__ import annotations

from typing import Protocol

from camera_path.models import MotionProfile


class SpeedTimelineRepository(Protocol):
    async def get(self, project_id: str) -> MotionProfile: ...

    async def replace(self, project_id: str, timeline: MotionProfile) -> None: ...
