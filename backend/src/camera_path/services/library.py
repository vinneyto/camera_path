from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, FiniteFloat

from camera_path.persistence.models import LibraryAssetRecord
from camera_path.repositories.library import LibraryRepository
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


class LibraryAssetDefaultsUpdate(BaseModel):
    # Three.js Euler XYZ: angles about local X, Y and Z, in degrees.
    default_rotation_deg: tuple[FiniteFloat, FiniteFloat, FiniteFloat]
    default_scale: FiniteFloat = Field(gt=0)


class LibraryUploadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    size_bytes: int = Field(gt=0, le=MAX_PLY_BYTES)
    format: Literal["ply"] = "ply"


class LibraryUpload(LibraryAsset):
    upload_url: str


class LibraryService:
    def __init__(self, repository: LibraryRepository, storage: LibraryStorage) -> None:
        self.repository = repository
        self.storage = storage

    @staticmethod
    def _model(record: LibraryAssetRecord, download_url: str | None = None) -> LibraryAsset:
        return LibraryAsset(
            id=record.id,
            name=record.name,
            format="ply",
            size_bytes=record.size_bytes,
            status=record.status,
            created_at=record.created_at,
            download_url=download_url,
            default_rotation_deg=(
                record.default_rotation_x_deg,
                record.default_rotation_y_deg,
                record.default_rotation_z_deg,
            ),
            default_scale=record.default_scale,
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

    async def update_defaults(
        self, asset_id: str, data: LibraryAssetDefaultsUpdate, request: Request
    ) -> LibraryAsset:
        record = await self.repository.update_defaults(
            asset_id, data.default_rotation_deg, data.default_scale
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
            status="pending",
            created_at=datetime.now(UTC),
        )
        if not record.name:
            raise HTTPException(422, "Name cannot be blank")
        await self.repository.create(record)
        return LibraryUpload(
            **self._model(record).model_dump(),
            upload_url=await self.storage.upload_url(record.id, key, request),
        )

    async def complete(self, asset_id: str, request: Request) -> LibraryAsset:
        record = await self.get_record(asset_id)
        inspection = await self.storage.inspect(record.object_key)
        if (
            inspection is None
            or inspection[0] != record.size_bytes
            or inspection[1] not in {b"ply\n", b"ply\r"}
        ):
            raise HTTPException(422, "Uploaded PLY is missing, incomplete or invalid")
        await self.repository.mark_ready(asset_id)
        return self._model(
            record, await self.storage.download_url(record.id, record.object_key, request)
        ).model_copy(update={"status": "ready"})
