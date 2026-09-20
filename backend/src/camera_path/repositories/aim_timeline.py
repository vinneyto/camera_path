from __future__ import annotations

from typing import Protocol

from camera_path.models import AimTimeline


class AimTimelineRepository(Protocol):
    async def get(self, project_id: str) -> AimTimeline: ...

    async def replace(self, project_id: str, timeline: AimTimeline) -> None: ...
