from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import AbstractAsyncContextManager

from fastapi import Request


class LibraryStorageError(OSError):
    """Storage operation failed; provider details must not reach the HTTP response."""


class LibraryStorage(ABC):
    async def finalize_upload(self, key: str, expected_size: int) -> bool:
        inspection = await self.inspect(key)
        return (
            inspection is not None
            and inspection[0] == expected_size
            and inspection[1] in {b"ply\n", b"ply\r"}
        )

    @abstractmethod
    async def upload_url(self, asset_id: str, key: str, request: Request) -> str: ...

    @abstractmethod
    async def download_url(self, asset_id: str, key: str, request: Request) -> str: ...

    @abstractmethod
    async def inspect(self, key: str) -> tuple[int, bytes] | None: ...

    @abstractmethod
    def stage_delete(self, keys: list[str]) -> AbstractAsyncContextManager[None]:
        """Hide content until DB commit; restore on failure, finalize on success."""
        ...
