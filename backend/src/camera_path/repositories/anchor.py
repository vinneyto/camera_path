from __future__ import annotations

from typing import Protocol

from camera_path.models import Anchor


class AnchorRepository(Protocol):
    async def list(self, project_id: str) -> dict[str, Anchor]: ...

    async def replace(self, project_id: str, anchors: dict[str, Anchor]) -> None: ...
