"""Editor availability and scoped worker transport."""

import asyncio
from contextlib import suppress
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, WebSocket
from starlette.websockets import WebSocketDisconnect

from camera_path.routers.auth import require_editor
from camera_path.routers.cli_auth import require_cli_worker
from camera_path.services.inference import (
    AttemptRequest,
    Claim,
    ClaimRequest,
    FailureRequest,
    Lease,
    Receipt,
    Registration,
    TerminalReplay,
    TransportStatus,
)
from camera_path.services.inference_artifacts import CompleteRequest, UploadRequest, UploadResponse

router = APIRouter(prefix="/inference", tags=["Local inference"])
Worker = Annotated[str, Depends(require_cli_worker)]


@router.get("/status", operation_id="getInferenceStatus", dependencies=[Depends(require_editor)])
async def status(request: Request) -> TransportStatus:
    """List connected capabilities and which are currently available to take a job."""
    return await request.app.state.inference.status()


@router.put("/worker", status_code=204, operation_id="registerInferenceWorker")
async def register(data: Registration, request: Request, worker: Worker) -> None:
    """Register the model capabilities readied by this authenticated CLI session."""
    request.app.state.inference.register(worker, data.capabilities)


@router.websocket("/commands")
async def commands(socket: WebSocket):
    auth = socket.app.state.cli_auth_service
    service = socket.app.state.inference
    scheme, _, token = socket.headers.get("authorization", "").partition(" ")
    token = token if scheme.lower() == "bearer" else None
    # Accept first so the CLI can distinguish revocation from reconnectable loss.
    await socket.accept()
    try:
        worker = await auth.principal(token)
    except HTTPException:
        await socket.close(code=4401)
        return
    if not service.attach(worker, socket):
        await socket.close(code=4409)
        return
    receive = asyncio.create_task(socket.receive())
    try:
        auth_check = 0
        offered = None
        last_offer = 0
        loop = asyncio.get_running_loop()
        while not receive.done():
            now = loop.time()
            if now >= auth_check:
                try:
                    await auth.principal(token)
                except HTTPException:
                    await socket.close(code=4401)
                    return
                auth_check = now + 5
            next_job = await service.next_for(worker)
            if next_job and (next_job != offered or now - last_offer >= 2):
                await socket.send_json(
                    {
                        "schema_version": 1,
                        "type": "command.available",
                        "job_id": next_job[0],
                        "command": next_job[1],
                    }
                )
                last_offer = now
            offered = next_job
            await asyncio.wait((receive,), timeout=0.35)
        if receive.result()["type"] != "websocket.disconnect":
            await socket.close(code=1008)
    except (WebSocketDisconnect, OSError):
        pass
    finally:
        service.detach(worker, socket)
        receive.cancel()
        with suppress(asyncio.CancelledError):
            await receive


@router.post("/jobs/{job_id}/claim", operation_id="claimInferenceJob")
async def claim(job_id: UUID, data: ClaimRequest, request: Request, worker: Worker) -> Claim:
    """Atomically acquire an available job or repeat the same active claim."""
    return await request.app.state.inference.claim(worker, str(job_id), str(data.claim_id))


@router.post("/jobs/{job_id}/heartbeat", operation_id="renewInferenceLease")
async def heartbeat(job_id: UUID, data: AttemptRequest, request: Request, worker: Worker) -> Lease:
    """Renew an unexpired attempt held by this worker."""
    return await request.app.state.inference.renew(worker, str(job_id), str(data.attempt_id))


@router.get(
    "/jobs/{job_id}/source-image",
    operation_id="getInferenceSourceImage",
    response_class=Response,
    responses={
        200: {
            "content": {
                f"image/{format}": {"schema": {"type": "string", "format": "binary"}}
                for format in ("png", "jpeg", "webp")
            }
        }
    },
)
async def source_image(
    job_id: UUID, attempt_id: UUID, request: Request, worker: Worker
) -> Response:
    """Read only the source image bound to the active, owned job attempt."""
    service = request.app.state.inference
    async with service.sessions() as session:
        await service.require(session, worker, str(job_id), str(attempt_id))
    data, media_type = await service.jobs.image_content(str(job_id), source=True)
    return Response(data, media_type=media_type, headers={"Cache-Control": "no-store"})


@router.post("/jobs/{job_id}/uploads", operation_id="reserveInferenceUploads")
async def reserve(
    job_id: UUID, data: UploadRequest, request: Request, worker: Worker
) -> UploadResponse:
    """Reserve staged upload destinations or replay matching reservations."""
    from sqlalchemy import text

    service = request.app.state.inference
    async with service.sessions.begin() as session:
        await session.execute(text("BEGIN IMMEDIATE"))
        await service.require(session, worker, str(job_id), str(data.attempt_id))
        return await request.app.state.inference_artifacts.reserve(
            session, str(job_id), data, request
        )


@router.put(
    "/jobs/{job_id}/uploads/{upload_id}",
    status_code=204,
    name="put_inference_upload",
    operation_id="putInferenceUpload",
)
async def put(
    job_id: UUID, upload_id: UUID, attempt_id: UUID, request: Request, worker: Worker
) -> None:
    """Accept one bounded staged file in local development."""
    service = request.app.state.inference

    async def guard(session):
        return await service.require(session, worker, str(job_id), str(attempt_id))

    await request.app.state.inference_artifacts.put(
        str(job_id),
        str(upload_id),
        str(attempt_id),
        request,
        guard,
    )


@router.post("/jobs/{job_id}/complete", operation_id="completeInferenceJob")
async def complete(
    job_id: UUID, data: CompleteRequest, request: Request, worker: Worker
) -> Receipt:
    """Verify staged files and publish a fenced result exactly once."""
    service = request.app.state.inference
    fingerprint = service.fingerprint("complete", data)

    async def guard(session):
        return await service.require(
            session, worker, str(job_id), str(data.attempt_id), fingerprint
        )

    async def finalize(session, job, result):
        await service.finalize(session, worker, job.id, str(data.attempt_id), fingerprint, result)

    try:
        result = await request.app.state.inference_artifacts.complete(
            str(job_id), data, guard, finalize
        )
    except TerminalReplay as replay:
        result = replay.result
    return Receipt.model_validate(result)


@router.post("/jobs/{job_id}/fail", operation_id="failInferenceJob")
async def fail(job_id: UUID, data: FailureRequest, request: Request, worker: Worker) -> Receipt:
    """Record or replay a terminal worker failure without publishing artifacts."""
    return Receipt.model_validate(await request.app.state.inference.fail(worker, str(job_id), data))
