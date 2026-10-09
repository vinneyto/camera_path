from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import AbstractAsyncContextManager

from fastapi import Request


class LibraryStorageError(OSError):
    """Storage operation failed; provider details must not reach the HTTP response."""


def has_library_file_header(key: str, header: bytes) -> bool:
    """Check the container signature; full decoding belongs to the renderer."""
    if key.endswith(".ply"):
        return header in {b"ply\n", b"ply\r"}
    if key.endswith(".sog"):
        return header == b"PK\x03\x04"
    return False


class LibraryStorage(ABC):
    async def finalize_upload(self, key: str, expected_size: int) -> bool:
        inspection = await self.inspect(key)
        return (
            inspection is not None
            and inspection[0] == expected_size
            and has_library_file_header(key, inspection[1])
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
