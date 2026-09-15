from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Header, Request

from camera_path.agent import TrajectoryAgent
from camera_path.repository import RevisionConflictError
from camera_path.service import TrajectoryService

_ETAG_PATTERN = re.compile(r'^(?:W/)?"(?P<revision>\d+)"$')


class PreconditionRequiredError(RuntimeError):
    pass


def get_service(request: Request) -> TrajectoryService:
    return request.app.state.trajectory_service


def get_agent(request: Request) -> TrajectoryAgent:
    return request.app.state.trajectory_agent


Service = Annotated[TrajectoryService, Depends(get_service)]
Agent = Annotated[TrajectoryAgent, Depends(get_agent)]


def project_etag(revision: int) -> str:
    return f'"{revision}"'


def _parse_if_match(value: str) -> int:
    match = _ETAG_PATTERN.fullmatch(value.strip())
    if match is None:
        raise RevisionConflictError('If-Match must contain a project revision ETag')
    return int(match.group('revision'))


async def guard_project_mutation(
    request: Request,
    project_id: str,
    service: Service,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> AsyncIterator[None]:
    locks: dict[str, asyncio.Lock] = request.app.state.project_mutation_locks
    lock = locks.setdefault(project_id, asyncio.Lock())
    async with lock:
        if request.url.path.startswith("/api/v1/"):
            if if_match is None:
                raise PreconditionRequiredError("If-Match is required for this mutation")
            project = await service.get_project(project_id)
            expected_revision = _parse_if_match(if_match)
            if expected_revision != project.revision:
                raise RevisionConflictError(
                    f"expected revision {expected_revision}, current revision is {project.revision}"
                )
        yield


MutationGuard = Annotated[None, Depends(guard_project_mutation)]
