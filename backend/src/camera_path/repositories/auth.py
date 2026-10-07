from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from camera_path.persistence.models import EditorRecord, EditorSessionRecord

EDITOR_ID = "editor"


class AuthRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

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
