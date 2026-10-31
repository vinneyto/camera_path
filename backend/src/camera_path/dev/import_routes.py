"""Dev-only HTTP producer for the durable local queue."""

from fastapi import APIRouter, Request
from sqlalchemy.exc import SQLAlchemyError

from camera_path.routers.auth import AuthenticatedRoute, authenticated
from camera_path.services.library_import_models import (
    MAX_MESSAGE_BYTES,
    LibraryImportAccepted,
    LibraryImportMessage,
    LibraryImportStatus,
)
from camera_path.services.library_metadata import LibraryError, canonical_uuid


class BoundedImportRoute(AuthenticatedRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def bounded(request: Request):
            if request.method == "POST":
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > MAX_MESSAGE_BYTES:
                        raise LibraryError("import_message_too_large", 413)
                    body.extend(chunk)
                request._body = bytes(body)
                try:
                    request._body.decode("utf-8")
                except UnicodeDecodeError as error:
                    raise LibraryError(
                        "validation_error",
                        422,
                        [
                            {
                                "location": ["body"],
                                "message": "Expected UTF-8 JSON",
                                "type": "value_error",
                            }
                        ],
                    ) from error
            return await handler(request)

        return bounded


router = APIRouter(
    prefix="/dev/library-imports", tags=["Library imports"], route_class=BoundedImportRoute
)


@router.post(
    "",
    response_model=LibraryImportAccepted,
    status_code=202,
    operation_id="enqueueLibraryImport",
    description="Durably enqueue a JSON library descriptor in development mode.",
    responses={
        409: {"description": "Message ID reused with different content"},
        413: {"description": "JSON body exceeds 256 KiB"},
        503: {"description": "Durable queue acceptance unavailable"},
    },
)
@authenticated
async def enqueue_library_import(data: LibraryImportMessage, request: Request):
    try:
        await request.app.state.message_queue.enqueue(data)
    except SQLAlchemyError as error:
        raise LibraryError("queue_unavailable", 503) from error
    return LibraryImportAccepted(message_id=data.message_id)


@router.get(
    "/{message_id}",
    response_model=LibraryImportStatus,
    operation_id="getLibraryImportStatus",
    description="Read the durable result of a dev import message as an editor.",
)
@authenticated
async def get_library_import_status(message_id: str, request: Request):
    try:
        message_id = canonical_uuid(message_id)
    except ValueError as error:
        raise LibraryError(
            "validation_error",
            422,
            [
                {
                    "location": ["path", "message_id"],
                    "message": "Invalid UUID",
                    "type": "value_error",
                }
            ],
        ) from error
    return await request.app.state.message_queue.status(message_id)
