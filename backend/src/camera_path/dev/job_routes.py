"""Dev-only job completion endpoints backed by the durable local queue."""

from fastapi import APIRouter, HTTPException, Request
from fastapi.routing import APIRoute
from sqlalchemy.exc import SQLAlchemyError

from camera_path.services.job_completion_models import (
    MAX_MESSAGE_BYTES,
    JobCompletionAccepted,
    JobCompletionMessage,
    JobCompletionStatus,
)
from camera_path.services.library_metadata import LibraryError, canonical_uuid


class BoundedJobRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def bounded(request: Request):
            if getattr(request.app.state, "environment", None) != "development":
                raise HTTPException(404)
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
    prefix="/dev/job-completions", tags=["Job completions"], route_class=BoundedJobRoute
)


@router.post(
    "",
    response_model=JobCompletionAccepted,
    status_code=202,
    operation_id="enqueueJobCompletion",
    description="Durably enqueue a JSON job completion in development mode.",
    responses={
        409: {"description": "Message ID reused with different content"},
        413: {"description": "JSON body exceeds 256 KiB"},
        503: {"description": "Durable queue acceptance unavailable"},
    },
)
async def enqueue_job_completion(data: JobCompletionMessage, request: Request):
    try:
        await request.app.state.message_queue.enqueue(data)
    except SQLAlchemyError as error:
        raise LibraryError("queue_unavailable", 503) from error
    return JobCompletionAccepted(message_id=data.message_id)


@router.get(
    "/{message_id}",
    response_model=JobCompletionStatus,
    operation_id="getJobCompletionStatus",
    description="Read the durable result of a dev completion message without authentication.",
)
async def get_job_completion_status(message_id: str, request: Request):
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
