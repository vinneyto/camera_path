from __future__ import annotations

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from camera_path.agent import AgentUnavailableError, TrajectoryAgent
from camera_path.config import settings
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
    ScenePointCreate,
    ScenePointUpdate,
    SpeedKeyframeCreate,
    SpeedKeyframeUpdate,
    SpiralSegmentCreate,
    SplineSegmentCreate,
)
from camera_path.repository import (
    ProjectNotFoundError,
    RevisionConflictError,
    SQLiteProjectRepository,
)
from camera_path.service import TrajectoryService

repository = SQLiteProjectRepository(settings.database_path)
service = TrajectoryService(repository)
agent = TrajectoryAgent(repository, settings.openai_model)

app = FastAPI(title="Camera Path API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ProjectNotFoundError)
async def project_not_found(_request: object, error: ProjectNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": f"project {error.args[0]} not found"})


@app.exception_handler(GeometryError)
async def invalid_geometry(_request: object, error: GeometryError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(error)})


@app.exception_handler(RevisionConflictError)
async def revision_conflict(_request: object, error: RevisionConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(error)})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate) -> Project:
    return await service.create_project(data)


@app.get("/projects", response_model=list[Project])
async def list_projects() -> list[Project]:
    return await repository.list()


@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    return await repository.get(project_id)


@app.post("/projects/{project_id}/anchors", response_model=Project)
async def add_anchor(project_id: str, data: AnchorCreate) -> Project:
    return await service.add_anchor(project_id, data)


@app.patch("/projects/{project_id}/anchors/{anchor_id}", response_model=Project)
async def update_anchor(project_id: str, anchor_id: str, data: AnchorUpdate) -> Project:
    try:
        return await service.update_anchor(project_id, anchor_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/projects/{project_id}/anchors/{anchor_id}", response_model=Project)
async def delete_anchor(project_id: str, anchor_id: str) -> Project:
    try:
        return await service.delete_anchor(project_id, anchor_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/projects/{project_id}/scene-points", response_model=Project)
async def add_scene_point(project_id: str, data: ScenePointCreate) -> Project:
    return await service.add_scene_point(project_id, data)


@app.patch("/projects/{project_id}/scene-points/{point_id}", response_model=Project)
async def update_scene_point(
    project_id: str, point_id: str, data: ScenePointUpdate
) -> Project:
    try:
        return await service.update_scene_point(project_id, point_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/projects/{project_id}/scene-points/{point_id}", response_model=Project)
async def delete_scene_point(project_id: str, point_id: str, cascade: bool = False) -> Project:
    try:
        return await service.delete_scene_point(project_id, point_id, cascade)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/projects/{project_id}/segments/spline", response_model=Project)
async def add_spline(project_id: str, data: SplineSegmentCreate) -> Project:
    return await service.add_spline(project_id, data)


@app.post("/projects/{project_id}/segments/spiral", response_model=Project)
async def add_spiral(project_id: str, data: SpiralSegmentCreate) -> Project:
    return await service.add_spiral(project_id, data)


@app.delete("/projects/{project_id}/segments/{segment_id}", response_model=Project)
async def delete_segment(project_id: str, segment_id: str) -> Project:
    try:
        return await service.delete_segment(project_id, segment_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/projects/{project_id}/motion/keyframes", response_model=Project)
async def add_speed_keyframe(project_id: str, data: SpeedKeyframeCreate) -> Project:
    return await service.add_speed_keyframe(project_id, data)


@app.patch("/projects/{project_id}/motion", response_model=Project)
async def update_motion_profile(project_id: str, data: MotionProfileUpdate) -> Project:
    return await service.update_motion_profile(project_id, data)


@app.patch("/projects/{project_id}/motion/keyframes/{keyframe_id}", response_model=Project)
async def update_speed_keyframe(
    project_id: str, keyframe_id: str, data: SpeedKeyframeUpdate
) -> Project:
    try:
        return await service.update_speed_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/projects/{project_id}/motion/keyframes/{keyframe_id}", response_model=Project)
async def delete_speed_keyframe(project_id: str, keyframe_id: str) -> Project:
    try:
        return await service.delete_speed_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/projects/{project_id}/camera/keyframes", response_model=Project)
async def add_camera_keyframe(project_id: str, data: CameraKeyframeCreate) -> Project:
    return await service.add_camera_keyframe(project_id, data)


@app.patch("/projects/{project_id}/camera", response_model=Project)
async def update_camera_track(project_id: str, data: CameraTrackUpdate) -> Project:
    return await service.update_camera_track(project_id, data)


@app.patch("/projects/{project_id}/camera/keyframes/{keyframe_id}", response_model=Project)
async def update_camera_keyframe(
    project_id: str, keyframe_id: str, data: CameraKeyframeUpdate
) -> Project:
    try:
        return await service.update_camera_keyframe(project_id, keyframe_id, data)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/projects/{project_id}/camera/keyframes/{keyframe_id}", response_model=Project)
async def delete_camera_keyframe(project_id: str, keyframe_id: str) -> Project:
    try:
        return await service.delete_camera_keyframe(project_id, keyframe_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/projects/{project_id}/trajectory/compiled", response_model=CompiledTrajectory)
async def compiled_trajectory(project_id: str) -> CompiledTrajectory:
    return await service.compile(project_id)


@app.post("/projects/{project_id}/undo", response_model=Project)
async def undo(project_id: str) -> Project:
    return await repository.undo(project_id)


@app.post("/projects/{project_id}/redo", response_model=Project)
async def redo(project_id: str) -> Project:
    return await repository.redo(project_id)


@app.post("/projects/{project_id}/chat/messages", response_model=ChatResult)
async def chat(project_id: str, data: ChatMessage) -> ChatResult:
    try:
        return await agent.handle(project_id, data.message)
    except AgentUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
