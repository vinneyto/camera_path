"""Durable 2D jobs; adapters deliver PNGs through the same persisted lifecycle."""

import asyncio
import hashlib
import logging
import time
from contextlib import suppress
from datetime import UTC, datetime
from io import BytesIO
from urllib.parse import unquote, urlsplit
from uuid import uuid4

from sqlalchemy import func, select, text

from camera_path.persistence.enums import JobStatus
from camera_path.persistence.records import JobRecord, LibraryAssetRecord
from camera_path.services.image_generation_models import (
    ImageGenerationManifest,
    ImageGenerationRequest,
    ImageWorkerInput,
)
from camera_path.services.io import blocking_io
from camera_path.services.job_images import ACTIVE, JobImages
from camera_path.services.library import MAX_IMAGE_BYTES
from camera_path.services.library_metadata import LibraryError

logger = logging.getLogger(__name__)
LEASE_SECONDS = 90


class ImageJobs:
    def __init__(self, jobs, generate, *, queue=None, source=None):
        self.jobs, self.generate = jobs, generate
        self.sessions = jobs.sessions
        self.images = JobImages(jobs)
        self.queue, self.source = queue, source
        self.pipelines = None

    async def _notify(self, job_id, phase):
        if self.pipelines is not None:
            await self.pipelines.job_phase(job_id, phase)

    async def fail(self, job_id, code, message):
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            job = await session.get(JobRecord, job_id)
            if job is not None and job.type == "image_generation" and job.status in ACTIVE:
                job.status = JobStatus.FAILED
                job.error = {"code": code, "message": message[:1000]}
                job.completed_at = datetime.now(UTC)
                job.generation_dispatch_pending = False
                job.execution = {**(job.execution or {}), "phase": "failed"}

    async def _patch(self, job_id, owner, *, phase=None, release=False):
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            job = await session.get(JobRecord, job_id)
            if job is None or (job.execution or {}).get("lease_owner") != owner:
                raise ValueError("Image job lease was lost")
            patch = {"lease_until": 0 if release else time.time() + LEASE_SECONDS}
            if release:
                patch["lease_owner"] = None
            if phase is not None:
                patch["phase"] = phase
            job.execution = {**job.execution, **patch}

    async def _pulse(self, job_id, owner):
        while True:
            await asyncio.sleep(15)
            await self._patch(job_id, owner)

    async def process(self, job_id):
        owner = str(uuid4())
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            job = await session.get(JobRecord, job_id)
            if (
                job is None
                or job.type != "image_generation"
                or job.status not in ACTIVE
                or (job.execution or {}).get("provider") != "openai"
                or job.execution.get("lease_until", 0) > time.time()
            ):
                return
            previous_phase = job.execution.get("phase")
            job.execution = {
                **job.execution,
                "lease_owner": owner,
                "lease_until": time.time() + LEASE_SECONDS,
            }
            job.status = JobStatus.RUNNING
            job.started_at = job.started_at or datetime.now(UTC)
            job.generation_dispatch_pending = False
            parameters = {**job.execution, **job.input}
        pulse = asyncio.create_task(self._pulse(job_id, owner))
        try:
            await self._notify(job_id, "generating")
            raw = await self.images.saved(job_id)
            if raw is None:
                if previous_phase == "request_sent":
                    raise ValueError(
                        "Image request was interrupted; its outcome is unknown. "
                        "Create a new job to retry."
                    )
                source = (
                    await self.jobs.image_content(job_id, source=True)
                    if parameters.get("image_asset_id")
                    else None
                )
                if self.generate is None:
                    raise ValueError("OpenAI image generation is not configured")
                await self._patch(job_id, owner, phase="request_sent")
                raw = await self.generate(parameters, source)
            await self._notify(job_id, "importing")
            await self.images.complete(job_id, raw)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.warning("Image job %s failed: %s", job_id, type(error).__name__)
            message = str(error) if isinstance(error, ValueError) else "Image generation failed"
            await self.fail(job_id, "image_generation_failed", message)
        finally:
            pulse.cancel()
            with suppress(asyncio.CancelledError):
                await pulse
            await self._patch(job_id, owner, release=True)

    async def _request(self, job_id):
        async with self.sessions() as session:
            job = await session.get(JobRecord, job_id)
            options, data = job.execution, job.input
            image_id = data.get("image_asset_id")
            image = await session.get(LibraryAssetRecord, image_id) if image_id else None
            if image_id and image is None:
                raise ValueError("Source image was removed")
            key = image.object_key if image else None
            file_format = image.format if image else None
        image_path = digest = None
        if key:
            with_key = f"inputs/{job_id}/source.{file_format}"
            identity = urlsplit(self.source.identity(with_key))
            if identity.scheme != "file" or identity.netloc:
                raise ValueError("Painter requires a shared local output directory")
            image_path = unquote(identity.path)

            def stage():
                with self.jobs.library.storage.open_reader(key) as stream:
                    raw = stream.read(MAX_IMAGE_BYTES + 1)
                if len(raw) > MAX_IMAGE_BYTES:
                    raise ValueError("Source image exceeds size limit")
                self.source.write_object(with_key, BytesIO(raw), replace=True)
                return hashlib.sha256(raw).hexdigest()

            digest = await blocking_io(stage)
        return ImageGenerationRequest(
            job_id=job_id,
            input=ImageWorkerInput(
                prompt=data["prompt"],
                model=options["model"],
                revision=options["revision"],
                seed=options["seed"],
                width=options["width"],
                height=options["height"],
                steps=options["steps"],
                image_path=image_path,
                image_sha256=digest,
            ),
        )

    async def dispatch_next(self):
        if self.queue is None:
            return False
        async with self.sessions() as session:
            job_id = await session.scalar(
                select(JobRecord.id)
                .where(
                    JobRecord.type == "image_generation",
                    JobRecord.status == JobStatus.QUEUED,
                    JobRecord.generation_dispatch_pending.is_(True),
                    JobRecord.execution["provider"].as_string() == "painter",
                )
                .order_by(JobRecord.created_at, JobRecord.id)
                .limit(1)
            )
        if job_id is None:
            return False
        try:
            request = await self._request(job_id)
        except (ValueError, FileNotFoundError):
            await self.fail(job_id, "image_source_unavailable", "Could not read the source image")
            return True
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            job = await session.get(JobRecord, job_id)
            job.execution = {**job.execution, "worker_input": request.input.model_dump()}
        await self.queue.publish(request)
        async with self.sessions.begin() as session:
            job = await session.get(JobRecord, job_id)
            job.generation_dispatch_pending = False
        return True

    async def register(self, event):
        async with self.sessions() as session:
            job = await session.get(JobRecord, event.job_id)
            if (
                job is None
                or job.type != "image_generation"
                or (job.execution or {}).get("provider") != "painter"
            ):
                raise LibraryError("unexpected_image_result", 422)
            if job.status not in ACTIVE:
                return job.id
            expected = job.execution.get("worker_input")
        if event.status == "running":
            async with self.sessions.begin() as session:
                job = await session.get(JobRecord, event.job_id)
                if job.status == JobStatus.QUEUED:
                    job.status = JobStatus.RUNNING
                    job.started_at = datetime.now(UTC)
            await self._notify(event.job_id, "generating")
        elif event.error:
            await self.fail(event.job_id, event.error.code, event.error.message)
        else:

            def read():
                with self.source.open_reader(event.result_path) as stream:
                    raw = stream.read(256 * 1024 + 1)
                if len(raw) > 256 * 1024:
                    raise ValueError("Image manifest is too large")
                manifest = ImageGenerationManifest.model_validate_json(raw)
                if manifest.job_id != event.job_id or manifest.input.model_dump() != expected:
                    raise ValueError("Image manifest does not match the job")
                with self.source.open_reader(manifest.image_path) as stream:
                    raw = stream.read(MAX_IMAGE_BYTES + 1)
                if (
                    len(raw) != manifest.size_bytes
                    or hashlib.sha256(raw).hexdigest() != manifest.sha256
                ):
                    raise ValueError("Generated PNG does not match its manifest")
                return raw

            try:
                raw = await blocking_io(read)
                await self._notify(event.job_id, "importing")
                await self.images.complete(event.job_id, raw)
            except ValueError as error:
                raise LibraryError("invalid_image_result", 422) from error
        return event.job_id

    async def recover(self):
        # Local requests are persisted in jobs and their durable broker queue.
        # OpenAI requests are recovered by the same lease loop used during normal execution.
        return None

    async def on_rejection(self, event, code):
        await self.fail(event.job_id, code, "Could not import the generated image")

    async def run(self):
        active = {}
        try:
            while True:
                for job_id, task in list(active.items()):
                    if task.done():
                        if task.exception():
                            logger.error("Image job runner failed: %s", task.exception())
                        del active[job_id]
                try:
                    async with self.sessions() as session:
                        ids = await session.scalars(
                            select(JobRecord.id)
                            .where(
                                JobRecord.type == "image_generation",
                                JobRecord.status.in_(ACTIVE),
                                JobRecord.execution["provider"].as_string() == "openai",
                                func.coalesce(JobRecord.execution["lease_until"].as_float(), 0)
                                < time.time(),
                            )
                            .order_by(JobRecord.created_at, JobRecord.id)
                            .limit(4)
                        )
                        for job_id in ids:
                            if job_id not in active and len(active) < 4:
                                active[job_id] = asyncio.create_task(self.process(job_id))
                    await self.dispatch_next()
                except Exception:
                    logger.warning("Image job polling will retry", exc_info=True)
                await asyncio.sleep(0.5)
        finally:
            for task in active.values():
                task.cancel()
            await asyncio.gather(*active.values(), return_exceptions=True)
