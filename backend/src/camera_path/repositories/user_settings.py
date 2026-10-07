from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from camera_path.persistence.models import UserSettingsRecord


class UserSettingsRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def get(self, user_id: str) -> UserSettingsRecord | None:
        async with self.sessions() as session:
            return await session.get(UserSettingsRecord, user_id)

    async def update(
        self, session: AsyncSession, user_id: str, changes: dict[str, bool | str]
    ) -> UserSettingsRecord:
        # Update only supplied fields so changes from other clients are preserved.
        if changes:
            record = await session.scalar(
                update(UserSettingsRecord)
                .where(UserSettingsRecord.user_id == user_id)
                .values(**changes)
                .returning(UserSettingsRecord)
            )
        else:
            record = await session.get(UserSettingsRecord, user_id)
        if record is None:
            record = UserSettingsRecord(user_id=user_id, **changes)
            session.add(record)
            await session.flush()
        return record
