"""Chat images remain staged until the agent explicitly publishes a library item."""

from fastapi import HTTPException

from camera_path.models import ChatAttachment
from camera_path.persistence.records import ChatAttachmentRecord, LibraryAssetRecord
from camera_path.services.io import blocking_io
from camera_path.services.library import IMAGE_FORMATS


class ChatAttachments:
    def __init__(self, repository, library):
        self.repository, self.library = repository, library
        self.sessions = repository.session_factory

    async def create(self, project_id, data, request):
        await self.repository.get(project_id)
        if data.format not in IMAGE_FORMATS:
            raise HTTPException(422, "Chat attachments must be PNG, JPEG or WebP images")
        upload = await self.library.create(data, request)
        async with self.sessions.begin() as session:
            session.add(
                ChatAttachmentRecord(
                    id=upload.id,
                    project_id=project_id,
                    asset_id=upload.id,
                    name=upload.name,
                    format=upload.format,
                    ready=False,
                )
            )
        return upload

    async def record(self, session, project_id, attachment_id):
        record = await session.get(ChatAttachmentRecord, attachment_id)
        if record is None or record.project_id != project_id:
            raise HTTPException(404, "Chat attachment not found in this project")
        return record

    @staticmethod
    def model(record, *, published=False):
        return ChatAttachment(
            id=record.id,
            name=record.name,
            format=record.format,
            url=f"/api/v1/projects/{record.project_id}/chat/attachments/{record.id}/content",
            library_asset_id=record.asset_id if published else None,
        )

    async def complete(self, project_id, attachment_id):
        async with self.sessions.begin() as session:
            record = await self.record(session, project_id, attachment_id)
            asset = (
                await session.get(LibraryAssetRecord, record.asset_id) if record.asset_id else None
            )
            if asset is None:
                raise HTTPException(404, "Attachment file was removed")
            if not record.ready:
                if not await self.library.storage.finalize_upload(
                    asset.object_key, asset.size_bytes
                ):
                    raise HTTPException(422, "Uploaded image is missing, incomplete or invalid")
                await blocking_io(lambda: self.library._validate_image(asset))
                record.ready = True
        return self.model(record, published=asset.status == "ready")

    async def describe(self, project_id, ids):
        if len(set(ids)) != len(ids):
            raise ValueError("Duplicate chat attachments")
        async with self.sessions() as session:
            result = []
            for attachment_id in ids:
                record = await self.record(session, project_id, attachment_id)
                if not record.ready or record.asset_id is None:
                    raise ValueError("Chat attachment is not ready or was removed")
                result.append(self.model(record))
            return result

    async def content(self, project_id, attachment_id):
        async with self.sessions() as session:
            record = await self.record(session, project_id, attachment_id)
            asset = (
                await session.get(LibraryAssetRecord, record.asset_id) if record.asset_id else None
            )
            if not record.ready or asset is None:
                raise HTTPException(404, "Chat image was removed")
            key = asset.object_key

        def read():
            with self.library.storage.open_reader(key) as stream:
                return stream.read()

        return await blocking_io(
            read
        ), f"image/{'jpeg' if record.format == 'jpg' else record.format}"

    async def publish(self, project_id, attachment_id, name, request):
        async with self.sessions() as session:
            record = await self.record(session, project_id, attachment_id)
            if not record.ready or record.asset_id is None:
                raise ValueError("Attachment is not available")
            asset_id = record.asset_id
        # complete is idempotent; retrying a chat tool does not create another image.
        return await self.library.complete(asset_id, request)
