from __future__ import annotations

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse

from camera_path.agent import AgentUnavailableError, TrajectoryAgent
from camera_path.config import settings
from camera_path.geometry import GeometryError
from camera_path.models import (
    AnchorCreate,
    ChatMessage,
    ChatResult,
    CompiledTrajectory,
    Project,
    ProjectCreate,
    SpiralSegmentCreate,
    SplineSegmentCreate,
)
from camera_path.repository import (
    InMemoryProjectRepository,
    ProjectNotFoundError,
    RevisionConflictError,
)
from camera_path.service import TrajectoryService

repository = InMemoryProjectRepository()
service = TrajectoryService(repository)
agent = TrajectoryAgent(repository, settings.openai_model)

app = FastAPI(title="Camera Path API", version="0.1.0")


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


@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    return await repository.get(project_id)


@app.post("/projects/{project_id}/anchors", response_model=Project)
async def add_anchor(project_id: str, data: AnchorCreate) -> Project:
    return await service.add_anchor(project_id, data)


@app.post("/projects/{project_id}/segments/spline", response_model=Project)
async def add_spline(project_id: str, data: SplineSegmentCreate) -> Project:
    return await service.add_spline(project_id, data)


@app.post("/projects/{project_id}/segments/spiral", response_model=Project)
async def add_spiral(project_id: str, data: SpiralSegmentCreate) -> Project:
    return await service.add_spiral(project_id, data)


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
