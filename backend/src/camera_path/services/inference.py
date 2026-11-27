"""The database owns job delivery; WebSockets only announce available work."""

import asyncio
import hashlib
import logging
import time
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text

from camera_path.persistence.enums import JobStatus
from camera_path.persistence.inference_attempt import InferenceAttemptRecord as Attempt
from camera_path.persistence.records import JobRecord
from camera_path.services.library_metadata import LibraryError

logger = logging.getLogger(__name__)
Command = Literal["generate_image", "generate_model"]
COMMAND_TYPES = {"generate_image": "image_generation", "generate_model": "generation"}
LEASE_SECONDS = 300
MAX_ATTEMPTS = 3


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Registration(Contract):
    schema_version: Literal[1]
    capabilities: list[Command] = Field(max_length=2)


class TransportStatus(Contract):
    connected: bool
    capabilities: list[Command]
    available_capabilities: list[Command]


class ClaimRequest(Contract):
    claim_id: UUID


class AttemptRequest(Contract):
    attempt_id: UUID


class Failure(Contract):
    code: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_.-]+$")
    message: str = Field(min_length=1, max_length=1000)


class FailureRequest(AttemptRequest):
    error: Failure


class Lease(Contract):
    lease_expires_at: datetime


class Claim(Lease):
    attempt_id: UUID
    command: Command
    input: dict


class Receipt(Contract):
    job_id: str
    status: Literal["succeeded", "failed"]
    asset_ids: list[str]
    attachment_id: str | None = None


class TerminalReplay(Exception):
    def __init__(self, result):
        self.result = result


def command_for(job) -> Command | None:
    if (job.execution or {}).get("transport") != "cli":
        return None
    return next((key for key, kind in COMMAND_TYPES.items() if kind == job.type), None)


class InferenceService:
    def __init__(self, jobs, *, lease_seconds=LEASE_SECONDS):
        self.jobs = jobs
        self.sessions = jobs.sessions
        self.lease_seconds = lease_seconds
        self.registrations: dict[str, frozenset[Command]] = {}
        self.sockets: dict[str, object] = {}

    async def activate(self, *, image: bool, model: bool):
        # One-time transport adoption on first CLI-mode startup; stop/drain the
        # previous deployment first. Never re-queue an already-dispatched job.
        predicates = []
        if image:
            predicates.append(
                (JobRecord.type == "image_generation")
                & (JobRecord.execution["provider"].as_string() == "painter")
            )
        if model:
            predicates.append(JobRecord.type == "generation")
        if not predicates:
            return
        from sqlalchemy import or_

        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            jobs = await session.scalars(
                select(JobRecord).where(
                    or_(*predicates),
                    JobRecord.execution["transport"].as_string().is_(None),
                    JobRecord.status.in_((JobStatus.QUEUED, JobStatus.RUNNING)),
                )
            )
            for job in jobs:
                job.execution = {**(job.execution or {}), "transport": "cli"}
                if job.status == JobStatus.RUNNING or not job.generation_dispatch_pending:
                    self.mark_failed(
                        job,
                        "inference_transport_migration",
                        "Old worker dispatch outcome is unknown; create a new job to retry.",
                    )
                job.generation_dispatch_pending = False

    def register(self, worker_id: str, capabilities: Iterable[Command]) -> None:
        self.registrations[worker_id] = frozenset(capabilities)

    def attach(self, worker_id: str, connection: object) -> bool:
        if worker_id in self.sockets or worker_id not in self.registrations:
            return False
        self.sockets[worker_id] = connection
        return True

    def detach(self, worker_id: str, connection: object) -> None:
        if self.sockets.get(worker_id) is connection:
            del self.sockets[worker_id]

    def connected_capabilities(self) -> set[Command]:
        return set().union(*(self.registrations.get(k, ()) for k in self.sockets))

    async def status(self) -> TransportStatus:
        connected = {k: self.registrations.get(k, frozenset()) for k in self.sockets}
        async with self.sessions() as session:
            running = set(
                await session.scalars(
                    select(Attempt.worker_id).where(
                        Attempt.state == "active", Attempt.lease_expires_at > time.time()
                    )
                )
            )
        return TransportStatus(
            connected=bool(connected),
            capabilities=sorted(set().union(*connected.values())),
            available_capabilities=sorted(
                set().union(
                    *(
                        capabilities
                        for worker, capabilities in connected.items()
                        if worker not in running
                    )
                )
            ),
        )

    async def next_for(self, worker_id: str):
        kinds = [COMMAND_TYPES[cmd] for cmd in self.registrations.get(worker_id, ())]
        if not kinds:
            return None
        async with self.sessions() as session:
            busy = await session.scalar(
                select(Attempt.id).where(Attempt.worker_id == worker_id, Attempt.state == "active")
            )
            if busy:
                return None
            job = await session.scalar(
                select(JobRecord)
                .where(
                    JobRecord.type.in_(kinds),
                    JobRecord.status == JobStatus.QUEUED,
                    JobRecord.execution["transport"].as_string() == "cli",
                )
                .order_by(JobRecord.created_at, JobRecord.id)
                .limit(1)
            )
        return (job.id, command_for(job)) if job else None

    def offer(self, job, attempt):
        command = command_for(job)
        data = {"prompt": job.input["prompt"]} if "prompt" in job.input else {}
        if job.input.get("image_asset_id"):
            data["source_image"] = (
                f"/api/v1/inference/jobs/{job.id}/source-image?attempt_id={attempt.id}"
            )
        if command == "generate_image":
            data.update(
                {
                    k: job.execution[k]
                    for k in ("model", "revision", "seed", "width", "height", "steps")
                }
            )
        return Claim(
            attempt_id=attempt.id,
            command=command,
            input=data,
            lease_expires_at=datetime.fromtimestamp(attempt.lease_expires_at, UTC),
        )

    async def claim(self, worker_id: str, job_id: str, claim_id: str) -> Claim:
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            previous = await session.scalar(
                select(Attempt).where(Attempt.worker_id == worker_id, Attempt.claim_id == claim_id)
            )
            job = await session.get(JobRecord, job_id)
            if job is None or command_for(job) is None:
                raise LibraryError("inference_job_not_found", 404)
            if previous is not None:
                if previous.job_id != job_id or not self.active(previous, job):
                    raise LibraryError("inference_claim_conflict", 409)
                return self.offer(job, previous)
            capabilities = self.registrations.get(worker_id, ())
            if worker_id not in self.sockets or command_for(job) not in capabilities:
                raise LibraryError("inference_worker_unavailable", 409)
            busy = await session.scalar(
                select(Attempt.id).where(Attempt.worker_id == worker_id, Attempt.state == "active")
            )
            if busy or job.status != JobStatus.QUEUED:
                raise LibraryError("inference_claim_conflict", 409)
            ordinal = 1 + (
                await session.scalar(
                    select(func.max(Attempt.ordinal)).where(Attempt.job_id == job_id)
                )
                or 0
            )
            attempt = Attempt(
                id=str(uuid4()),
                job_id=job_id,
                worker_id=worker_id,
                claim_id=claim_id,
                lease_expires_at=time.time() + self.lease_seconds,
                state="active",
                ordinal=ordinal,
            )
            session.add(attempt)
            job.status = JobStatus.RUNNING
            job.started_at = job.started_at or datetime.now(UTC)
            job.generation_dispatch_pending = False
            return self.offer(job, attempt)

    @staticmethod
    def active(attempt, job):
        return (
            attempt.state == "active"
            and attempt.lease_expires_at > time.time()
            and job.status == JobStatus.RUNNING
        )

    async def owned(self, session, worker_id, job_id, attempt_id):
        attempt = await session.get(Attempt, attempt_id, populate_existing=True)
        if attempt is None or attempt.worker_id != worker_id or attempt.job_id != job_id:
            raise LibraryError("inference_attempt_not_found", 404)
        job = await session.get(JobRecord, job_id, populate_existing=True)
        if job is None:
            raise LibraryError("inference_job_not_found", 404)
        return attempt, job

    async def require(self, session, worker_id, job_id, attempt_id, terminal_hash=None):
        attempt, job = await self.owned(session, worker_id, job_id, attempt_id)
        if terminal_hash and attempt.terminal_hash == terminal_hash:
            raise TerminalReplay(attempt.terminal_result)
        if not self.active(attempt, job):
            raise LibraryError("inference_attempt_conflict", 409)
        return job

    async def renew(self, worker_id, job_id, attempt_id):
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            attempt, job = await self.owned(session, worker_id, job_id, attempt_id)
            if not self.active(attempt, job):
                raise LibraryError("inference_attempt_conflict", 409)
            attempt.lease_expires_at = time.time() + self.lease_seconds
            return Lease(lease_expires_at=datetime.fromtimestamp(attempt.lease_expires_at, UTC))

    @staticmethod
    def fingerprint(action, body):
        return hashlib.sha256(f"{action}:{body.model_dump_json()}".encode()).hexdigest()

    async def finalize(self, session, worker_id, job_id, attempt_id, fingerprint, receipt):
        # A fresh SELECT must not autoflush job status before comparing the active
        # attempt. The publisher already performed the active guard under this lock.
        with session.no_autoflush:
            attempt = await session.get(Attempt, attempt_id, populate_existing=True)
        if (
            attempt is None
            or attempt.worker_id != worker_id
            or attempt.job_id != job_id
            or attempt.state != "active"
            or attempt.lease_expires_at <= time.time()
        ):
            raise LibraryError("inference_attempt_conflict", 409)
        attempt.state = receipt["status"]
        attempt.terminal_hash = fingerprint
        attempt.terminal_result = receipt

    async def fail(self, worker_id, job_id, body):
        attempt_id = str(body.attempt_id)
        fingerprint = self.fingerprint("fail", body)
        try:
            async with self.sessions.begin() as session:
                await session.execute(text("BEGIN IMMEDIATE"))
                job = await self.require(session, worker_id, job_id, attempt_id, fingerprint)
                self.mark_failed(job, body.error.code, body.error.message)
                result = Receipt(job_id=job_id, status="failed", asset_ids=[]).model_dump()
                await self.finalize(session, worker_id, job_id, attempt_id, fingerprint, result)
                return result
        except TerminalReplay as replay:
            return replay.result

    @staticmethod
    def mark_failed(job, code, message):
        job.status = JobStatus.FAILED
        job.completed_at = datetime.now(UTC)
        job.generation_dispatch_pending = False
        job.error = {"code": code, "message": message}
        if job.execution:
            job.execution = {**job.execution, "phase": "failed"}

    async def expire(self):
        async with self.sessions() as session:
            found = await session.scalar(
                select(Attempt.id)
                .where(
                    Attempt.state == "active",
                    Attempt.lease_expires_at <= time.time(),
                )
                .limit(1)
            )
        if not found:
            return
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            attempts = await session.scalars(
                select(Attempt).where(
                    Attempt.state == "active",
                    Attempt.lease_expires_at <= time.time(),
                )
            )
            for attempt in attempts:
                attempt.state = "expired"
                job = await session.get(JobRecord, attempt.job_id)
                if job is None or job.status != JobStatus.RUNNING:
                    continue
                if attempt.ordinal >= MAX_ATTEMPTS:
                    self.mark_failed(
                        job,
                        "inference_attempts_exhausted",
                        "Worker lease expired on three attempts. Create a new job to retry.",
                    )
                else:
                    job.status = JobStatus.QUEUED

    async def run(self, artifacts):
        last_recovery = float("-inf")
        while True:
            try:
                await self.expire()
                if time.monotonic() - last_recovery >= 30:
                    await artifacts.recover()
                    last_recovery = time.monotonic()
            except Exception:
                logger.exception("CLI inference recovery will retry")
            await asyncio.sleep(1)
