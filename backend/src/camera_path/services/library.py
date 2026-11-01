from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from camera_path.persistence.enums import LibraryAssetStatus
from camera_path.persistence.records import (
    LibraryAssetFileRecord,
    LibraryAssetRecord,
)
from camera_path.repositories.library import LibraryRepository
from camera_path.repositories.project_cloud import ProjectCloudRepository
from camera_path.services.io import blocking_io
from camera_path.services.library_metadata import (
    LibraryError,
    normalize_tags,
    validate_thumbnail,
)
from camera_path.services.library_storage import LibraryStorage

MAX_LIBRARY_FILE_BYTES = 2 * 1024**3


def thumbnail_type(key: str, header: bytes) -> str | None:
    if key.endswith(".png") and header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if key.endswith((".jpg", ".jpeg")) and header.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if key.endswith(".webp") and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "image/webp"
    return None


class LibraryAssetFile(BaseModel):
    id: str
    format: Literal["ply", "sog"]
    size_bytes: int
    sha256: str | None = None
    download_url: str | None = None


class LibraryAsset(BaseModel):
    id: str
    job_id: str | None = None
    name: str
    format: Literal["ply", "sog"]
    size_bytes: int
    status: Literal["pending", "ready"]
    created_at: datetime
    tags: list[str]
    thumbnail_url: str | None = None
    download_url: str | None = None
    primary_file_id: str
    files: list[LibraryAssetFile]
    default_rotation_deg: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    default_scale: FiniteFloat = Field(gt=0)
    default_offset: tuple[FiniteFloat, FiniteFloat, FiniteFloat]


class LibraryAssetDefaultsUpdate(BaseModel):
    default_rotation_deg: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    default_scale: FiniteFloat = Field(gt=0)
    default_offset: tuple[FiniteFloat, FiniteFloat, FiniteFloat] | None = None


class LibraryUploadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=200)
    size_bytes: int = Field(gt=0, le=MAX_LIBRARY_FILE_BYTES)
    format: Literal["ply", "sog"] = "ply"
    thumbnail_key: str | None = None
    tags: list[str] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    _tags = field_validator("tags")(normalize_tags)

    @model_validator(mode="after")
    def validate_metadata(self):
        validate_thumbnail(self.thumbnail_key)
        return self


class LibraryAssetsDelete(BaseModel):
    asset_ids: list[str] = Field(min_length=1)


class LibraryUpload(LibraryAsset):
    upload_url: str


class LibraryService:
    def __init__(self, repository: LibraryRepository, storage: LibraryStorage) -> None:
        self.repository, self.storage = repository, storage
        self.clouds = ProjectCloudRepository(repository.sessions)

    async def _model(self, record: LibraryAssetRecord, request: Request) -> LibraryAsset:
        ready = record.status == LibraryAssetStatus.READY
        files = []
        for file in record.files:
            url = None
            if ready:
                url = await (
                    self.storage.download_url(record.id, file.object_key, request)
                    if file.is_primary
                    else self.storage.file_download_url(
                        record.id, file.id, file.object_key, request
                    )
                )
            files.append(
                LibraryAssetFile(
                    id=file.id,
                    format=file.format,
                    size_bytes=file.size_bytes,
                    sha256=file.sha256,
                    download_url=url,
                )
            )
        primary = next(f for f in record.files if f.is_primary)
        return LibraryAsset(
            id=record.id,
            job_id=record.job_id,
            name=record.name,
            format=record.format,
            size_bytes=record.size_bytes,
            status=record.status.value,
            created_at=record.created_at,
            tags=record.tags,
            files=files,
            primary_file_id=primary.id,
            download_url=next(f.download_url for f in files if f.id == primary.id),
            thumbnail_url=await self.storage.thumbnail_url(record.id, record.thumbnail_key, request)
            if ready and record.thumbnail_key
            else None,
            default_rotation_deg=(
                record.default_rotation_x_deg,
                record.default_rotation_y_deg,
                record.default_rotation_z_deg,
            ),
            default_scale=record.default_scale,
            default_offset=(
                record.default_offset_x,
                record.default_offset_y,
                record.default_offset_z,
            ),
        )

    async def list(self, request: Request) -> list[LibraryAsset]:
        return [await self._model(r, request) for r in await self.repository.list_ready()]

    async def get_record(self, asset_id: str) -> LibraryAssetRecord:
        record = await self.repository.get(asset_id)
        if record is None:
            raise HTTPException(404, "Library file not found")
        return record

    async def get(self, asset_id: str, request: Request) -> LibraryAsset:
        record = await self.get_record(asset_id)
        if record.status != "ready":
            raise HTTPException(404, "Library file not found")
        return await self._model(record, request)

    async def delete(self, asset_id: str) -> None:
        await self.delete_many([asset_id])

    async def delete_many(self, asset_ids: list[str]) -> None:
        async with self.repository.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            records = []
            for asset_id in sorted(set(asset_ids)):
                record = await self.repository.get_for_update(session, asset_id)
                if record is None:
                    raise HTTPException(404, "Library file not found; reload the library")
                records.append(record)
            keys = [f.object_key for record in records for f in record.files]
            keys.extend(r.thumbnail_key for r in records if r.thumbnail_key)
            try:
                async with self.storage.stage_delete(keys):
                    await self.clouds.remove_library_assets(session, [r.id for r in records])
                    for record in records:
                        await self.repository.delete(session, record)
                    await session.flush()
                    await session.commit()
            except OSError as error:
                raise HTTPException(502, "Could not delete the selected library files") from error

    async def update_defaults(self, asset_id, data, request) -> LibraryAsset:
        record = await self.repository.update_defaults(
            asset_id, data.default_rotation_deg, data.default_scale, data.default_offset
        )
        if record is None:
            raise HTTPException(404, "Library file not found")
        return await self._model(record, request)

    async def create(self, data: LibraryUploadCreate, request: Request) -> LibraryUpload:
        asset_id = str(uuid4())
        key = f"{asset_id}.{data.format}"
        record = LibraryAssetRecord(
            id=asset_id,
            name=data.name,
            format=data.format,
            object_key=key,
            size_bytes=data.size_bytes,
            status=LibraryAssetStatus.PENDING,
            created_at=datetime.now(UTC),
            tags=data.tags,
            thumbnail_key=data.thumbnail_key,
            files=[
                LibraryAssetFileRecord(
                    id="main",
                    position=0,
                    is_primary=True,
                    object_key=key,
                    format=data.format,
                    size_bytes=data.size_bytes,
                )
            ],
        )
        try:
            async with self.repository.sessions.begin() as session:
                session.add(record)
                await session.flush()
        except IntegrityError as error:
            raise LibraryError("library_import_object_conflict") from error
        model = await self._model(record, request)
        url = await self.storage.upload_url(record.id, record.object_key, request)
        return LibraryUpload(**model.model_dump(), upload_url=url)

    async def check_thumbnail(self, key: str | None) -> None:
        if key is None:
            return

        def inspect():
            if self.storage.key_for_identity(self.storage.identity(key)) != key:
                raise ValueError("Thumbnail resolves outside its own namespace")
            with self.storage.open_reader(key) as stream:
                contents = stream.read(5 * 1024**2 + 1)
                return (
                    len(contents) <= 5 * 1024**2 and thumbnail_type(key, contents[:12]) is not None
                )

        try:
            valid = await blocking_io(inspect)
        except (FileNotFoundError, ValueError) as error:
            raise LibraryError("library_import_invalid_file", 422) from error
        if not valid:
            raise LibraryError("library_import_invalid_file", 422)

    async def complete(self, asset_id: str, request: Request) -> LibraryAsset:
        async with self.repository.sessions.begin() as session:
            record = await self.repository.get_for_update(session, asset_id)
            if record is None:
                raise HTTPException(404, "Library file not found")
            if record.status == LibraryAssetStatus.PENDING:
                if not await self.storage.finalize_upload(record.object_key, record.size_bytes):
                    raise HTTPException(422, "Uploaded file is missing, incomplete or invalid")
                await self.check_thumbnail(record.thumbnail_key)
                record.status = LibraryAssetStatus.READY
                await session.flush()
        return await self._model(record, request)
