from __future__ import annotations

import asyncio
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Protocol

from camera_path.models import Project


class ProjectNotFoundError(KeyError):
    pass


class RevisionConflictError(RuntimeError):
    pass


class ProjectRepository(Protocol):
    async def create(self, project: Project) -> Project: ...

    async def get(self, project_id: str) -> Project: ...

    async def list(self) -> list[Project]: ...

    async def commit(self, draft: Project, expected_revision: int) -> Project: ...

    async def delete(self, project_id: str) -> None: ...

    async def undo(self, project_id: str) -> Project: ...

    async def redo(self, project_id: str) -> Project: ...


class SQLiteProjectRepository:
    """Persistent project history using SQLite and JSON Pydantic snapshots."""

    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path.expanduser()
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._initialize()

    async def create(self, project: Project) -> Project:
        snapshot = project.model_dump_json()
        async with self._lock:
            with self._connection() as connection:
                connection.execute(
                    "INSERT INTO projects (id, cursor) VALUES (?, 0)",
                    (project.id,),
                )
                connection.execute(
                    """
                    INSERT INTO project_snapshots (project_id, position, payload)
                    VALUES (?, 0, ?)
                    """,
                    (project.id, snapshot),
                )
        return project.model_copy(deep=True)

    async def get(self, project_id: str) -> Project:
        async with self._lock:
            with self._connection() as connection:
                return self._current(connection, project_id).model_copy(deep=True)

    async def list(self) -> list[Project]:
        async with self._lock:
            with self._connection() as connection:
                rows = connection.execute(
                    """
                    SELECT snapshots.payload
                    FROM projects
                    JOIN project_snapshots AS snapshots
                      ON snapshots.project_id = projects.id
                     AND snapshots.position = projects.cursor
                    ORDER BY projects.rowid
                    """
                ).fetchall()
                return [Project.model_validate_json(row["payload"]) for row in rows]

    async def delete(self, project_id: str) -> None:
        async with self._lock:
            with self._connection() as connection:
                cursor = connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
                if cursor.rowcount == 0:
                    raise ProjectNotFoundError(project_id)

    async def commit(self, draft: Project, expected_revision: int) -> Project:
        async with self._lock:
            with self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                current, cursor = self._current_with_cursor(connection, draft.id)
                if current.revision != expected_revision:
                    detail = (
                        f"expected revision {expected_revision}, "
                        f"current revision is {current.revision}"
                    )
                    raise RevisionConflictError(detail)
                committed = draft.model_copy(deep=True)
                committed.revision = current.revision + 1
                next_position = cursor + 1
                connection.execute(
                    "DELETE FROM project_snapshots WHERE project_id = ? AND position > ?",
                    (draft.id, cursor),
                )
                connection.execute(
                    """
                    INSERT INTO project_snapshots (project_id, position, payload)
                    VALUES (?, ?, ?)
                    """,
                    (draft.id, next_position, committed.model_dump_json()),
                )
                connection.execute(
                    "UPDATE projects SET cursor = ? WHERE id = ?",
                    (next_position, draft.id),
                )
        return committed.model_copy(deep=True)

    async def undo(self, project_id: str) -> Project:
        async with self._lock:
            with self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                _, cursor = self._current_with_cursor(connection, project_id)
                next_cursor = max(0, cursor - 1)
                connection.execute(
                    "UPDATE projects SET cursor = ? WHERE id = ?",
                    (next_cursor, project_id),
                )
                return self._snapshot(connection, project_id, next_cursor).model_copy(deep=True)

    async def redo(self, project_id: str) -> Project:
        async with self._lock:
            with self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                _, cursor = self._current_with_cursor(connection, project_id)
                row = connection.execute(
                    """
                    SELECT MAX(position) AS last_position
                    FROM project_snapshots WHERE project_id = ?
                    """,
                    (project_id,),
                ).fetchone()
                next_cursor = min(int(row["last_position"]), cursor + 1)
                connection.execute(
                    "UPDATE projects SET cursor = ? WHERE id = ?",
                    (next_cursor, project_id),
                )
                return self._snapshot(connection, project_id, next_cursor).model_copy(deep=True)

    def _initialize(self) -> None:
        with self._connection() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    cursor INTEGER NOT NULL DEFAULT 0 CHECK (cursor >= 0)
                );

                CREATE TABLE IF NOT EXISTS project_snapshots (
                    project_id TEXT NOT NULL,
                    position INTEGER NOT NULL CHECK (position >= 0),
                    payload TEXT NOT NULL,
                    PRIMARY KEY (project_id, position),
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                );
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=5.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = self._connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _current(self, connection: sqlite3.Connection, project_id: str) -> Project:
        project, _ = self._current_with_cursor(connection, project_id)
        return project

    def _current_with_cursor(
        self, connection: sqlite3.Connection, project_id: str
    ) -> tuple[Project, int]:
        row = connection.execute(
            "SELECT cursor FROM projects WHERE id = ?",
            (project_id,),
        ).fetchone()
        if row is None:
            raise ProjectNotFoundError(project_id)
        cursor = int(row["cursor"])
        return self._snapshot(connection, project_id, cursor), cursor

    @staticmethod
    def _snapshot(connection: sqlite3.Connection, project_id: str, position: int) -> Project:
        row = connection.execute(
            """
            SELECT payload FROM project_snapshots
            WHERE project_id = ? AND position = ?
            """,
            (project_id, position),
        ).fetchone()
        if row is None:
            raise RuntimeError(f"project {project_id} has no snapshot at position {position}")
        return Project.model_validate_json(row["payload"])
