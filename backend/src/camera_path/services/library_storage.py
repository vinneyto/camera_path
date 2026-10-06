from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import AbstractAsyncContextManager

from fastapi import Request


class LibraryStorage(ABC):
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
