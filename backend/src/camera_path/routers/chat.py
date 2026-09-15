from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
from openai import OpenAIError

from camera_path.agent import AgentUnavailableError
from camera_path.models import ChatMessage, ChatResult, Project
from camera_path.repository import ProjectNotFoundError
from camera_path.routers.contract import CHAT_ERROR_RESPONSES, with_project_etag
from camera_path.routers.dependencies import Agent, MutationGuard, Service

router = APIRouter(tags=["Chat"])


@router.delete(
    "/projects/{project_id}/chat",
    response_model=Project,
    summary="Clear chat history",
    description="Remove chat messages while preserving the scene and trajectory.",
    operation_id="clearProjectChat",
    responses=CHAT_ERROR_RESPONSES,
)
async def clear_chat(
    project_id: str, service: Service, response: Response, _guard: MutationGuard
) -> Project:
    return with_project_etag(response, await service.clear_chat(project_id))


@router.post(
    "/projects/{project_id}/chat/messages",
    response_model=ChatResult,
    summary="Send a chat message",
    description="Run the trajectory agent and return its complete response.",
    operation_id="createChatMessage",
    responses=CHAT_ERROR_RESPONSES,
)
async def chat(
    project_id: str,
    data: ChatMessage,
    agent: Agent,
    response: Response,
    _guard: MutationGuard,
) -> ChatResult:
    try:
        result = await agent.handle(project_id, data.message, data.id)
    except AgentUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail="OpenAI request failed") from error
    response.headers["ETag"] = f'"{result.project.revision}"'
    return result


@router.post(
    "/projects/{project_id}/chat/user-messages",
    response_model=Project,
    summary="Save a user chat message",
    description="Persist a user message idempotently without running the agent.",
    operation_id="saveUserChatMessage",
    responses=CHAT_ERROR_RESPONSES,
)
async def save_user_message(
    project_id: str,
    data: ChatMessage,
    service: Service,
    response: Response,
    _guard: MutationGuard,
) -> Project:
    project = await service.save_user_message(project_id, data.id, data.message)
    return with_project_etag(response, project)


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post(
    "/projects/{project_id}/chat/messages/stream",
    summary="Stream a chat response",
    description=(
        "Run the trajectory agent as an SSE stream. `delta` events contain incremental text, "
        "`result` contains the final ChatResult, and `error` reports a failure after streaming "
        "has started."
    ),
    operation_id="streamChatMessage",
    response_class=StreamingResponse,
    responses={
        **CHAT_ERROR_RESPONSES,
        200: {
            "description": "Server-sent events named delta, result, or error.",
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        },
    },
)
async def stream_chat(
    project_id: str,
    data: ChatMessage,
    agent: Agent,
    service: Service,
    _guard: MutationGuard,
) -> StreamingResponse:
    await service.save_user_message(project_id, data.id, data.message)
    try:
        agent.ensure_available()
    except AgentUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    async def events() -> AsyncIterator[str]:
        try:
            async for event in agent.handle_stream(project_id, data.message, data.id):
                if event["type"] == "result":
                    payload = event["result"].model_dump(mode="json")
                else:
                    payload = {"text": event["text"]}
                yield _sse(event["type"], payload)
        except (OpenAIError, ProjectNotFoundError, RuntimeError) as error:
            yield _sse("error", {"code": "stream_error", "detail": str(error)})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
