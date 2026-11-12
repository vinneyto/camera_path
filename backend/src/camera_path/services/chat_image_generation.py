"""Image generation/editing produces staged originals, never ready library items."""

import base64
from datetime import UTC, datetime
from io import BytesIO

from openai import AsyncOpenAI
from PIL import Image

from camera_path.persistence.records import (
    ChatAttachmentRecord,
    LibraryAssetFileRecord,
    LibraryAssetRecord,
)
from camera_path.services.io import blocking_io
from camera_path.services.library import MAX_IMAGE_BYTES


class ChatImageGeneration:
    def __init__(self, attachments, api_key, model):
        self.attachments, self.api_key, self.model = attachments, api_key, model

    async def existing(self, project_id, attachment_id):
        async with self.attachments.sessions() as session:
            row = await session.get(ChatAttachmentRecord, attachment_id)
            if row and row.project_id == project_id and row.ready:
                return self.attachments.model(row)
        return None

    async def generate(self, project_id, attachment_id, parameters):
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not configured")
        common = dict(
            model=self.model,
            prompt=parameters["prompt"],
            background="transparent",
            output_format="png",
            size="1024x1024",
            quality="medium",
            n=1,
        )
        # Do not automatically repeat a billable request whose outcome is unknown.
        async with AsyncOpenAI(api_key=self.api_key, max_retries=0, timeout=300) as client:
            source = parameters.get("source_attachment_id")
            if source:
                raw, media = await self.attachments.content(project_id, source)
                response = await client.images.edit(image=("source.png", raw, media), **common)
            else:
                response = await client.images.generate(**common)
        encoded = response.data[0].b64_json if response.data else None
        if not encoded or len(encoded) > 4 * (MAX_IMAGE_BYTES + 2) // 3 + 4:
            raise ValueError("Image provider returned no image or an oversized image")
        raw = base64.b64decode(encoded, validate=True)
        await blocking_io(lambda: self.validate(raw))
        name = parameters.get("name") or "Generated image"
        stem = name[:-4] if name.lower().endswith(".png") else name
        return await self.save(project_id, attachment_id, stem[:196] + ".png", raw)

    @staticmethod
    def validate(raw):
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError("Generated image exceeds size limit")
        with Image.open(BytesIO(raw)) as image:
            if image.format != "PNG":
                raise ValueError("Expected a PNG image")
            if image.width * image.height > 40_000_000:
                raise ValueError("Generated image dimensions exceed size limit")
            alpha = image.convert("RGBA").getchannel("A")
            if alpha.getextrema()[0] == 255:
                raise ValueError("Image provider returned an opaque background")

    async def save(self, project_id, attachment_id, name, raw):
        key = f"{attachment_id}.png"
        storage = self.attachments.library.storage

        def write():
            try:
                storage.write_object(key, BytesIO(raw))
            except FileExistsError:
                with storage.open_reader(key) as stream:
                    if stream.read(MAX_IMAGE_BYTES + 1) != raw:
                        raise ValueError("Generated image identity conflict") from None

        await blocking_io(write)
        async with self.attachments.sessions.begin() as session:
            record = await session.get(ChatAttachmentRecord, attachment_id)
            if record is None:
                asset = LibraryAssetRecord(
                    id=attachment_id,
                    name=name,
                    format="png",
                    object_key=key,
                    size_bytes=len(raw),
                    status="pending",
                    created_at=datetime.now(UTC),
                    tags=[],
                    files=[
                        LibraryAssetFileRecord(
                            id="main",
                            position=0,
                            is_primary=True,
                            object_key=key,
                            format="png",
                            size_bytes=len(raw),
                        )
                    ],
                )
                session.add(asset)
                await session.flush()
                record = ChatAttachmentRecord(
                    id=attachment_id,
                    project_id=project_id,
                    asset_id=attachment_id,
                    name=name,
                    format="png",
                    ready=True,
                )
                session.add(record)
                await session.flush()
            return self.attachments.model(record)
