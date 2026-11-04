"""One persisted job model, with server-validated input selected by job type."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from camera_path.persistence.enums import JobStatus
from camera_path.persistence.records import JobRecord, LibraryAssetRecord
from camera_path.services.job_inputs import JOB_INPUT_SCHEMAS, validate_job_input
from camera_path.services.library import LibraryAsset, LibraryService
from camera_path.services.library_metadata import LibraryError, canonical_uuid


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(json_schema_extra={"enum": list(JOB_INPUT_SCHEMAS)})
    input: dict[str, Any] = Field(json_schema_extra={"oneOf": list(JOB_INPUT_SCHEMAS.values())})


class JobError(BaseModel):
    code: str
    message: str


class JobFields(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str | None
    status: JobStatus
    error: JobError | None
    created_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None

    @field_validator("created_at", "started_at", "completed_at")
    @classmethod
    def utc_times(cls, value: datetime | None) -> datetime | None:
        # SQLite strips timezone information from timestamps stored as UTC.
        return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


class Job(JobFields):
    input: dict[str, Any] | None
    assets: list[LibraryAsset]


class JobResultSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class JobSummary(JobFields):
    prompt: str | None
    asset_count: int = Field(ge=0)
    assets: list[JobResultSummary]


class JobService:
    def __init__(self, library: LibraryService):
        self.library = library
        self.sessions = library.repository.sessions

    async def create(self, data: JobCreate) -> Job:
        validate_job_input(data.type, data.input)
        job = JobRecord(
            id=str(uuid4()),
            type=data.type,
            input=data.input,
            status=JobStatus.DRAFT,
            error=None,
            created_at=datetime.now(UTC),
            started_at=None,
            completed_at=None,
        )
        async with self.sessions.begin() as session:
            session.add(job)
        return Job(**JobFields.model_validate(job).model_dump(), input=data.input, assets=[])

    async def list(self) -> list[JobSummary]:
        async with self.sessions() as session:
            jobs = await session.scalars(
                select(JobRecord)
                .options(
                    selectinload(JobRecord.assets)
                    .load_only(LibraryAssetRecord.id, LibraryAssetRecord.name)
                    .raiseload("*")
                )
                .order_by(JobRecord.created_at.desc().nulls_last(), JobRecord.id)
            )
            return [
                JobSummary(
                    **JobFields.model_validate(job).model_dump(),
                    prompt=(job.input or {}).get("prompt") if job.type == "generation" else None,
                    asset_count=len(job.assets),
                    assets=[JobResultSummary.model_validate(asset) for asset in job.assets],
                )
                for job in jobs
            ]

    async def get(self, job_id: str, request: Request) -> Job:
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
            return Job(
                **JobFields.model_validate(job).model_dump(),
                input=job.input,
                assets=[await self.library._model(asset, request) for asset in job.assets],
            )
