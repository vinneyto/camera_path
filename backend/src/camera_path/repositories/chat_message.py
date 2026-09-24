from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from camera_path.models import ChatHistoryMessage
from camera_path.persistence.models import ChatMessageRecord
from camera_path.repositories.sync import sync_rows


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
            ChatHistoryMessage(id=item.id, role=item.role, content=item.content) for item in records
        ]

    async def replace(self, project_id: str, messages: list[ChatHistoryMessage]) -> None:
        await sync_rows(
            self.session,
            ChatMessageRecord,
            project_id,
            [
                dict(
                    id=item.id,
                    project_id=project_id,
                    position=position,
                    role=item.role,
                    content=item.content,
                )
                for position, item in enumerate(messages)
            ],
            ordered=True,
        )
