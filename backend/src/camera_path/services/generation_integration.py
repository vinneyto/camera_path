"""Dispatch persisted generation requests and import the worker's result manifests."""

import asyncio
import hashlib
import logging
from datetime import UTC, datetime
from io import BytesIO
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

from sqlalchemy import select, update

from camera_path.persistence.enums import JobStatus
from camera_path.persistence.records import JobRecord, LibraryAssetRecord
from camera_path.services.generation_models import (
    GENERATION_SOURCE,
    GenerationError,
    GenerationManifest,
    GenerationRequest,
    GenerationResult,
    ImageGenerationInput,
    TextGenerationInput,
)
from camera_path.services.io import blocking_io
from camera_path.services.job_completion import JobCompletionService
from camera_path.services.job_completion_models import (
    MAX_MESSAGE_BYTES,
    JobCompletionAsset,
    JobCompletionMessage,
    LibraryFileSource,
    LibraryImportFile,
)
from camera_path.services.job_naming import image_generation_name, text_generation_name
from camera_path.services.library import IMAGE_FORMATS, MAX_IMAGE_BYTES, MAX_LIBRARY_FILE_BYTES
from camera_path.services.library_metadata import LibraryError
from camera_path.services.library_storage import LibraryStorage
from camera_path.services.message_queue import GenerationQueue

logger = logging.getLogger(__name__)
ACTIVE_STATUSES = (JobStatus.QUEUED, JobStatus.RUNNING)
MAX_MANIFEST_BYTES = 2 * MAX_MESSAGE_BYTES


class GenerationIntegration:
    def __init__(
        self,
        queue: GenerationQueue,
        importer: JobCompletionService,
        source: LibraryStorage,
        *,
        default_rotation_deg: tuple[float, float, float] | None,
    ):
        self.queue = queue
        self.importer = importer
        self.source = source
        self.sessions = importer.sessions
        self.default_rotation_deg = default_rotation_deg

    async def dispatch(self) -> None:
        while True:
            try:
                if not await self._dispatch_next():
                    await asyncio.sleep(0.5)
            except Exception:
                logger.warning("Generation request dispatch will retry", exc_info=True)
                await asyncio.sleep(2)

    async def _dispatch_next(self) -> bool:
        async with self.sessions() as session:
            pending = (
                await session.execute(
                    select(JobRecord.id, JobRecord.input)
                    .where(
                        JobRecord.type == "generation",
                        JobRecord.status == JobStatus.QUEUED,
                        JobRecord.generation_dispatch_pending.is_(True),
                    )
                    .order_by(JobRecord.created_at, JobRecord.id)
                    .limit(1)
                )
            ).one_or_none()
        if pending is None:
            return False
        job_id, job_input = pending
        # The queued row is the durable dispatch intent. If the process stops after
        # the broker confirm, replay uses the same UUID and the worker reuses its result.
        try:
            worker_input, _ = await self._worker_input(job_id, job_input, stage=True)
        except (FileNotFoundError, ValueError) as error:
            await self._fail(
                job_id,
                GenerationError(
                    code="generation_input_unavailable",
                    message="Could not read the source image.",
                ),
            )
            logger.warning("Generation input unavailable for %s: %s", job_id, error)
            return True
        await self.queue.publish(GenerationRequest(job_id=job_id, input=worker_input))
        async with self.sessions.begin() as session:
            await session.execute(
                update(JobRecord)
                .where(JobRecord.id == job_id, JobRecord.generation_dispatch_pending.is_(True))
                .values(generation_dispatch_pending=False)
            )
        return True

    async def recover(self) -> None:
        await self.importer.recover()

    async def register(self, event: GenerationResult) -> str:
        async with self.sessions() as session:
            job = await session.get(JobRecord, event.job_id)
            if job is None:
                raise LibraryError("job_not_found", 404)
            if job.type != "generation" or job.status == JobStatus.DRAFT:
                raise LibraryError("unexpected_generation_result")
            if job.status not in ACTIVE_STATUSES:
                return job.id
            job_input = job.input
            job_name = job.name

        if event.error is not None:
            await self._fail(event.job_id, event.error)
        else:
            try:
                worker_input, name = await self._worker_input(event.job_id, job_input, stage=False)
                if "prompt" in job_input and job_name:
                    name = job_name
                message = await blocking_io(lambda: self._completion(event, worker_input, name))
            except ValueError as error:
                raise LibraryError("invalid_generation_result", 422) from error
            await self.importer.register(message, default_rotation_deg=self.default_rotation_deg)
        return event.job_id

    async def on_rejection(self, event: GenerationResult, code: str) -> None:
        await self._fail(
            event.job_id,
            GenerationError(code=code, message="Could not import the generation result."),
        )

    async def _fail(self, job_id: str, error: GenerationError) -> None:
        async with self.sessions.begin() as session:
            await session.execute(
                update(JobRecord)
                .where(
                    JobRecord.id == job_id,
                    JobRecord.type == "generation",
                    JobRecord.status.in_(ACTIVE_STATUSES),
                )
                .values(
                    status=JobStatus.FAILED,
                    generation_dispatch_pending=False,
                    error=error.model_dump(),
                    completed_at=datetime.now(UTC),
                )
            )

    async def _worker_input(self, job_id: str, job_input: dict, *, stage: bool):
        if "prompt" in job_input:
            return TextGenerationInput(**job_input), text_generation_name(job_input["prompt"])
        async with self.sessions() as session:
            image = await session.get(LibraryAssetRecord, job_input["image_asset_id"])
            if image is None or image.status != "ready" or image.format not in IMAGE_FORMATS:
                raise ValueError("Source image is no longer available")
            key = f"inputs/{job_id}/{image.id}.{image.format}"
            identity = urlsplit(self.source.identity(key))
            if identity.scheme != "file" or identity.netloc:
                raise ValueError("Generation requires a shared local output directory")
            image_path = unquote(identity.path)
            object_key, name = image.object_key, image.name

        def prepare():
            with self.importer.library.storage.open_reader(object_key) as file:
                data = file.read(MAX_IMAGE_BYTES + 1)
            if len(data) > MAX_IMAGE_BYTES:
                raise ValueError("Image exceeds size limit")
            if stage:
                # Atomic replacement also repairs an interrupted dispatch attempt.
                self.source.write_object(key, BytesIO(data), replace=True)
            return ImageGenerationInput(
                image_path=image_path,
                image_sha256=hashlib.sha256(data).hexdigest(),
            )

        return await blocking_io(prepare), image_generation_name(name)

    def _completion(self, event: GenerationResult, job_input, name: str) -> JobCompletionMessage:
        with self.source.open_reader(event.result_path) as file:
            raw = file.read(MAX_MANIFEST_BYTES + 1)
        if len(raw) > MAX_MANIFEST_BYTES:
            raise ValueError("Generation manifest is too large")
        manifest = GenerationManifest.model_validate_json(raw)
        if manifest.job_id != event.job_id or manifest.input != job_input:
            raise ValueError("Generation manifest does not match the job")
        files = [self._describe(path, index) for index, path in enumerate(manifest.files)]
        return JobCompletionMessage(
            schema_version=2,
            message_id=event.job_id,
            job_id=event.job_id,
            assets=[
                JobCompletionAsset(
                    name=name,
                    primary_file_id=files[0].id,
                    files=files,
                    bbox=manifest.bbox,
                )
            ],
        )

    def _describe(self, path: str, index: int) -> LibraryImportFile:
        file_format = PurePosixPath(path).suffix.removeprefix(".")
        if file_format not in {"ply", "sog"}:
            raise ValueError("Unsupported generated file format")
        size, digest = 0, hashlib.sha256()
        with self.source.open_reader(path) as file:
            while chunk := file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_LIBRARY_FILE_BYTES:
                    raise ValueError("Generated file is too large")
                digest.update(chunk)
        return LibraryImportFile(
            id="main" if index == 0 else f"file-{index + 1}",
            format=file_format,
            size_bytes=size,
            sha256=digest.hexdigest(),
            source=LibraryFileSource(storage=GENERATION_SOURCE, path=path),
        )
