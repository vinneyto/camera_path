import asyncio
import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from jsonschema import ValidationError

from camera_path.routers.auth import AuthenticatedRoute, authenticated
from camera_path.routers.dependencies import MutationGuard
from camera_path.services.pipeline_models import Pipeline, PipelineCreate

router = APIRouter(route_class=AuthenticatedRoute, tags=["Chat"])


@router.get(
    "/projects/{project_id}/pipelines",
    response_model=list[Pipeline],
    operation_id="listProjectPipelines",
)
async def list_pipelines(project_id: str, request: Request):
    """List saved command definitions and complete execution reports for this project."""
    return await request.app.state.pipeline_service.list(project_id)


@router.get(
    "/projects/{project_id}/pipelines/events",
    operation_id="streamPipelineEvents",
    response_class=StreamingResponse,
    description="SSE snapshot followed by durable pipeline/step events. Supports Last-Event-ID.",
)
async def pipeline_events(
    project_id: str, request: Request, last_event_id: str | None = Header(default=None)
):
    service = request.app.state.pipeline_service
    await service.repository.get(project_id)
    try:
        cursor = max(0, int(last_event_id)) if last_event_id else await service.cursor(project_id)
    except ValueError:
        cursor = await service.cursor(project_id)
    snapshot = [p.model_dump(mode="json") for p in await service.list(project_id)]

    async def events():
        nonlocal cursor
        yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"
        heartbeat = 0
        while not await request.is_disconnected():
            rows = await service.events(project_id, cursor)
            for event_id, payload in rows:
                cursor = event_id
                yield f"id: {event_id}\nevent: pipeline\ndata: {json.dumps(payload)}\n\n"
            heartbeat += 1
            if heartbeat >= 40:
                yield ": keep-alive\n\n"
                heartbeat = 0
            await asyncio.sleep(0.25)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/projects/{project_id}/pipelines",
    response_model=Pipeline,
    status_code=201,
    operation_id="createProjectPipeline",
)
@authenticated
async def create_pipeline(
    project_id: str, data: PipelineCreate, request: Request, _guard: MutationGuard
):
    """Validate and save an immutable command pipeline; auto mode queues execution immediately."""
    try:
        return await request.app.state.pipeline_service.create(
            project_id, data.message_id, data.definition
        )
    except (ValueError, ValidationError) as error:
        raise HTTPException(422, str(error)) from error


@router.get(
    "/projects/{project_id}/pipelines/{pipeline_id}",
    response_model=Pipeline,
    operation_id="getProjectPipeline",
)
async def get_pipeline(project_id: str, pipeline_id: str, request: Request):
    """Read a project-scoped pipeline definition, resolved inputs, results and errors."""
    return await request.app.state.pipeline_service.get(project_id, pipeline_id)


@router.post(
    "/projects/{project_id}/pipelines/{pipeline_id}/confirm",
    response_model=Pipeline,
    operation_id="confirmProjectPipeline",
)
@authenticated
async def confirm_pipeline(
    project_id: str, pipeline_id: str, request: Request, _guard: MutationGuard
):
    """Queue the exact pending definition once; repeated confirmation is idempotent."""
    return await request.app.state.pipeline_service.confirm(project_id, pipeline_id)
