from __future__ import annotations

from typing import Annotated, Literal

from fastapi import HTTPException, Request
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, FiniteFloat, model_validator

from camera_path.persistence.records import LibraryAssetRecord, SceneObjectRecord
from camera_path.repositories.library import LibraryRepository
from camera_path.repositories.scene_object import SceneObjectRepository
from camera_path.services.library_storage import LibraryStorage
from camera_path.services.revisions import advance_project_revision
from camera_path.services.scene_transforms import (
    normalize_quaternion,
    quaternion_from_euler_xyz,
    transformed_offset,
)

Vec3 = tuple[FiniteFloat, FiniteFloat, FiniteFloat]
Positive = Annotated[FiniteFloat, Field(gt=0)]
Scale3 = tuple[Positive, Positive, Positive]
Quaternion = Annotated[
    tuple[FiniteFloat, FiniteFloat, FiniteFloat, FiniteFloat],
    AfterValidator(normalize_quaternion),
]


class SceneObject(BaseModel):
    id: str
    project_id: str
    parent_id: str | None
    library_asset_id: str
    library_asset_file_id: str
    sort_order: int
    visible: bool
    position: Vec3
    quaternion: Quaternion
    scale: Scale3
    name: str
    format: Literal["ply", "sog"]
    download_url: str


class SceneObjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    library_asset_id: str
    library_asset_file_id: str | None = None
    parent_id: str | None = None
    # Omitted transforms snapshot library defaults. Explicit values are canonical local TRS.
    position: Vec3 | None = None
    quaternion: Quaternion | None = None
    scale: Scale3 | None = None


class SceneObjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parent_id: str | None = None
    sort_order: int | None = Field(default=None, ge=0)
    visible: bool | None = None
    position: Vec3 | None = None
    quaternion: Quaternion | None = None
    scale: Scale3 | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Specify a scene object field to change")
        for field in self.model_fields_set - {"parent_id"}:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class SceneObjectService:
    def __init__(
        self, repository: SceneObjectRepository, library: LibraryRepository, storage: LibraryStorage
    ) -> None:
        self.repository, self.library, self.storage = repository, library, storage

    async def _model(self, record: SceneObjectRecord, request: Request) -> SceneObject:
        asset = await self.library.get(record.library_asset_id)
        if asset is None:
            raise HTTPException(404, "Library asset not found")
        file = next((file for file in asset.files if file.id == record.library_asset_file_id), None)
        if file is None:
            raise HTTPException(404, "Library asset file not found")
        url = await (
            self.storage.download_url(asset.id, file.object_key, request)
            if file.is_primary
            else self.storage.file_download_url(asset.id, file.id, file.object_key, request)
        )
        return SceneObject(
            id=record.id,
            project_id=record.project_id,
            parent_id=record.parent_id,
            library_asset_id=asset.id,
            library_asset_file_id=file.id,
            name=asset.name,
            format=file.format,
            sort_order=record.sort_order,
            visible=record.visible,
            download_url=url,
            position=tuple(getattr(record, f"position_{axis}") for axis in "xyz"),
            quaternion=tuple(getattr(record, f"quaternion_{axis}") for axis in "xyzw"),
            scale=tuple(getattr(record, f"scale_{axis}") for axis in "xyz"),
        )

    async def list(self, project_id: str, request: Request) -> tuple[list[SceneObject], int]:
        records, revision = await self.repository.list(project_id)
        return [await self._model(record, request) for record in records], revision

    async def add(
        self, project_id: str, data: SceneObjectCreate, expected: int, request: Request
    ) -> tuple[SceneObject, int]:
        try:
            async with self.repository.sessions.begin() as session:
                asset = await session.get(
                    LibraryAssetRecord, data.library_asset_id, with_for_update=True
                )
                if asset is None or asset.status != "ready":
                    raise KeyError("Library asset not found or not ready")
                file = next(
                    (
                        f
                        for f in asset.files
                        if (
                            f.id == data.library_asset_file_id
                            if data.library_asset_file_id is not None
                            else f.is_primary
                        )
                    ),
                    None,
                )
                if file is None:
                    raise KeyError("Library asset file not found in this asset")
                quaternion = data.quaternion or quaternion_from_euler_xyz(
                    tuple(getattr(asset, f"default_rotation_{axis}_deg") for axis in "xyz")
                )
                scale = data.scale or (asset.default_scale,) * 3
                position = (
                    data.position
                    if data.position is not None
                    else transformed_offset(
                        quaternion,
                        scale,
                        tuple(getattr(asset, f"default_offset_{axis}") for axis in "xyz"),
                    )
                )
                # Revalidate computed defaults too (overflow/non-finite defaults must roll back).
                transform = SceneObjectUpdate(position=position, quaternion=quaternion, scale=scale)
                revision = await advance_project_revision(session, project_id, expected)
                record = await self.repository.add(
                    session,
                    project_id,
                    asset.id,
                    file.id,
                    data.parent_id,
                    transform.model_dump(exclude_unset=True),
                )
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        return await self._model(record, request), revision

    async def update(
        self,
        project_id: str,
        object_id: str,
        data: SceneObjectUpdate,
        expected: int,
        request: Request,
    ) -> tuple[SceneObject, int]:
        try:
            async with self.repository.sessions.begin() as session:
                revision = await advance_project_revision(session, project_id, expected)
                record = await self.repository.update(
                    session, project_id, object_id, data.model_dump(exclude_unset=True)
                )
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        return await self._model(record, request), revision

    async def remove(self, project_id: str, object_id: str, expected: int) -> int:
        try:
            async with self.repository.sessions.begin() as session:
                revision = await advance_project_revision(session, project_id, expected)
                await self.repository.remove(session, project_id, object_id)
            return revision
        except KeyError as error:
            raise HTTPException(404, str(error)) from error
