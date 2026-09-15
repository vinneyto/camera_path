from __future__ import annotations

from typing import Any

from fastapi import Response

from camera_path.models import ErrorResponse, Project
from camera_path.routers.dependencies import project_etag

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse, "description": "The requested resource was not found."},
    409: {"model": ErrorResponse, "description": "Revision or reference conflict."},
    422: {"model": ErrorResponse, "description": "Invalid request or trajectory geometry."},
}

MUTATION_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    **ERROR_RESPONSES,
    428: {"model": ErrorResponse, "description": "The If-Match header is required."},
}

CHAT_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    **MUTATION_ERROR_RESPONSES,
    502: {"model": ErrorResponse, "description": "The OpenAI request failed."},
    503: {"model": ErrorResponse, "description": "The trajectory agent is unavailable."},
}


def with_project_etag(response: Response, project: Project) -> Project:
    response.headers["ETag"] = project_etag(project.revision)
    return project


def set_revision_etag(response: Response, revision: int) -> None:
    response.headers["ETag"] = project_etag(revision)
