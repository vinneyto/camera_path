from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import ChatHistoryMessage
from camera_path.persistence.models import ChatMessageRecord


class ChatMessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(self, project_id: str) -> list[ChatHistoryMessage]:
        records = await self.session.scalars(
            select(ChatMessageRecord)
            .where(ChatMessageRecord.project_id == project_id)
            .order_by(ChatMessageRecord.position)
        )
        return [
            ChatHistoryMessage(id=item.id, role=item.role, content=item.content)
            for item in records
        ]

    async def replace(self, project_id: str, messages: list[ChatHistoryMessage]) -> None:
        await self.session.execute(
            delete(ChatMessageRecord).where(ChatMessageRecord.project_id == project_id)
        )
        self.session.add_all(
            ChatMessageRecord(
                id=item.id,
                project_id=project_id,
                position=position,
                role=item.role,
                content=item.content,
            )
            for position, item in enumerate(messages)
        )
