from camera_path.models import ChatHistoryMessage, ChatSelection, Project
from camera_path.persistence.records import SceneObjectRecord
from camera_path.repositories.chat_message import ChatMessageRepository
from camera_path.services.base import ServiceBase
from camera_path.services.chat_attachments import ChatAttachments


class ChatMessageConflictError(RuntimeError):
    pass


class ChatService(ServiceBase):
    def __init__(self, repository, library=None):
        super().__init__(repository)
        self.attachments = ChatAttachments(repository, library) if library else None

    async def selection(self, draft, selected_id):
        if selected_id is None:
            return None
        if selected_id.startswith("anchor:"):
            resource_id = selected_id.removeprefix("anchor:")
            anchor = draft.anchors.get(resource_id)
            if anchor is None:
                raise ValueError("Selected anchor no longer exists")
            return ChatSelection(
                scene_object_id=selected_id,
                kind="anchor",
                resource_id=resource_id,
                name=anchor.label,
            )
        if selected_id == "trajectory":
            return ChatSelection(
                scene_object_id=selected_id,
                kind="trajectory",
                resource_id=draft.id,
                name="Trajectory",
            )
        async with self.repository.session_factory() as session:
            obj = await session.get(SceneObjectRecord, selected_id)
            if obj is None or obj.project_id != draft.id:
                raise ValueError("Selected object no longer exists in this project")
            return ChatSelection(
                scene_object_id=selected_id, kind="model", resource_id=obj.id, name=obj.name
            )

    async def _save_chat(self, draft: Project, expected: int) -> Project:
        async with self._transaction(draft, expected) as session:
            await ChatMessageRepository(session).replace(draft.id, draft.chat_history)
        return draft

    async def clear_chat(self, project_id: str) -> Project:
        draft = await self.repository.get(project_id)
        expected = draft.revision
        draft.chat_history.clear()
        return await self._save_chat(draft, expected)

    async def save_user_message(
        self,
        project_id: str,
        message_id: str,
        content: str,
        selected_object_id=None,
        attachment_ids=None,
    ) -> Project:
        draft = await self.repository.get(project_id)
        existing = next(
            (message for message in draft.chat_history if message.id == message_id),
            None,
        )
        if existing is not None:
            if (
                existing.role != "user"
                or existing.content != content
                or (existing.selected_object.scene_object_id if existing.selected_object else None)
                != selected_object_id
                or [a.id for a in existing.attachments] != (attachment_ids or [])
            ):
                raise ChatMessageConflictError(f"chat message id {message_id} is already used")
            return draft
        expected = draft.revision
        selection = await self.selection(draft, selected_object_id)
        attachments = (
            await self.attachments.describe(project_id, attachment_ids or [])
            if self.attachments
            else []
        )
        draft.chat_history.append(
            ChatHistoryMessage(
                id=message_id,
                role="user",
                content=content,
                selected_object=selection,
                attachments=attachments,
            )
        )
        return await self._save_chat(draft, expected)
