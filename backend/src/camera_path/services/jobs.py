"""One persisted job model, with server-validated input selected by job type."""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from camera_path.models import Anchor
from camera_path.persistence.enums import JobStatus
from camera_path.persistence.records import ChatAttachmentRecord, JobRecord, LibraryAssetRecord
from camera_path.services.chat_attachments import ChatAttachments
from camera_path.services.generation_models import GenerationRequest
from camera_path.services.io import blocking_io
from camera_path.services.job_completion_models import MAX_MESSAGE_BYTES
from camera_path.services.job_inputs import JOB_INPUT_SCHEMAS, validate_job_input
from camera_path.services.job_naming import text_generation_name
from camera_path.services.library import (
    IMAGE_FORMATS,
    MAX_IMAGE_BYTES,
    LibraryAsset,
    LibraryService,
)
from camera_path.services.library_metadata import LibraryError, canonical_uuid


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(json_schema_extra={"enum": list(JOB_INPUT_SCHEMAS)})
    input: dict[str, Any] = Field(json_schema_extra={"oneOf": list(JOB_INPUT_SCHEMAS.values())})
    start: bool = False
    name: str | None = Field(default=None, max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def trim_optional_name(cls, value):
        return value.strip() or None if isinstance(value, str) else value


class JobError(BaseModel):
    code: str
    message: str


class JobScenePlacement(BaseModel):
    project_id: str
    anchor: Anchor
    status: Literal["pending", "succeeded", "skipped"]
    scene_object_id: str | None = None
    reason: str | None = None


class JobFields(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str | None = Field(
        max_length=200,
        description="Explicit job name or an automatic name saved at creation.",
    )
    type: str | None
    status: JobStatus
    error: JobError | None
    created_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    scene_placement: JobScenePlacement | None = None

    @field_validator("created_at", "started_at", "completed_at")
    @classmethod
    def utc_times(cls, value: datetime | None) -> datetime | None:
        # SQLite strips timezone information from timestamps stored as UTC.
        return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


class Job(JobFields):
    input: dict[str, Any] | None
    assets: list[LibraryAsset]
    input_asset: LibraryAsset | None = None


class JobResultSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: Literal["pending", "ready"] = "ready"


class JobSummary(JobFields):
    prompt: str | None
    image_asset_id: str | None = None
    asset_count: int = Field(ge=0)
    assets: list[JobResultSummary]


class JobService:
    def __init__(
        self,
        library: LibraryService,
        generation_enabled: bool = False,
        *,
        image_settings: dict | None = None,
    ):
        self.library = library
        self.sessions = library.repository.sessions
        self.generation_enabled = generation_enabled
        self.image_settings = image_settings

    async def create(
        self,
        data: JobCreate,
        request: Request | None = None,
        *,
        scene_placement=None,
        request_key=None,
        chat_context=None,
    ) -> Job:
        validate_job_input(data.type, data.input)
        job_id = str(uuid4())
        if data.start:
            enabled = (
                self.image_settings is not None
                if data.type == "image_generation"
                else self.generation_enabled
            )
            if not enabled:
                raise LibraryError("generation_unavailable", 503)
            payload = (
                GenerationRequest(job_id=job_id, input=data.input).model_dump_json()
                if data.type == "generation" and "prompt" in data.input
                else data.model_dump_json()
            )
            if len(payload.encode()) > MAX_MESSAGE_BYTES:
                raise LibraryError("generation_request_too_large", 422)
        job = JobRecord(
            id=job_id,
            scene_placement=scene_placement,
            request_key=request_key,
            type=data.type,
            input=data.input,
            execution={
                **(self.image_settings or {}),
                "seed": UUID(job_id).int % 2**32,
                "phase": "queued",
                "lease_until": 0,
                "chat": chat_context,
            }
            if data.type == "image_generation"
            else None,
            status=JobStatus.QUEUED if data.start else JobStatus.DRAFT,
            generation_dispatch_pending=data.start,
            error=None,
            created_at=datetime.now(UTC),
            started_at=None,
            completed_at=None,
        )
        async with self.sessions.begin() as session:
            # Serialize input validation with library deletion on SQLite.
            await session.execute(text("BEGIN IMMEDIATE"))
            image_id = data.input.get("image_asset_id")
            image = await session.get(LibraryAssetRecord, image_id) if image_id else None
            if image_id:
                staged = None
                if image is not None and chat_context and data.type == "image_generation":
                    staged = await session.scalar(
                        select(ChatAttachmentRecord.id).where(
                            ChatAttachmentRecord.project_id == chat_context["project_id"],
                            ChatAttachmentRecord.asset_id == image_id,
                            ChatAttachmentRecord.ready.is_(True),
                        )
                    )
                if (
                    image is None
                    or image.format not in IMAGE_FORMATS
                    or (image.status != "ready" and staged is None)
                ):
                    raise LibraryError("generation_image_not_found", 422)
            job.name = data.name or (
                image.name if image else text_generation_name(data.input["prompt"])
            )
            session.add(job)
            input_asset = (
                await self._asset(image, job_id, request, source=True)
                if image and request
                else None
            )
        return Job(
            **JobFields.model_validate(job).model_dump(),
            input=data.input,
            assets=[],
            input_asset=input_asset,
        )

    async def status(self, job_id: str) -> JobStatus | None:
        async with self.sessions() as session:
            return await session.scalar(select(JobRecord.status).where(JobRecord.id == job_id))

    async def list(self, project_id: str | None = None) -> list[JobSummary]:
        async with self.sessions() as session:
            jobs = await session.scalars(
                select(JobRecord)
                .where(
                    JobRecord.scene_placement["project_id"].as_string() == project_id
                    if project_id is not None
                    else True
                )
                .options(
                    selectinload(JobRecord.assets)
                    .load_only(
                        LibraryAssetRecord.id, LibraryAssetRecord.name, LibraryAssetRecord.status
                    )
                    .raiseload("*")
                )
                .order_by(JobRecord.created_at.desc().nulls_last(), JobRecord.id)
            )
            return [
                JobSummary(
                    **JobFields.model_validate(job).model_dump(),
                    prompt=(job.input or {}).get("prompt"),
                    image_asset_id=(job.input or {}).get("image_asset_id"),
                    asset_count=len(job.assets),
                    assets=[JobResultSummary.model_validate(asset) for asset in job.assets],
                )
                for job in jobs
            ]

    async def get(self, job_id: str, request: Request | None = None) -> Job:
        try:
            job_id = canonical_uuid(job_id)
        except ValueError as error:
            raise LibraryError(
                "validation_error",
                422,
                [
                    {
                        "location": ["path", "job_id"],
                        "message": "Invalid UUID",
                        "type": "value_error",
                    }
                ],
            ) from error
        async with self.sessions() as session:
            job = await session.get(JobRecord, job_id)
            if job is None:
                raise LibraryError("job_not_found", 404)
            image_id = (job.input or {}).get("image_asset_id")
            image = await session.get(LibraryAssetRecord, image_id) if image_id else None
            return Job(
                **JobFields.model_validate(job).model_dump(),
                input=job.input,
                input_asset=await self._asset(image, job_id, request, source=True)
                if image and request
                else None,
                assets=[await self._asset(asset, job_id, request) for asset in job.assets]
                if request
                else [],
            )

    async def _asset(self, record, job_id, request, *, source=False):
        asset = await self.library._model(record, request)
        if asset.status == "pending" and asset.format in IMAGE_FORMATS:
            suffix = "source-image" if source else "image"
            url = f"/api/v1/jobs/{job_id}/{suffix}"
            asset = asset.model_copy(
                update={
                    "download_url": url,
                    "thumbnail_url": url,
                    "files": [
                        file.model_copy(update={"download_url": url}) for file in asset.files
                    ],
                }
            )
        return asset

    async def by_request_key(self, key):
        async with self.sessions() as session:
            job_id = await session.scalar(select(JobRecord.id).where(JobRecord.request_key == key))
        return await self.get(job_id) if job_id is not None else None

    async def result(self, job_id):
        job = await self.get(job_id)
        if job.status in (JobStatus.FAILED, JobStatus.CANCELLED):
            raise ValueError(job.error.message if job.error else "Generation did not succeed")
        if job.status != JobStatus.SUCCEEDED:
            return None
        async with self.sessions() as session:
            asset_id = await session.scalar(
                select(LibraryAssetRecord.id).where(
                    LibraryAssetRecord.job_id == job_id, LibraryAssetRecord.job_position == 0
                )
            )
        if asset_id is None:
            raise ValueError("Successful generation has no library asset")
        return {"asset_id": asset_id, "job_id": job_id}

    async def create_chat_image(self, project_id, attachment_id, parameters, key):
        image_id = None
        if source := parameters.get("source_attachment_id"):
            async with self.sessions() as session:
                image_id = await session.scalar(
                    select(ChatAttachmentRecord.asset_id).where(
                        ChatAttachmentRecord.id == source,
                        ChatAttachmentRecord.project_id == project_id,
                        ChatAttachmentRecord.ready.is_(True),
                    )
                )
            if image_id is None:
                raise ValueError("Source image is not available in this project")
        return await self.create(
            JobCreate(
                type="image_generation",
                input={
                    "prompt": parameters["prompt"],
                    **({"image_asset_id": image_id} if image_id else {}),
                },
                name=parameters.get("name"),
                start=True,
            ),
            request_key=key,
            chat_context={"project_id": project_id, "attachment_id": attachment_id},
        )

    async def chat_image(self, job_id):
        async with self.sessions() as session:
            job = await session.get(JobRecord, job_id)
            context = (job.execution or {}).get("chat") if job else None
            record = (
                await session.get(ChatAttachmentRecord, context["attachment_id"])
                if context
                else None
            )
            if record is None or not record.ready or record.asset_id is None:
                raise ValueError("Generated chat image is no longer available")
            return ChatAttachments.model(record)

    async def image_content(self, job_id, *, source=False):
        job = await self.get(job_id)
        async with self.sessions() as session:
            if source:
                image_id = (job.input or {}).get("image_asset_id")
                image = await session.get(LibraryAssetRecord, image_id) if image_id else None
            else:
                image = await session.scalar(
                    select(LibraryAssetRecord).where(
                        LibraryAssetRecord.job_id == job_id,
                        LibraryAssetRecord.job_position == 0,
                    )
                )
            if (
                image is None
                or image.format not in IMAGE_FORMATS
                or (not source and job.status != JobStatus.SUCCEEDED)
            ):
                raise LibraryError("job_image_not_found", 404)
            key, file_format = image.object_key, image.format

        def read():
            with self.library.storage.open_reader(key) as file:
                raw = file.read(MAX_IMAGE_BYTES + 1)
            if len(raw) > MAX_IMAGE_BYTES:
                raise LibraryError("job_image_invalid", 422)
            return raw

        try:
            raw = await blocking_io(read)
        except FileNotFoundError as error:
            raise LibraryError("job_image_not_found", 404) from error
        return raw, f"image/{'jpeg' if file_format == 'jpg' else file_format}"
