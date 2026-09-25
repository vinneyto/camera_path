from typing import Annotated

from fastapi import APIRouter, Depends, Request

from camera_path.services.library import (
    LibraryAsset,
    LibraryAssetDefaultsUpdate,
    LibraryService,
    LibraryUpload,
    LibraryUploadCreate,
)

router = APIRouter(prefix="/library", tags=["Library"])


def get_library_service(request: Request) -> LibraryService:
    return request.app.state.library_service


Library = Annotated[LibraryService, Depends(get_library_service)]


@router.get(
    "",
    response_model=list[LibraryAsset],
    operation_id="listLibraryAssets",
    description="List ready 3DGS files in the reusable library.",
)
async def list_library_assets(request: Request, service: Library) -> list[LibraryAsset]:
    return await service.list(request)


@router.patch(
    "/{asset_id}/defaults",
    response_model=LibraryAsset,
    operation_id="updateLibraryAssetDefaults",
    description="Set XYZ Euler angles in degrees (Three.js XYZ order) and uniform scale.",
)
async def update_library_asset_defaults(
    asset_id: str, data: LibraryAssetDefaultsUpdate, request: Request, service: Library
) -> LibraryAsset:
    return await service.update_defaults(asset_id, data, request)


@router.post(
    "/uploads",
    response_model=LibraryUpload,
    status_code=201,
    operation_id="createLibraryUpload",
    description="Create a pending file and obtain an upload URL.",
)
async def create_library_upload(
    data: LibraryUploadCreate, request: Request, service: Library
) -> LibraryUpload:
    return await service.create(data, request)


@router.post(
    "/{asset_id}/complete",
    response_model=LibraryAsset,
    operation_id="completeLibraryUpload",
    description="Validate the uploaded PLY and publish it in the library.",
)
async def complete_library_upload(
    asset_id: str, request: Request, service: Library
) -> LibraryAsset:
    return await service.complete(asset_id, request)
