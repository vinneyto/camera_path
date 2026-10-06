from __future__ import annotations

from abc import ABC, abstractmethod

from fastapi import Request


class LibraryStorage(ABC):
    @abstractmethod
    async def upload_url(self, asset_id: str, key: str, request: Request) -> str: ...

    @abstractmethod
    async def download_url(self, asset_id: str, key: str, request: Request) -> str: ...

    @abstractmethod
    async def inspect(self, key: str) -> tuple[int, bytes] | None: ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete stored content; an already missing object is a success."""
        ...
