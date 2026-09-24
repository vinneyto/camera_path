from __future__ import annotations

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, model_validator

from camera_path.persistence.models import LibraryAssetRecord
from camera_path.repositories.library import LibraryRepository
from camera_path.repositories.project_cloud import ProjectCloudRepository
from camera_path.services.library_storage import LibraryStorage
from camera_path.services.revisions import advance_project_revision


class ProjectCloud(BaseModel):
    id: str
    project_id: str
    library_asset_id: str
    name: str
    position: int
    visible: bool
    download_url: str


class ProjectCloudCreate(BaseModel):
    library_asset_id: str


class ProjectCloudUpdate(BaseModel):
    position: int | None = Field(default=None, ge=0)
    visible: bool | None = None

    @model_validator(mode="after")
    def require_change(self) -> ProjectCloudUpdate:
        if self.position is None and self.visible is None:
            raise ValueError("Specify position or visibility")
        return self


class ProjectCloudService:
    def __init__(
        self,
        repository: ProjectCloudRepository,
        library: LibraryRepository,
        storage: LibraryStorage,
    ) -> None:
        self.repository = repository
        self.library = library
        self.storage = storage

    async def _model(self, record, request: Request) -> ProjectCloud:
        asset = await self.library.get(record.library_asset_id)
        if asset is None:
            raise HTTPException(404, "Library asset not found")
        return ProjectCloud(
            id=record.id,
            project_id=record.project_id,
            library_asset_id=asset.id,
            name=asset.name,
            position=record.position,
            visible=record.visible,
            download_url=await self.storage.download_url(asset.id, asset.object_key, request),
        )

    async def list(self, project_id: str, request: Request) -> tuple[list[ProjectCloud], int]:
        records, revision = await self.repository.list(project_id)
        return [await self._model(record, request) for record in records], revision

    async def add(
        self, project_id: str, asset_id: str, expected: int, request: Request
    ) -> tuple[ProjectCloud, int]:
        try:
            async with self.repository.sessions.begin() as session:
                asset = await session.get(LibraryAssetRecord, asset_id)
                if asset is None or asset.status != "ready":
                    raise KeyError("Library asset not found or not ready")
                revision = await advance_project_revision(session, project_id, expected)
                record = await self.repository.add(session, project_id, asset_id)
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
        return await self._model(record, request), revision

    async def update(
        self,
        project_id: str,
        cloud_id: str,
        data: ProjectCloudUpdate,
        expected: int,
        request: Request,
    ) -> tuple[ProjectCloud, int]:
        try:
            async with self.repository.sessions.begin() as session:
                revision = await advance_project_revision(session, project_id, expected)
                record = await self.repository.update(
                    session, project_id, cloud_id, data.position, data.visible
                )
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        return await self._model(record, request), revision

    async def remove(self, project_id: str, cloud_id: str, expected: int) -> int:
        try:
            async with self.repository.sessions.begin() as session:
                revision = await advance_project_revision(session, project_id, expected)
                await self.repository.remove(session, project_id, cloud_id)
            return revision
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
