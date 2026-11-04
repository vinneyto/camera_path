import asyncio
import hashlib
import hmac
import secrets
from datetime import UTC, datetime
from uuid import uuid4

import jwt
from fastapi import HTTPException
from pwdlib import PasswordHash
from sqlalchemy import delete

from camera_path.config import Settings
from camera_path.persistence.records import AuthChallengeRecord
from camera_path.repositories.auth import EDITOR_ID, AuthRepository
from camera_path.services.auth_email import AuthEmailError, AuthEmailSender, normalize_email

PASSWORD_HASH = PasswordHash.recommended()
DUMMY_HASH = PASSWORD_HASH.hash(uuid4().hex)


class AuthService:
    def __init__(
        self, repository: AuthRepository, settings: Settings, sender: AuthEmailSender | None = None
    ) -> None:
        self.repository = repository
        self.secret = settings.jwt_secret.get_secret_value() if settings.jwt_secret else None
        self.ttl = settings.jwt_ttl_seconds
        self.second_factor = settings.auth_second_factor
        self.sender = sender

    def signing_secret(self) -> str:
        if self.secret is None or len(self.secret.encode()) < 32:
            raise HTTPException(503, "Configure CAMERA_PATH_JWT_SECRET with at least 32 bytes")
        return self.secret

    @staticmethod
    def unauthorized() -> HTTPException:
        return HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})

    def now(self) -> int:
        return int(datetime.now(UTC).timestamp())

    def digest(self, value: str) -> str:
        return hmac.new(self.signing_secret().encode(), value.encode(), hashlib.sha256).hexdigest()

    async def throttle(self, operation: str, source: str, *, sending: bool = False) -> None:
        now = self.now()
        limit = 5 if sending else (10 if operation == "login" else 30)
        keys = [
            (f"{operation}:account:{now // 60}", limit, now + 120),
            (f"{operation}:source:{self.digest(source)}:{now // 60}", limit, now + 120),
        ]
        if sending:
            keys.append((f"send:hour:{now // 3600}", 20, now + 7200))
        if await self.repository.throttle(keys, now):
            raise HTTPException(
                429, "Too many sign-in attempts; retry later", headers={"Retry-After": "60"}
            )

    def issue_token(self, session, editor) -> dict:
        now = self.now()
        expires = now + self.ttl
        session_id = str(uuid4())
        self.repository.add_session(session, session_id, expires)
        token = jwt.encode(
            {
                "sub": EDITOR_ID,
                "ver": editor.credential_version,
                "jti": session_id,
                "iat": now,
                "exp": expires,
                "iss": "camera-path",
                "aud": "camera-path-api",
                "amr": self.second_factor,
            },
            self.signing_secret(),
            algorithm="HS256",
        )
        return {"access_token": token, "expires_in": self.ttl, "token_type": "bearer"}

    def challenge_response(self, challenge) -> dict:
        return {
            "challenge_id": challenge.id,
            "expires_in": max(0, challenge.expires_at - self.now()),
            "resend_after": max(0, challenge.resend_at - self.now()),
        }

    async def deliver(self, challenge_id: str, recipient: str, code: str, digest: str) -> dict:
        try:
            if self.sender is None:
                raise AuthEmailError("Email delivery is not configured")
            await self.sender.send_code(recipient, code)
        except AuthEmailError:
            # Failed delivery leaves an unusable challenge, never a session. Do not log payloads.
            raise HTTPException(503, "Unable to send sign-in code; try again later") from None
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            challenge = await session.get(AuthChallengeRecord, challenge_id)
            editor = await self.repository.editor(session)
            if (
                challenge is None
                or editor is None
                or challenge.code_digest != digest
                or challenge.credential_version != editor.credential_version
                or challenge.expires_at <= self.now()
            ):
                raise HTTPException(401, "Sign-in expired; start again")
            challenge.delivered = True
            return self.challenge_response(challenge)

    async def login(self, username: str, password: str, source: str = "local") -> dict:
        self.signing_secret()
        await self.throttle("login", source)
        # Legacy non-email editor records cannot authenticate; replace them explicitly via CLI.
        try:
            email = normalize_email(username)
        except ValueError:
            email = ""
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            editor = await self.repository.editor(session)
            valid = await asyncio.to_thread(
                PASSWORD_HASH.verify, password, editor.password_hash if editor else DUMMY_HASH
            )
            if editor is None or editor.username != email or not valid:
                raise self.unauthorized()
            now = self.now()
            await self.repository.prune_sessions(session, now)
            if self.second_factor == "off":
                return self.issue_token(session, editor)
            recipient, version = editor.username, editor.credential_version
        await self.throttle("send", source, sending=True)
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge_id = secrets.token_urlsafe(32)
        digest = self.digest(f"{challenge_id}:{code}")
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            editor = await self.repository.editor(session)
            if editor is None or editor.credential_version != version:
                raise self.unauthorized()
            await session.execute(
                delete(AuthChallengeRecord).where(AuthChallengeRecord.expires_at <= now)
            )
            session.add(
                AuthChallengeRecord(
                    id=challenge_id,
                    credential_version=version,
                    code_digest=digest,
                    expires_at=now + 300,
                    resend_at=now + 60,
                    attempts=0,
                    delivered=False,
                )
            )
        return await self.deliver(challenge_id, recipient, code, digest)

    async def verify(self, challenge_id: str, code: str, source: str) -> dict:
        self.signing_secret()
        await self.throttle("verify", source)
        result = None
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            challenge = await session.get(AuthChallengeRecord, challenge_id)
            editor = await self.repository.editor(session)
            if (
                challenge is not None
                and editor is not None
                and challenge.delivered
                and challenge.expires_at > self.now()
                and challenge.attempts < 5
                and challenge.credential_version == editor.credential_version
            ):
                challenge.attempts += 1
                if hmac.compare_digest(
                    challenge.code_digest, self.digest(f"{challenge_id}:{code}")
                ):
                    await session.delete(challenge)
                    await self.repository.prune_sessions(session, self.now())
                    result = self.issue_token(session, editor)
        # Failed attempts must commit, including the final attempt.
        if result is None:
            raise HTTPException(401, "Invalid or expired code; retry or start again")
        return result

    async def resend(self, challenge_id: str, source: str) -> dict:
        self.signing_secret()
        await self.throttle("send", source, sending=True)
        now = self.now()
        code = f"{secrets.randbelow(1_000_000):06d}"
        digest = self.digest(f"{challenge_id}:{code}")
        async with self.repository.sessions.begin() as session:
            await self.repository.lock_editor(session)
            challenge = await session.get(AuthChallengeRecord, challenge_id)
            editor = await self.repository.editor(session)
            if (
                challenge is None
                or editor is None
                or challenge.expires_at <= now
                or challenge.attempts >= 5
                or challenge.credential_version != editor.credential_version
            ):
                raise HTTPException(401, "Sign-in expired; start again")
            if challenge.resend_at > now:
                wait = challenge.resend_at - now
                raise HTTPException(
                    429, f"Retry in {wait} seconds", headers={"Retry-After": str(wait)}
                )
            # Replace before delivery: the previous code is immediately invalidated.
            # Neither retries nor successful delivery reset verification attempts.
            challenge.code_digest = digest
            challenge.expires_at, challenge.resend_at = now + 300, now + 60
            challenge.delivered = False
            recipient = editor.username
        return await self.deliver(challenge_id, recipient, code, digest)

    async def principal(self, token: str | None) -> tuple[str, str]:
        if not token:
            raise self.unauthorized()
        try:
            claims = jwt.decode(
                token,
                self.signing_secret(),
                algorithms=["HS256"],
                issuer="camera-path",
                audience="camera-path-api",
                options={"require": ["sub", "jti", "iat", "exp", "iss", "aud", "ver"]},
            )
            if (
                claims["sub"] != EDITOR_ID
                or not isinstance(claims["jti"], str)
                or (self.second_factor == "email" and claims.get("amr") != "email")
            ):
                raise self.unauthorized()
        except jwt.InvalidTokenError as error:
            raise self.unauthorized() from error
        async with self.repository.sessions() as session:
            active = await self.repository.active_session(session, claims["jti"])
            editor = await self.repository.editor(session)
            if (
                active is None
                or editor is None
                or editor.credential_version != claims["ver"]
                or active.expires_at <= datetime.now(UTC).timestamp()
            ):
                raise self.unauthorized()
        return editor.username, active.id

    async def logout(self, token: str) -> None:
        _, session_id = await self.principal(token)
        async with self.repository.sessions.begin() as session:
            await self.repository.revoke_session(session, session_id)

    async def create_editor(self, username: str, password: str) -> None:
        self.signing_secret()
        username = normalize_email(username)
        password_hash = await asyncio.to_thread(PASSWORD_HASH.hash, password)
        async with self.repository.sessions.begin() as session:
            await self.repository.replace_editor(session, username, password_hash, str(uuid4()))
