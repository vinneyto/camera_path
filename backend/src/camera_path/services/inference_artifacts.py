"""Attempt-scoped staged artifacts and fenced publication for CLI inference."""

import hashlib
import logging
import tempfile
import time
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import Request
from PIL import Image
from pydantic import Field, StrictInt, field_validator, model_validator
from sqlalchemy import delete, select, text

from camera_path.persistence.inference_attempt import InferenceAttemptRecord
from camera_path.persistence.inference_upload import InferenceUploadRecord
from camera_path.persistence.records import JobRecord
from camera_path.services.io import blocking_io
from camera_path.services.job_completion import JobCompletionService
from camera_path.services.job_completion_models import (
    FileId,
    JobCompletionAsset,
    JobCompletionMessage,
    LibraryFileSource,
    LibraryImportFile,
    MessageModel,
)
from camera_path.services.job_images import JobImages
from camera_path.services.library import MAX_IMAGE_BYTES, MAX_LIBRARY_FILE_BYTES
from camera_path.services.library_metadata import BoundingBox, LibraryError, canonical_uuid
from camera_path.services.library_storage import has_library_file_header

logger = logging.getLogger(__name__)
STAGING_PREFIX = "_inference/"
RETAIN_AFTER_LEASE_SECONDS = 3600
LOCAL_UPLOAD_TTL = 300
ArtifactId = Annotated[str, Field(min_length=36, max_length=36)]


class ArtifactFile(MessageModel):
    file_id: FileId
    format: Literal["png", "ply", "sog"]
    size_bytes: Annotated[StrictInt, Field(gt=0, le=MAX_LIBRARY_FILE_BYTES)]
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")

    @field_validator("sha256")
    @classmethod
    def lowercase_hash(cls, value: str) -> str:
        return value.lower()

    @model_validator(mode="after")
    def validate_size(self):
        if self.format == "png" and self.size_bytes > MAX_IMAGE_BYTES:
            raise ValueError("PNG exceeds the image size limit")
        return self


class UploadRequest(MessageModel):
    attempt_id: ArtifactId
    files: list[ArtifactFile] = Field(min_length=1, max_length=32)

    _attempt = field_validator("attempt_id")(canonical_uuid)

    @model_validator(mode="after")
    def distinct_file_ids(self):
        if len({f.file_id for f in self.files}) != len(self.files):
            raise ValueError("File IDs must be distinct")
        return self


class UploadDestination(MessageModel):
    file_id: FileId
    upload_id: str
    upload_url: str
    headers: dict[str, str]
    expires_at: datetime


class UploadResponse(MessageModel):
    files: list[UploadDestination]


class CompletionAsset(MessageModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    bbox: BoundingBox | None = None
    primary_upload_id: ArtifactId
    upload_ids: list[ArtifactId] = Field(min_length=1, max_length=32)

    _primary = field_validator("primary_upload_id")(canonical_uuid)

    @field_validator("upload_ids")
    @classmethod
    def validate_upload_ids(cls, values: list[str]) -> list[str]:
        return [canonical_uuid(value) for value in values]

    @model_validator(mode="after")
    def validate_primary(self):
        if self.primary_upload_id not in self.upload_ids:
            raise ValueError("The primary upload must be listed")
        return self


class CompleteRequest(MessageModel):
    attempt_id: ArtifactId
    image_upload_id: ArtifactId | None = None
    assets: list[CompletionAsset] | None = Field(default=None, min_length=1, max_length=16)

    @field_validator("attempt_id", "image_upload_id")
    @classmethod
    def validate_identifiers(cls, value: str | None) -> str | None:
        return canonical_uuid(value) if value is not None else None

    @model_validator(mode="after")
    def distinct_uploads(self):
        if (self.image_upload_id is None) == (self.assets is None):
            raise ValueError("Provide exactly one image or a list of model assets")
        if self.assets is not None:
            ids = [value for asset in self.assets for value in asset.upload_ids]
            if len(ids) > 32 or len(ids) != len(set(ids)):
                raise ValueError("At most 32 distinct result uploads are allowed")
        return self


def staging_key(row: InferenceUploadRecord) -> str:
    return f"{STAGING_PREFIX}{row.job_id}/{row.attempt_id}/{row.id}.{row.format}"


class _StagedReader:
    """Treat the staging namespace as a source, never as an adoptable library key."""

    def __init__(self, storage):
        self.storage = storage

    @staticmethod
    def identity(key):
        return "inference-staged:" + key

    def open_reader(self, key):
        return self.storage.open_reader(key)


class InferenceArtifacts:
    def __init__(self, jobs, importer=None, *, default_rotation_deg=None):
        self.sessions = jobs.sessions
        self.storage = jobs.library.storage
        self.images = JobImages(jobs)
        self.default_rotation_deg = default_rotation_deg
        # A separate source map avoids exposing the worker staging namespace to
        # the independent public library import consumer.
        self.importer = JobCompletionService(
            jobs.library, {"inference": _StagedReader(self.storage)}
        )

    async def reserve(self, session, job_id: str, body: UploadRequest, request: Request):
        job = await session.get(JobRecord, job_id)
        allowed = {"png"} if job and job.type == "image_generation" else {"ply", "sog"}
        if any(file.format not in allowed for file in body.files):
            raise LibraryError("inference_upload_invalid_format", 422)
        previous = {
            row.file_id: row
            for row in await session.scalars(
                select(InferenceUploadRecord).where(
                    InferenceUploadRecord.job_id == job_id,
                    InferenceUploadRecord.attempt_id == body.attempt_id,
                )
            )
        }
        if len(set(previous) | {file.file_id for file in body.files}) > 32:
            raise LibraryError("inference_upload_limit", 422)
        result = []
        for file in body.files:
            row = previous.get(file.file_id)
            if row is None:
                row = InferenceUploadRecord(
                    id=str(uuid4()), job_id=job_id, attempt_id=body.attempt_id, **file.model_dump()
                )
                session.add(row)
            elif any(getattr(row, key) != value for key, value in file.model_dump().items()):
                raise LibraryError("inference_upload_conflict", 409)
            destination = await self.storage.inference_upload_destination(
                staging_key(row), row.size_bytes, row.sha256
            )
            if destination is None:
                url = request.url_for("put_inference_upload", job_id=job_id, upload_id=row.id)
                url = url.include_query_params(attempt_id=body.attempt_id)
                destination = (
                    str(url.path) + "?" + str(url.query),
                    {"Content-Length": str(row.size_bytes)},
                    LOCAL_UPLOAD_TTL,
                )
            upload_url, headers, ttl = destination
            result.append(
                UploadDestination(
                    file_id=row.file_id,
                    upload_id=row.id,
                    upload_url=upload_url,
                    headers=headers,
                    expires_at=datetime.now(UTC) + timedelta(seconds=ttl),
                )
            )
        return UploadResponse(files=result)

    @staticmethod
    async def _get_upload(session, job_id, attempt_id, upload_id):
        row = await session.get(InferenceUploadRecord, upload_id)
        if row is None or row.job_id != job_id or row.attempt_id != attempt_id:
            raise LibraryError("inference_upload_not_found", 404)
        return row

    async def put(self, job_id, upload_id, attempt_id, request, guard):
        if self.storage.inference_direct_uploads:
            raise LibraryError("inference_upload_not_found", 404)
        async with self.sessions() as session:
            await guard(session)
            row = await self._get_upload(session, job_id, attempt_id, upload_id)
            key, expected_size, expected_hash = staging_key(row), row.size_bytes, row.sha256

        if (length := request.headers.get("content-length")) is not None and (
            not length.isdecimal() or length != str(expected_size)
        ):
            raise LibraryError("inference_upload_invalid_file", 422)
        with tempfile.TemporaryFile() as spool:
            digest, header, size = hashlib.sha256(), b"", 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > expected_size:
                    raise LibraryError("inference_upload_invalid_file", 422)
                digest.update(chunk)
                header = (header + chunk[:4])[:4]
                if chunk:
                    await blocking_io(lambda data=chunk: spool.write(data))
            if (
                size != expected_size
                or digest.hexdigest() != expected_hash
                or not has_library_file_header(key, header)
            ):
                raise LibraryError("inference_upload_invalid_file", 422)
            async with self.sessions() as session:
                await guard(session)
            spool.seek(0)
            # Replays can only replace staging with the same declared digest;
            # the authoritative result is never uploaded through this endpoint.
            await blocking_io(lambda: self.storage.write_object(key, spool, replace=True))

    def _read_png(self, row):
        try:
            with self.storage.open_reader(staging_key(row)) as stream:
                raw = stream.read(row.size_bytes + 1)
        except (FileNotFoundError, ValueError) as err:
            raise LibraryError("inference_upload_invalid_file", 422) from err
        try:
            if len(raw) != row.size_bytes or hashlib.sha256(raw).hexdigest() != row.sha256:
                raise ValueError("PNG size or digest mismatch")
            self.images.validate(raw)
        except (OSError, ValueError, Image.DecompressionBombError) as err:
            raise LibraryError("inference_upload_invalid_file", 422) from err
        return raw

    async def complete(self, job_id, body: CompleteRequest, guard, finalize):
        async with self.sessions() as session:
            job = await guard(session)
            if job.type == "image_generation":
                if body.image_upload_id is None:
                    raise LibraryError("inference_upload_invalid_format", 422)
                row = await self._get_upload(session, job_id, body.attempt_id, body.image_upload_id)
                if row.format != "png":
                    raise LibraryError("inference_upload_invalid_format", 422)
                asset_id = self.images.asset_id(job)
            else:
                if body.assets is None:
                    raise LibraryError("inference_upload_invalid_format", 422)
                manifests = []
                for asset in body.assets:
                    files = []
                    primary_file_id = None
                    for upload_id in asset.upload_ids:
                        row = await self._get_upload(session, job_id, body.attempt_id, upload_id)
                        if row.format not in {"ply", "sog"}:
                            raise LibraryError("inference_upload_invalid_format", 422)
                        files.append(
                            LibraryImportFile(
                                id=row.file_id,
                                format=row.format,
                                size_bytes=row.size_bytes,
                                sha256=row.sha256,
                                source=LibraryFileSource(
                                    storage="inference", path=staging_key(row)
                                ),
                            )
                        )
                        if upload_id == asset.primary_upload_id:
                            primary_file_id = row.file_id
                    manifests.append(
                        JobCompletionAsset(
                            name=asset.name,
                            bbox=asset.bbox,
                            primary_file_id=primary_file_id,
                            files=files,
                        )
                    )
                completion = JobCompletionMessage(
                    schema_version=2, message_id=body.attempt_id, job_id=job_id, assets=manifests
                )

        if body.image_upload_id is not None:
            raw = await blocking_io(lambda: self._read_png(row))
            # Keep the final object on a new immutable key; the import marker
            # recovers crashes before/after the SQL commit.
            key = f"{uuid4()}.png"
            async with self.importer._attempt([key]) as marker:
                await blocking_io(
                    lambda: self.storage.write_import_object(key, BytesIO(raw), marker)
                )
                async with self.sessions.begin() as session:
                    await session.execute(text("BEGIN IMMEDIATE"))
                    job = await guard(session)
                    await blocking_io(lambda: self.importer._read_marker(marker))
                    result = await self.images.publish(session, job, asset_id, key, len(raw))
                    await finalize(session, job, result)
            return result

        result = {}

        async def save_result(session, job, response):
            await finalize(session, job, response)
            result.update(response)

        await self.importer.register(
            completion,
            default_rotation_deg=self.default_rotation_deg,
            guard=guard,
            finalize=save_result,
        )
        return result

    async def recover(self):
        await self.importer.recover()
        # Wait beyond the greatest presigned URL lifetime, including a lease
        # race at issue time. Active attempts are never cleaned, even if overdue.
        cutoff = time.time() - RETAIN_AFTER_LEASE_SECONDS
        async with self.sessions() as session:
            pairs = (
                (
                    await session.execute(
                        select(InferenceUploadRecord)
                        .join(
                            InferenceAttemptRecord,
                            InferenceAttemptRecord.id == InferenceUploadRecord.attempt_id,
                        )
                        .where(
                            InferenceAttemptRecord.state != "active",
                            InferenceAttemptRecord.lease_expires_at < cutoff,
                        )
                        .limit(32)
                    )
                )
                .scalars()
                .all()
            )
        for row in pairs:
            try:
                await blocking_io(lambda item=row: self.storage.remove_object(staging_key(item)))
            except OSError:
                logger.warning("Could not reclaim inference staging upload %s", row.id)
                continue
            async with self.sessions.begin() as session:
                await session.execute(
                    delete(InferenceUploadRecord).where(InferenceUploadRecord.id == row.id)
                )

        old_paths = await blocking_io(lambda: self.storage.old_local_inference_staging(cutoff))
        if not old_paths:
            return
        async with self.sessions() as session:
            protected = set(
                await session.scalars(
                    select(InferenceAttemptRecord.id).where(
                        (InferenceAttemptRecord.state == "active")
                        | (InferenceAttemptRecord.lease_expires_at >= cutoff)
                    )
                )
            )
        for path in old_paths:
            # Created attempt IDs cannot be revived; an old orphan after FK
            # cascade cannot become a future attempt's upload.
            if path.split("/")[2] not in protected:
                try:
                    await blocking_io(lambda key=path: self.storage.remove_object(key))
                except OSError:
                    logger.warning("Could not reclaim an orphaned local inference upload")
