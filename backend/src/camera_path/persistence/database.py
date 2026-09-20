from pathlib import Path

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def create_engine_and_session_factory(
    database_url: str,
) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    if database_url.startswith("sqlite+aiosqlite:///"):
        path = Path(database_url.removeprefix("sqlite+aiosqlite:///"))
        if str(path) != ":memory:":
            path.expanduser().parent.mkdir(parents=True, exist_ok=True)

    engine = create_async_engine(database_url)
    if database_url.startswith("sqlite+aiosqlite:"):

        @event.listens_for(engine.sync_engine, "connect")
        def enable_sqlite_foreign_keys(dbapi_connection, _) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys = ON")
            cursor.close()

    return engine, async_sessionmaker(engine, expire_on_commit=False)
