from __future__ import annotations

import asyncio
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from scalar_fastapi import get_scalar_api_reference
from starlette.exceptions import HTTPException as StarletteHTTPException

from camera_path.agent import TrajectoryAgent
from camera_path.config import Settings, settings
from camera_path.repository import (
    ProjectNotFoundError,
    ProjectRepository,
    RevisionConflictError,
    SQLiteProjectRepository,
)
from camera_path.routers.api import router as business_router
from camera_path.routers.dependencies import PreconditionRequiredError
from camera_path.services import ChatMessageConflictError, TrajectoryService
from camera_path.trajectory import GeometryError

API_PREFIX = "/api/v1"
OPENAPI_URL = f"{API_PREFIX}/openapi.json"
ETAG_OPERATION_IDS = {
    "createProject",
    "getProject",
    "updateProject",
    "resetProject",
    "createAnchor",
    "updateAnchor",
    "deleteAnchor",
    "createScenePoint",
    "updateScenePoint",
    "deleteScenePoint",
    "clearTrajectory",
    "createSplineSegment",
    "createSpiralSegment",
    "deleteTrajectorySegment",
    "getCompiledTrajectory",
    "updateMotionProfile",
    "createSpeedKeyframe",
    "updateSpeedKeyframe",
    "deleteSpeedKeyframe",
    "updateCameraTrack",
    "createCameraAimKeyframe",
    "updateCameraAimKeyframe",
    "deleteCameraAimKeyframe",
    "updateCameraOrientation",
    "createCameraOrientationKeyframe",
    "updateCameraOrientationKeyframe",
    "deleteCameraOrientationKeyframe",
    "createDepthOfFieldKeyframe",
    "updateDepthOfFieldKeyframe",
    "deleteDepthOfFieldKeyframe",
    "undoProjectChange",
    "redoProjectChange",
    "clearProjectChat",
    "createChatMessage",
    "saveUserChatMessage",
}


def _is_versioned(request: Request) -> bool:
    return request.url.path.startswith(f"{API_PREFIX}/")


def _error_content(
    request: Request,
    code: str,
    detail: str,
    field_errors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not _is_versioned(request):
        if field_errors is not None:
            return {"detail": field_errors}
        return {"detail": detail}
    content: dict[str, Any] = {"code": code, "detail": detail}
    if field_errors is not None:
        content["field_errors"] = field_errors
    return content


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

    application = FastAPI(
        title="Camera Path API",
        summary="Semantic 3D camera trajectory authoring API",
        description=(
            "Create camera-path projects, author scene and trajectory data, edit playback "
            "timelines, and run the trajectory agent. Canonical operations use project revision "
            "ETags for optimistic concurrency."
        ),
        version="1.0.0",
        openapi_url=OPENAPI_URL,
        docs_url=None,
        redoc_url=None,
        openapi_tags=[
            {"name": "Projects", "description": "Project lifecycle and scene resources."},
            {"name": "Trajectory", "description": "Trajectory segments and compilation."},
            {"name": "Timelines", "description": "Motion and camera control timelines."},
            {"name": "History", "description": "Project undo and redo history."},
            {"name": "Chat", "description": "Trajectory-agent chat operations."},
        ],
    )
    application.state.trajectory_service = service
    application.state.trajectory_agent = agent
    application.state.project_mutation_locks: dict[str, asyncio.Lock] = {}
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["ETag"],
    )

    @application.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/docs", include_in_schema=False)
    async def scalar_docs():
        return get_scalar_api_reference(
            openapi_url=application.openapi_url or OPENAPI_URL,
            title=f"{application.title} — Scalar",
        )

    @application.exception_handler(ProjectNotFoundError)
    async def project_not_found(request: Request, error: ProjectNotFoundError) -> JSONResponse:
        detail = f"project {error.args[0]} not found"
        return JSONResponse(
            status_code=404,
            content=_error_content(request, "project_not_found", detail),
        )

    @application.exception_handler(GeometryError)
    async def invalid_geometry(request: Request, error: GeometryError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_content(request, "invalid_geometry", str(error)),
        )

    @application.exception_handler(RevisionConflictError)
    async def revision_conflict(request: Request, error: RevisionConflictError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=_error_content(request, "revision_conflict", str(error)),
        )

    @application.exception_handler(PreconditionRequiredError)
    async def precondition_required(
        request: Request, error: PreconditionRequiredError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=428,
            content=_error_content(request, "if_match_required", str(error)),
        )

    @application.exception_handler(ChatMessageConflictError)
    async def chat_message_conflict(
        request: Request, error: ChatMessageConflictError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content=_error_content(request, "chat_message_conflict", str(error)),
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        if not _is_versioned(request):
            return JSONResponse(
                status_code=422,
                content={"detail": jsonable_encoder(error.errors())},
            )
        fields = [
            {
                "location": list(item["loc"]),
                "message": item["msg"],
                "type": item["type"],
            }
            for item in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_error_content(
                request, "validation_error", "Request validation failed", fields
            ),
        )

    @application.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, error: StarletteHTTPException) -> JSONResponse:
        codes = {
            404: "not_found",
            409: "reference_conflict",
            502: "upstream_error",
            503: "agent_unavailable",
        }
        return JSONResponse(
            status_code=error.status_code,
            content=_error_content(
                request, codes.get(error.status_code, "http_error"), str(error.detail)
            ),
            headers=error.headers,
        )

    application.include_router(business_router, prefix=API_PREFIX)
    application.include_router(business_router, include_in_schema=False)

    def versioned_openapi() -> dict[str, Any]:
        if application.openapi_schema is not None:
            return application.openapi_schema
        schema = get_openapi(
            title=application.title,
            version=application.version,
            summary=application.summary,
            description=application.description,
            routes=application.routes,
            tags=application.openapi_tags,
        )
        for path, path_item in schema["paths"].items():
            if not path.startswith(f"{API_PREFIX}/"):
                continue
            for method, operation in path_item.items():
                if method not in {"post", "patch", "delete"} or "{project_id}" not in path:
                    continue
                for parameter in operation.get("parameters", []):
                    if parameter["in"] == "header" and parameter["name"] == "If-Match":
                        parameter["required"] = True
                        parameter["schema"] = {"type": "string", "examples": ['"4"']}
            for operation in path_item.values():
                if not isinstance(operation, dict) or operation.get("operationId") not in (
                    ETAG_OPERATION_IDS
                ):
                    continue
                for response in operation.get("responses", {}).values():
                    if "content" in response and any(
                        media_type == "application/json" for media_type in response["content"]
                    ):
                        response.setdefault("headers", {})["ETag"] = {
                            "description": "Revision of the returned project snapshot.",
                            "schema": {"type": "string", "examples": ['"4"']},
                        }
                        break
        application.openapi_schema = schema
        return schema

    application.openapi = versioned_openapi
    return application


app = create_app()
