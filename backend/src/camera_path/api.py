from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from openai import OpenAIError

from camera_path.agent import AgentUnavailableError, TrajectoryAgent
from camera_path.config import Settings, settings
from camera_path.geometry import GeometryError
from camera_path.models import (
    AnchorCreate,
    AnchorUpdate,
    CameraKeyframeCreate,
    CameraKeyframeUpdate,
    CameraTrackUpdate,
    ChatMessage,
    ChatResult,
    CompiledTrajectory,
    MotionProfileUpdate,
    Project,
    ProjectCreate,
    ProjectUpdate,
    ScenePointCreate,
    ScenePointUpdate,
    SpeedKeyframeCreate,
    SpeedKeyframeUpdate,
    SpiralSegmentCreate,
    SplineSegmentCreate,
)
from camera_path.repository import (
    ProjectNotFoundError,
    ProjectRepository,
    RevisionConflictError,
    SQLiteProjectRepository,
)
from camera_path.service import TrajectoryService

router = APIRouter()


def get_service(request: Request) -> TrajectoryService:
    return request.app.state.trajectory_service


def get_agent(request: Request) -> TrajectoryAgent:
    return request.app.state.trajectory_agent


Service = Annotated[TrajectoryService, Depends(get_service)]
Agent = Annotated[TrajectoryAgent, Depends(get_agent)]


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, service: Service) -> Project:
    return await service.create_project(data)


@router.get("/projects", response_model=list[Project])
async def list_projects(service: Service) -> list[Project]:
    return await service.list_projects()


@router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, service: Service) -> Project:
    return await service.get_project(project_id)


@router.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, data: ProjectUpdate, service: Service) -> Project:
    return await service.update_project(project_id, data)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, service: Service) -> Response:
    await service.delete_project(project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/projects/{project_id}/reset", response_model=Project)
async def reset_project(project_id: str, service: Service) -> Project:
    return await service.reset_project(project_id)


@router.delete("/projects/{project_id}/chat", response_model=Project)
async def clear_chat(project_id: str, service: Service) -> Project:
    return await service.clear_chat(project_id)


@router.delete("/projects/{project_id}/trajectory", response_model=Project)
async def clear_trajectory(project_id: str, service: Service) -> Project:
    return await service.clear_trajectory(project_id)


@router.post("/projects/{project_id}/anchors", response_model=Project)
async def add_anchor(project_id: str, data: AnchorCreate, service: Service) -> Project:
    return await service.add_anchor(project_id, data)


@router.patch("/projects/{project_id}/anchors/{anchor_id}", response_model=Project)
async def update_anchor(
    project_id: str, anchor_id: str, data: AnchorUpdate, service: Service
) -> Project:
    try:
        return await service.update_anchor(project_id, anchor_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/projects/{project_id}/anchors/{anchor_id}", response_model=Project)
async def delete_anchor(project_id: str, anchor_id: str, service: Service) -> Project:
    try:
        return await service.delete_anchor(project_id, anchor_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/projects/{project_id}/scene-points", response_model=Project)
async def add_scene_point(project_id: str, data: ScenePointCreate, service: Service) -> Project:
    return await service.add_scene_point(project_id, data)


@router.patch("/projects/{project_id}/scene-points/{point_id}", response_model=Project)
async def update_scene_point(
    project_id: str, point_id: str, data: ScenePointUpdate, service: Service
) -> Project:
    try:
        return await service.update_scene_point(project_id, point_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/projects/{project_id}/scene-points/{point_id}", response_model=Project)
async def delete_scene_point(
    project_id: str, point_id: str, service: Service, cascade: bool = False
) -> Project:
    try:
        return await service.delete_scene_point(project_id, point_id, cascade)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/projects/{project_id}/segments/spline", response_model=Project)
async def add_spline(project_id: str, data: SplineSegmentCreate, service: Service) -> Project:
    return await service.add_spline(project_id, data)


@router.post("/projects/{project_id}/segments/spiral", response_model=Project)
async def add_spiral(project_id: str, data: SpiralSegmentCreate, service: Service) -> Project:
    return await service.add_spiral(project_id, data)


@router.delete("/projects/{project_id}/segments/{segment_id}", response_model=Project)
async def delete_segment(project_id: str, segment_id: str, service: Service) -> Project:
    try:
        return await service.delete_segment(project_id, segment_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/projects/{project_id}/motion/keyframes", response_model=Project)
async def add_speed_keyframe(
    project_id: str, data: SpeedKeyframeCreate, service: Service
) -> Project:
    return await service.add_speed_keyframe(project_id, data)


@router.patch("/projects/{project_id}/motion", response_model=Project)
async def update_motion_profile(
    project_id: str, data: MotionProfileUpdate, service: Service
) -> Project:
    return await service.update_motion_profile(project_id, data)


@router.patch("/projects/{project_id}/motion/keyframes/{keyframe_id}", response_model=Project)
async def update_speed_keyframe(
    project_id: str, keyframe_id: str, data: SpeedKeyframeUpdate, service: Service
) -> Project:
    try:
        return await service.update_speed_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/projects/{project_id}/motion/keyframes/{keyframe_id}", response_model=Project)
async def delete_speed_keyframe(project_id: str, keyframe_id: str, service: Service) -> Project:
    try:
        return await service.delete_speed_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/projects/{project_id}/camera/keyframes", response_model=Project)
async def add_camera_keyframe(
    project_id: str, data: CameraKeyframeCreate, service: Service
) -> Project:
    return await service.add_camera_keyframe(project_id, data)


@router.patch("/projects/{project_id}/camera", response_model=Project)
async def update_camera_track(
    project_id: str, data: CameraTrackUpdate, service: Service
) -> Project:
    return await service.update_camera_track(project_id, data)


@router.patch("/projects/{project_id}/camera/keyframes/{keyframe_id}", response_model=Project)
async def update_camera_keyframe(
    project_id: str, keyframe_id: str, data: CameraKeyframeUpdate, service: Service
) -> Project:
    try:
        return await service.update_camera_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/projects/{project_id}/camera/keyframes/{keyframe_id}", response_model=Project)
async def delete_camera_keyframe(project_id: str, keyframe_id: str, service: Service) -> Project:
    try:
        return await service.delete_camera_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/projects/{project_id}/trajectory/compiled", response_model=CompiledTrajectory)
async def compiled_trajectory(project_id: str, service: Service) -> CompiledTrajectory:
    return await service.compile(project_id)


@router.post("/projects/{project_id}/undo", response_model=Project)
async def undo(project_id: str, service: Service) -> Project:
    return await service.undo(project_id)


@router.post("/projects/{project_id}/redo", response_model=Project)
async def redo(project_id: str, service: Service) -> Project:
    return await service.redo(project_id)


@router.post("/projects/{project_id}/chat/messages", response_model=ChatResult)
async def chat(project_id: str, data: ChatMessage, agent: Agent) -> ChatResult:
    try:
        return await agent.handle(project_id, data.message)
    except AgentUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail="OpenAI request failed") from error


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/projects/{project_id}/chat/messages/stream")
async def stream_chat(
    project_id: str, data: ChatMessage, agent: Agent, service: Service
) -> StreamingResponse:
    try:
        agent.ensure_available()
    except AgentUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    await service.get_project(project_id)

    async def events() -> AsyncIterator[str]:
        try:
            async for event in agent.handle_stream(project_id, data.message):
                if event["type"] == "result":
                    payload = event["result"].model_dump(mode="json")
                else:
                    payload = {"text": event["text"]}
                yield _sse(event["type"], payload)
        except (OpenAIError, ProjectNotFoundError, RuntimeError) as error:
            yield _sse("error", {"detail": str(error)})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def create_app(
    app_settings: Settings | None = None,
    repository: ProjectRepository | None = None,
) -> FastAPI:
    configured = app_settings or settings
    project_repository = repository or SQLiteProjectRepository(configured.database_path)
    service = TrajectoryService(project_repository, configured.compile_tolerance)
    agent = TrajectoryAgent(
        service,
        configured.openai_model,
        configured.openai_api_key.get_secret_value() if configured.openai_api_key else None,
    )

    application = FastAPI(title="Camera Path API", version="0.3.0")
    application.state.trajectory_service = service
    application.state.trajectory_agent = agent
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.exception_handler(ProjectNotFoundError)
    async def project_not_found(_request: Request, error: ProjectNotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=404, content={"detail": f"project {error.args[0]} not found"}
        )

    @application.exception_handler(GeometryError)
    async def invalid_geometry(_request: Request, error: GeometryError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(error)})

    @application.exception_handler(RevisionConflictError)
    async def revision_conflict(_request: Request, error: RevisionConflictError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(error)})

    application.include_router(router)
    return application


app = create_app()
