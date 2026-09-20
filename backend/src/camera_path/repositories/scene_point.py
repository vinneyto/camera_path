from __future__ import annotations

from typing import Protocol

from camera_path.models import ScenePoint


class ScenePointRepository(Protocol):
    async def list(self, project_id: str) -> dict[str, ScenePoint]: ...

    async def replace(self, project_id: str, points: dict[str, ScenePoint]) -> None: ...
