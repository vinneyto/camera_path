"""Minimal persisted jobs and result reads; execution is owned by future workers."""

from datetime import datetime
from uuid import uuid4

from fastapi import Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from camera_path.persistence.records import JobRecord, LibraryAssetRecord
from camera_path.services.library import LibraryAsset, LibraryService
from camera_path.services.library_metadata import LibraryError, canonical_uuid


class Job(BaseModel):
    id: str
    completed_at: datetime | None
    assets: list[LibraryAsset]


class JobSummary(BaseModel):
    id: str
    completed_at: datetime | None
    asset_count: int = Field(ge=0)


class JobService:
    def __init__(self, library: LibraryService):
        self.library = library
        self.sessions = library.repository.sessions

    async def create(self) -> Job:
        job_id = str(uuid4())
        async with self.sessions.begin() as session:
            session.add(JobRecord(id=job_id))
        return Job(id=job_id, completed_at=None, assets=[])

    async def list(self) -> list[JobSummary]:
        async with self.sessions() as session:
            rows = await session.execute(
                select(
                    JobRecord.id,
                    JobRecord.completed_at,
                    func.count(LibraryAssetRecord.id).label("asset_count"),
                )
                .outerjoin(LibraryAssetRecord, LibraryAssetRecord.job_id == JobRecord.id)
                .group_by(JobRecord.id, JobRecord.completed_at)
                .order_by(JobRecord.id)
            )
            return [JobSummary.model_validate(row._mapping) for row in rows]

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
                id=job.id,
                completed_at=job.completed_at,
                assets=[await self.library._model(asset, request) for asset in job.assets],
            )
