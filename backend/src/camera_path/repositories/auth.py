from sqlalchemy import delete, update
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from camera_path.persistence.models import (
    AuthChallengeRecord,
    AuthRateLimitRecord,
    EditorRecord,
    EditorSessionRecord,
)

EDITOR_ID = "editor"


class AuthRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def lock_editor(self, session: AsyncSession) -> None:
        # Current deployments use SQLite. Acquire its write lock *before* reads,
        # serializing verification, resends and credential replacement across workers.
        await session.execute(
            update(EditorRecord).values(credential_version=EditorRecord.credential_version)
        )

    async def throttle(self, keys: list[tuple[str, int, int]], now: int) -> bool:
        limited = False
        async with self.sessions.begin() as session:
            await session.execute(
                delete(AuthRateLimitRecord).where(AuthRateLimitRecord.expires_at <= now)
            )
            for key, limit, expires in keys:
                stmt = insert(AuthRateLimitRecord).values(key=key, count=1, expires_at=expires)
                count = await session.scalar(
                    stmt.on_conflict_do_update(
                        index_elements=[AuthRateLimitRecord.key],
                        set_={"count": AuthRateLimitRecord.count + 1},
                    ).returning(AuthRateLimitRecord.count)
                )
                limited |= count > limit
        # Commit counters even for failed or throttled requests.
        return limited

    async def editor(self, session: AsyncSession) -> EditorRecord | None:
        return await session.get(EditorRecord, EDITOR_ID)

    async def active_session(
        self, session: AsyncSession, session_id: str
    ) -> EditorSessionRecord | None:
        return await session.get(EditorSessionRecord, session_id)

    async def prune_sessions(self, session: AsyncSession, now: int) -> None:
        await session.execute(
            delete(EditorSessionRecord).where(EditorSessionRecord.expires_at <= now)
        )

    def add_session(self, session: AsyncSession, session_id: str, expires: int) -> None:
        session.add(EditorSessionRecord(id=session_id, expires_at=expires))

    async def revoke_session(self, session: AsyncSession, session_id: str) -> None:
        await session.execute(
            delete(EditorSessionRecord).where(EditorSessionRecord.id == session_id)
        )

    async def replace_editor(
        self, session: AsyncSession, username: str, password_hash: str, version: str
    ) -> None:
        await self.lock_editor(session)
        editor = await self.editor(session)
        if editor is None:
            session.add(
                EditorRecord(
                    id=EDITOR_ID,
                    username=username,
                    password_hash=password_hash,
                    credential_version=version,
                )
            )
        else:
            editor.username = username
            editor.password_hash = password_hash
            editor.credential_version = version
        await session.execute(delete(EditorSessionRecord))
        await session.execute(delete(AuthChallengeRecord))
