from __future__ import annotations

from typing import Protocol

from camera_path.models import OrientationTimeline


class OrientationTimelineRepository(Protocol):
    async def get(self, project_id: str) -> OrientationTimeline: ...

    async def replace(self, project_id: str, timeline: OrientationTimeline) -> None: ...
