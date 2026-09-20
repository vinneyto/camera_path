from __future__ import annotations

from typing import Protocol

from camera_path.models import TrajectorySegment


class TrajectoryRepository(Protocol):
    async def get(self, project_id: str) -> list[TrajectorySegment]: ...

    async def replace(self, project_id: str, segments: list[TrajectorySegment]) -> None: ...
