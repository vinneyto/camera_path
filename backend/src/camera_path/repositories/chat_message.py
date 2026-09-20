from __future__ import annotations

from typing import Protocol

from camera_path.models import ChatHistoryMessage


class ChatMessageRepository(Protocol):
    async def list(self, project_id: str) -> list[ChatHistoryMessage]: ...

    async def replace(self, project_id: str, messages: list[ChatHistoryMessage]) -> None: ...
