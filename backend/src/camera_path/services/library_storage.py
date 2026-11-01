from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import AbstractAsyncContextManager
from typing import BinaryIO

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
    def identity(self, key: str) -> str:
        raise NotImplementedError

    def key_for_identity(self, identity: str) -> str | None:
        raise NotImplementedError

    def open_reader(self, key: str):
        """A context-managed binary stream, used only in blocking I/O workers."""
        raise NotImplementedError

    def write_object(self, key: str, stream: BinaryIO, *, replace: bool = False) -> None:
        """Create an owned object without overwriting existing content."""
        raise NotImplementedError

    def remove_object(self, key: str) -> None:
        raise NotImplementedError

    def import_markers(self) -> list[str]:
        raise NotImplementedError

    def write_import_object(self, key: str, stream: BinaryIO, owner: str) -> None:
        raise NotImplementedError

    def clean_import_object(self, key: str, owner: str, *, committed: bool) -> None:
        """Remove only this attempt's bytes; retain committed destination objects."""
        raise NotImplementedError

    async def file_download_url(
        self, asset_id: str, file_id: str, key: str, request: Request
    ) -> str:
        return await self.download_url(asset_id, key, request)

    async def thumbnail_url(self, asset_id: str, key: str, request: Request) -> str:
        return await self.download_url(asset_id, key, request)

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
