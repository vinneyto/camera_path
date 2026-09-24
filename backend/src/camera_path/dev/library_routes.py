"""Local upload/download endpoints supplied only by the filesystem adapter."""

from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import FileResponse

from camera_path.dev.library_storage import LocalLibraryStorage
from camera_path.services.library import LibraryService

router = APIRouter(prefix="/library", include_in_schema=False)


def local_service(request: Request) -> tuple[LibraryService, LocalLibraryStorage]:
    service: LibraryService = request.app.state.library_service
    storage = service.storage
    if not isinstance(storage, LocalLibraryStorage):
        raise HTTPException(404)
    return service, storage


@router.put("/{asset_id}/content", name="upload_local_library_content")
async def upload_local_library_content(asset_id: str, request: Request) -> Response:
    service, storage = local_service(request)
    asset = await service.get_record(asset_id)
    if asset.status != "pending":
        raise HTTPException(409, "Upload has already been completed")
    path = storage.path(asset.object_key)
    temporary = path.with_name(f"{path.name}.{uuid4().hex}.upload")
    count = 0
    try:
        with temporary.open("wb") as output:
            async for chunk in request.stream():
                count += len(chunk)
                if count > asset.size_bytes:
                    raise HTTPException(413, "File exceeds declared size")
                output.write(chunk)
        if count != asset.size_bytes:
            raise HTTPException(422, "File size does not match upload")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{asset_id}/content", name="download_local_library_content")
async def download_local_library_content(asset_id: str, request: Request) -> FileResponse:
    service, storage = local_service(request)
    asset = await service.get_record(asset_id)
    if asset.status != "ready":
        raise HTTPException(404)
    path = storage.path(asset.object_key)
    if not path.is_file():
        raise HTTPException(404, "Library file is missing")
    return FileResponse(path, media_type="application/octet-stream")
