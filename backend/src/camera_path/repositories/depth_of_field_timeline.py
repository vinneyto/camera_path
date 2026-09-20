from __future__ import annotations

from typing import Protocol

from camera_path.models import DepthOfFieldTimeline


class DepthOfFieldTimelineRepository(Protocol):
    async def get(self, project_id: str) -> DepthOfFieldTimeline: ...

    async def replace(self, project_id: str, timeline: DepthOfFieldTimeline) -> None: ...
