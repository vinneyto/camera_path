"""Browser-approved device pairing for the inference transport."""

import secrets
from urllib.parse import urlencode
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, select

from camera_path.persistence.cli_auth import CliDeviceRecord, CliSessionRecord
from camera_path.services.auth import AuthService

DEVICE_TTL_SECONDS = 600
SESSION_TTL_SECONDS = 86_400 * 30
POLL_INTERVAL_SECONDS = 5
# Eight characters (roughly 40 bits), with ambiguous characters removed.
USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXYZ23456789"
TOKEN_PREFIX = "cpcli_"


class DeviceGrantError(Exception):
    def __init__(self, code: str, retry_after: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.retry_after = retry_after


class CliAuthService:
    def __init__(self, auth_service: AuthService, web_url: str) -> None:
        self.editor_auth = auth_service
        self.repository = auth_service.repository
        self.verification_uri = f"{web_url.rstrip('/')}/cli/authorize"

    def _digest(self, domain: str, value: str) -> str:
        return self.editor_auth.digest(f"cli:{domain}:{value}")

    async def start_device(self, source: str) -> dict:
        await self.editor_auth.throttle("cli-device", source)
        now = self.editor_auth.now()
        device = secrets.token_urlsafe(32)
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            editor = await self.repository.editor(session)
            if editor is None:
                # Avoid storing pairings on instances without an editor.
                raise HTTPException(503, "Set up an editor before connecting a CLI")
            await session.execute(delete(CliDeviceRecord).where(CliDeviceRecord.expires_at <= now))
            while True:
                raw = "".join(secrets.choice(USER_CODE_ALPHABET) for _ in range(8))
                digest = self._digest("user", raw)
                existing = await session.scalar(
                    select(CliDeviceRecord.user_digest).where(CliDeviceRecord.user_digest == digest)
                )
                if existing is None:
                    break
            session.add(
                CliDeviceRecord(
                    device_digest=self._digest("device", device),
                    user_digest=digest,
                    credential_version=editor.credential_version,
                    expires_at=now + DEVICE_TTL_SECONDS,
                    # One initial check may be made immediately.
                    next_poll_at=now,
                    interval=POLL_INTERVAL_SECONDS,
                )
            )
        code = f"{raw[:4]}-{raw[4:]}"
        return {
            "device_code": device,
            "user_code": code,
            "verification_uri": self.verification_uri,
            "verification_uri_complete": (
                f"{self.verification_uri}?{urlencode({'user_code': code})}"
            ),
            "expires_in": DEVICE_TTL_SECONDS,
            "interval": POLL_INTERVAL_SECONDS,
        }

    async def decide(self, user_code: str, approve: bool, editor_token: str, source: str) -> None:
        _, session_id = await self.editor_auth.principal(editor_token)
        await self.editor_auth.throttle("cli-decision", source)
        code = user_code.strip().replace("-", "").upper()
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            now = self.editor_auth.now()
            editor = await self.repository.editor(session)
            active = await self.repository.active_session(session, session_id)
            if editor is None or active is None or active.expires_at <= now:
                raise self.editor_auth.unauthorized()
            challenge = await session.scalar(
                select(CliDeviceRecord).where(
                    CliDeviceRecord.user_digest == self._digest("user", code)
                )
            )
            if (
                challenge is None
                or challenge.expires_at <= now
                or challenge.credential_version != editor.credential_version
            ):
                raise HTTPException(404, "Device code not found or expired")
            if challenge.approved is not None:
                raise HTTPException(409, "A decision has already been recorded")
            challenge.approved = approve

    async def exchange(self, device_code: str, source: str) -> dict:
        now = self.editor_auth.now()
        digest = self._digest("device", device_code)
        # Limit unknown-code attempts across peers and noisy retries per peer. The
        # independently enforced per-challenge polling interval is persisted.
        keys = [
            (f"cli-token:account:{now // 60}", 600, now + 120),
            (f"cli-token:source:{self._digest('source', source)}:{now // 60}", 120, now + 120),
        ]
        if await self.repository.throttle(keys, now):
            raise DeviceGrantError("slow_down", 60)
        error: DeviceGrantError | None = None
        result: dict = {}
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            now = self.editor_auth.now()
            challenge = await session.get(CliDeviceRecord, digest)
            editor = await self.repository.editor(session)
            if challenge is None:
                error = DeviceGrantError("invalid_grant")
            elif (
                challenge.expires_at <= now
                or editor is None
                or challenge.credential_version != editor.credential_version
            ):
                error = DeviceGrantError("expired_token")
            elif now < challenge.next_poll_at:
                challenge.interval = min(challenge.interval + 5, DEVICE_TTL_SECONDS)
                challenge.next_poll_at = now + challenge.interval
                error = DeviceGrantError("slow_down", challenge.interval)
            elif challenge.approved is None:
                challenge.next_poll_at = now + challenge.interval
                error = DeviceGrantError("authorization_pending")
            elif not challenge.approved:
                error = DeviceGrantError("access_denied")
            else:
                await session.delete(challenge)
                await session.execute(
                    delete(CliSessionRecord).where(
                        (CliSessionRecord.expires_at <= now)
                        | (CliSessionRecord.credential_version != editor.credential_version)
                    )
                )
                worker_id = str(uuid4())
                token = f"{TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
                expires_at = now + SESSION_TTL_SECONDS
                session.add(
                    CliSessionRecord(
                        token_digest=self._digest("session", token),
                        worker_id=worker_id,
                        credential_version=editor.credential_version,
                        expires_at=expires_at,
                    )
                )
                result = {
                    "access_token": token,
                    "token_type": "bearer",
                    "worker_id": worker_id,
                    "expires_at": expires_at,
                    "expires_in": SESSION_TTL_SECONDS,
                }
        if error is not None:
            # Commit poll timestamps and slowdown even when no token is issued.
            raise error
        return result

    async def principal(self, token: str | None) -> str:
        if (
            token is None
            or not token.startswith(TOKEN_PREFIX)
            or len(token) != len(TOKEN_PREFIX) + 43
        ):
            raise self.editor_auth.unauthorized()
        async with self.repository.sessions() as session:
            worker = await session.get(CliSessionRecord, self._digest("session", token))
            editor = await self.repository.editor(session)
            if (
                worker is None
                or editor is None
                or worker.credential_version != editor.credential_version
                or worker.expires_at <= self.editor_auth.now()
            ):
                raise self.editor_auth.unauthorized()
            return worker.worker_id

    async def logout(self, token: str) -> None:
        await self.principal(token)
        async with self.repository.sessions.begin() as session:
            await session.execute(
                delete(CliSessionRecord).where(
                    CliSessionRecord.token_digest == self._digest("session", token)
                )
            )
