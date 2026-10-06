import asyncio
from collections import deque
from datetime import UTC, datetime, timedelta
from time import monotonic
from uuid import uuid4

import jwt
from fastapi import HTTPException
from pwdlib import PasswordHash

from camera_path.config import Settings
from camera_path.repositories.auth import EDITOR_ID, AuthRepository

PASSWORD_HASH = PasswordHash.recommended()
DUMMY_HASH = PASSWORD_HASH.hash(uuid4().hex)


class AuthService:
    def __init__(self, repository: AuthRepository, settings: Settings) -> None:
        self.repository = repository
        self.secret = settings.jwt_secret.get_secret_value() if settings.jwt_secret else None
        self.ttl = settings.jwt_ttl_seconds
        self.login_attempts: deque[float] = deque()

    def signing_secret(self) -> str:
        if self.secret is None or len(self.secret.encode()) < 32:
            raise HTTPException(503, "Configure CAMERA_PATH_JWT_SECRET with at least 32 bytes")
        return self.secret

    @staticmethod
    def unauthorized() -> HTTPException:
        return HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})

    async def login(self, username: str, password: str) -> tuple[str, int]:
        secret = self.signing_secret()
        now_monotonic = monotonic()
        while self.login_attempts and self.login_attempts[0] <= now_monotonic - 60:
            self.login_attempts.popleft()
        if len(self.login_attempts) >= 10:
            raise HTTPException(
                429, "Too many sign-in attempts; retry in a minute", headers={"Retry-After": "60"}
            )
        self.login_attempts.append(now_monotonic)
        async with self.repository.sessions.begin() as session:
            editor = await self.repository.editor(session)
            valid = await asyncio.to_thread(
                PASSWORD_HASH.verify, password, editor.password_hash if editor else DUMMY_HASH
            )
            if editor is None or editor.username != username or not valid:
                raise self.unauthorized()
            now = datetime.now(UTC)
            expires = int((now + timedelta(seconds=self.ttl)).timestamp())
            # Prune expired sessions whenever a new session is created.
            await self.repository.prune_sessions(session, int(now.timestamp()))
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
                },
                secret,
                algorithm="HS256",
            )
        return token, self.ttl

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
            if claims["sub"] != EDITOR_ID or not isinstance(claims["jti"], str):
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
        password_hash = await asyncio.to_thread(PASSWORD_HASH.hash, password)
        async with self.repository.sessions.begin() as session:
            await self.repository.replace_editor(session, username, password_hash, str(uuid4()))
