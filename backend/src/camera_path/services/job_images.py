"""Validate and atomically attach a generated image to its durable job."""

from datetime import UTC, datetime
from io import BytesIO
from uuid import NAMESPACE_URL, uuid5

from PIL import Image
from sqlalchemy import text

from camera_path.persistence.enums import JobStatus
from camera_path.persistence.records import (
    ChatAttachmentRecord,
    JobRecord,
    LibraryAssetFileRecord,
    LibraryAssetRecord,
)
from camera_path.services.io import blocking_io
from camera_path.services.library import MAX_IMAGE_BYTES

ACTIVE = (JobStatus.QUEUED, JobStatus.RUNNING)


class JobImages:
    def __init__(self, jobs):
        self.jobs = jobs
        self.sessions = jobs.sessions
        self.storage = jobs.library.storage

    @staticmethod
    def validate(raw):
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError("Generated image exceeds size limit")
        with Image.open(BytesIO(raw)) as image:
            if image.format != "PNG" or image.width * image.height > 40_000_000:
                raise ValueError("Expected a PNG image within the size limit")
            image.load()
            low, high = image.convert("RGBA").getchannel("A").getextrema()
            if low == 255 or high == 0:
                raise ValueError(
                    "Generated image must contain a subject and a transparent background"
                )

    @staticmethod
    def asset_id(job):
        chat = (job.execution or {}).get("chat")
        return chat["attachment_id"] if chat else str(uuid5(NAMESPACE_URL, f"image-job:{job.id}"))

    async def saved(self, job_id):
        async with self.sessions() as session:
            job = await session.get(JobRecord, job_id)
            key = self.asset_id(job) + ".png"

        def read():
            try:
                with self.storage.open_reader(key) as stream:
                    return stream.read(MAX_IMAGE_BYTES + 1)
            except FileNotFoundError:
                return None

        return await blocking_io(read)

    async def complete(self, job_id, raw):
        await blocking_io(lambda: self.validate(raw))
        async with self.sessions() as session:
            job = await session.get(JobRecord, job_id)
            if job.status not in ACTIVE:
                return
            asset_id = self.asset_id(job)
        key = asset_id + ".png"

        def write():
            try:
                self.storage.write_object(key, BytesIO(raw))
            except FileExistsError:
                with self.storage.open_reader(key) as stream:
                    if stream.read(MAX_IMAGE_BYTES + 1) != raw:
                        raise ValueError("Generated image identity conflict") from None

        await blocking_io(write)
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            job = await session.get(JobRecord, job_id)
            if job.status not in ACTIVE:
                return
            await self.publish(session, job, asset_id, key, len(raw))

    async def publish(self, session, job, asset_id, key, size):
        """Publish immutable image bytes using the caller's fenced transaction."""
        chat = (job.execution or {}).get("chat")
        stem = job.name or "Generated image"
        if stem.lower().endswith(".png"):
            stem = stem[:-4]
        name = stem[:196] + ".png"
        asset = LibraryAssetRecord(
            id=asset_id,
            job_id=job.id,
            job_position=0,
            name=name,
            format="png",
            object_key=key,
            size_bytes=size,
            status="pending" if chat else "ready",
            created_at=datetime.now(UTC),
            tags=[],
            files=[
                LibraryAssetFileRecord(
                    id="main",
                    position=0,
                    is_primary=True,
                    object_key=key,
                    format="png",
                    size_bytes=size,
                )
            ],
        )
        session.add(asset)
        await session.flush()
        if chat:
            session.add(
                ChatAttachmentRecord(
                    id=asset_id,
                    project_id=chat["project_id"],
                    asset_id=asset_id,
                    name=name,
                    format="png",
                    ready=True,
                )
            )
        job.status = JobStatus.SUCCEEDED
        job.completed_at = datetime.now(UTC)
        job.error = None
        job.generation_dispatch_pending = False
        job.execution = {**(job.execution or {}), "phase": "completed"}
        return {
            "job_id": job.id,
            "status": JobStatus.SUCCEEDED,
            "asset_ids": [] if chat else [asset_id],
            "attachment_id": asset_id if chat else None,
        }
