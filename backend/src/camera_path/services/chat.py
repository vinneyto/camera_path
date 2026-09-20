from camera_path.models import ChatHistoryMessage, Project
from camera_path.services.base import ServiceBase


class ChatMessageConflictError(RuntimeError):
    pass


class ChatService(ServiceBase):
    async def clear_chat(self, project_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.chat_history.clear()
        return await self._commit(draft, expected)

    async def save_user_message(self, project_id: str, message_id: str, content: str) -> Project:
        draft = await self.repository.get(project_id)
        existing = next(
            (message for message in draft.chat_history if message.id == message_id),
            None,
        )
        if existing is not None:
            if existing.role != "user" or existing.content != content:
                raise ChatMessageConflictError(f"chat message id {message_id} is already used")
            return draft
        expected = draft.revision
        draft.chat_history.append(ChatHistoryMessage(id=message_id, role="user", content=content))
        return await self._commit(draft, expected)
