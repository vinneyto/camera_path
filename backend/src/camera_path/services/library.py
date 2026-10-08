from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, FiniteFloat

from camera_path.persistence.enums import LibraryAssetStatus
from camera_path.persistence.models import LibraryAssetRecord
from camera_path.repositories.library import LibraryRepository
from camera_path.repositories.project_cloud import ProjectCloudRepository
from camera_path.services.library_storage import LibraryStorage

MAX_PLY_BYTES = 2 * 1024 * 1024 * 1024


class LibraryAsset(BaseModel):
    id: str
    name: str
    format: Literal["ply"]
    size_bytes: int
    status: Literal["pending", "ready"]
    created_at: datetime
    download_url: str | None = None
    default_rotation_deg: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    default_scale: FiniteFloat = Field(gt=0)
    default_offset: tuple[FiniteFloat, FiniteFloat, FiniteFloat]


class LibraryAssetDefaultsUpdate(BaseModel):
    # Three.js Euler XYZ: angles about local X, Y and Z, in degrees.
    default_rotation_deg: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    default_scale: FiniteFloat = Field(gt=0)
    default_offset: tuple[FiniteFloat, FiniteFloat, FiniteFloat] | None = None


class LibraryUploadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    size_bytes: int = Field(gt=0, le=MAX_PLY_BYTES)
    format: Literal["ply"] = "ply"


class LibraryAssetsDelete(BaseModel):
    asset_ids: list[str] = Field(min_length=1)


class LibraryUpload(LibraryAsset):
    upload_url: str


class LibraryService:
    def __init__(self, repository: LibraryRepository, storage: LibraryStorage) -> None:
        self.repository = repository
        self.storage = storage
        self.clouds = ProjectCloudRepository(repository.sessions)

    @staticmethod
    def _model(record: LibraryAssetRecord, download_url: str | None = None) -> LibraryAsset:
        return LibraryAsset(
            id=record.id,
            name=record.name,
            format="ply",
            size_bytes=record.size_bytes,
            status=record.status.value,
            created_at=record.created_at,
            download_url=download_url,
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
        records = await self.repository.list_ready()
        return [
            self._model(item, await self.storage.download_url(item.id, item.object_key, request))
            for item in records
        ]

    async def get_record(self, asset_id: str) -> LibraryAssetRecord:
        record = await self.repository.get(asset_id)
        if record is None:
            raise HTTPException(404, "Library file not found")
        return record

    async def get(self, asset_id: str, request: Request) -> LibraryAsset:
        record = await self.get_record(asset_id)
        if record.status != "ready":
            raise HTTPException(404, "Library file not found")
        return self._model(
            record, await self.storage.download_url(record.id, record.object_key, request)
        )

    async def delete(self, asset_id: str) -> None:
        await self.delete_many([asset_id])

    async def delete_many(self, asset_ids: list[str]) -> None:
        asset_ids = sorted(set(asset_ids))
        async with self.repository.sessions.begin() as session:
            records = []
            # Validate and lock the entire selection before touching any file.
            for asset_id in asset_ids:
                record = await self.repository.get_for_update(session, asset_id)
                if record is None:
                    raise HTTPException(404, "Library file not found; reload the library")
                records.append(record)
            try:
                async with self.storage.stage_delete([record.object_key for record in records]):
                    await self.clouds.remove_library_assets(session, asset_ids)
                    for record in records:
                        await self.repository.delete(session, record)
                    await session.flush()
                    # Storage staging must enclose the commit so SQL failures restore bytes.
                    await session.commit()
            except OSError as error:
                raise HTTPException(502, "Could not delete the selected library files") from error

    async def update_defaults(
        self, asset_id: str, data: LibraryAssetDefaultsUpdate, request: Request
    ) -> LibraryAsset:
        record = await self.repository.update_defaults(
            asset_id, data.default_rotation_deg, data.default_scale, data.default_offset
        )
        if record is None:
            raise HTTPException(404, "Library file not found")
        return self._model(
            record, await self.storage.download_url(record.id, record.object_key, request)
        )

    async def create(self, data: LibraryUploadCreate, request: Request) -> LibraryUpload:
        asset_id = str(uuid4())
        key = f"{asset_id}.ply"
        record = LibraryAssetRecord(
            id=asset_id,
            name=data.name.strip(),
            format=data.format,
            object_key=key,
            size_bytes=data.size_bytes,
            status=LibraryAssetStatus.PENDING,
            created_at=datetime.now(UTC),
        )
        if not record.name:
            raise HTTPException(422, "Name cannot be blank")
        upload_url = await self.storage.upload_url(record.id, key, request)
        await self.repository.create(record)
        return LibraryUpload(
            **self._model(record).model_dump(),
            upload_url=upload_url,
        )

    async def complete(self, asset_id: str, request: Request) -> LibraryAsset:
        async with self.repository.sessions.begin() as session:
            record = await self.repository.get_for_update(session, asset_id)
            if record is None:
                raise HTTPException(404, "Library file not found")
            if record.status == LibraryAssetStatus.PENDING:
                if not await self.storage.finalize_upload(record.object_key, record.size_bytes):
                    raise HTTPException(422, "Uploaded PLY is missing, incomplete or invalid")
                record.status = LibraryAssetStatus.READY
                await session.flush()
        return self._model(
            record, await self.storage.download_url(record.id, record.object_key, request)
        )
