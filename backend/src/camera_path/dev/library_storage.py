"""Local filesystem implementation of the library storage contract."""

import asyncio
import errno
import logging
import os
import shutil
import stat
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import Request

from camera_path.services.library_metadata import relative_key
from camera_path.services.library_storage import LibraryStorage


class LocalLibraryStorage(LibraryStorage):
    def __init__(self, directory: Path) -> None:
        self.directory = directory.expanduser().resolve()
        self.directory.mkdir(parents=True, exist_ok=True)

    def path(self, key: str) -> Path:
        relative_key(key)
        result = (self.directory / key).resolve()
        if not result.is_relative_to(self.directory):
            raise ValueError("Path escapes the storage root")
        return result

    def identity(self, key: str) -> str:
        return self.path(key).as_uri()

    def key_for_identity(self, identity: str) -> str | None:
        from urllib.parse import unquote, urlsplit

        parts = urlsplit(identity)
        if parts.scheme != "file" or parts.netloc:
            return None
        path = Path(unquote(parts.path)).resolve()
        return (
            path.relative_to(self.directory).as_posix()
            if path.is_relative_to(self.directory)
            else None
        )

    def open_reader(self, key: str):
        path = self.path(key)
        # Resolve legitimate in-root symlinks, then walk the canonical path with
        # no-follow descriptors so a concurrent replacement cannot escape the root.
        parts = path.relative_to(self.directory).parts
        directory = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            for part in parts[:-1]:
                nested = os.open(
                    part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory
                )
                os.close(directory)
                directory = nested
            descriptor = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
            if not stat.S_ISREG(os.fstat(descriptor).st_mode):
                os.close(descriptor)
                raise ValueError("Source must be a regular file")
            return os.fdopen(descriptor, "rb")
        except OSError as error:
            if error.errno in {errno.ELOOP, errno.ENOTDIR}:
                raise ValueError("Source changed outside its namespace") from error
            raise
        finally:
            os.close(directory)

    def write_object(self, key: str, stream, *, replace: bool = False) -> None:
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        if replace:
            temporary = path.with_name(f".{path.name}.{os.urandom(8).hex()}.tmp")
            try:
                with temporary.open("xb") as target:
                    shutil.copyfileobj(stream, target, 1024 * 1024)
                    target.flush()
                    os.fsync(target.fileno())
                temporary.replace(path)
            finally:
                temporary.unlink(missing_ok=True)
        else:
            with path.open("xb") as target:
                shutil.copyfileobj(stream, target, 1024 * 1024)
                target.flush()
                os.fsync(target.fileno())

    def remove_object(self, key: str) -> None:
        self.path(key).unlink(missing_ok=True)

    def write_import_object(self, key: str, stream, owner: str) -> None:
        # A hard link publishes complete bytes without replacing a pre-existing path.
        # Its staged inode proves ownership even after a crash or UUID collision.
        staged = self.path(f"_imports/{Path(owner).stem}/{key}")
        staged.parent.mkdir(parents=True, exist_ok=True)
        with staged.open("xb") as target:
            shutil.copyfileobj(stream, target, 1024 * 1024)
            target.flush()
            os.fsync(target.fileno())
        os.link(staged, self.path(key))

    def clean_import_object(self, key: str, owner: str, *, committed: bool) -> None:
        staged = self.path(f"_imports/{Path(owner).stem}/{key}")
        destination = self.path(key)
        if (
            not committed
            and staged.exists()
            and destination.exists()
            and os.path.samefile(staged, destination)
        ):
            destination.unlink()
        staged.unlink(missing_ok=True)
        with suppress(OSError):
            staged.parent.rmdir()

    def import_markers(self) -> list[str]:
        return [f"_imports/{p.name}" for p in (self.directory / "_imports").glob("*.json")]

    async def upload_url(self, asset_id: str, key: str, request: Request) -> str:
        return str(request.url_for("upload_local_library_content", asset_id=asset_id))

    async def download_url(self, asset_id: str, key: str, request: Request) -> str:
        return str(request.url_for("download_local_library_content", asset_id=asset_id))

    async def file_download_url(
        self, asset_id: str, file_id: str, key: str, request: Request
    ) -> str:
        return str(
            request.url_for("download_local_library_file", asset_id=asset_id, file_id=file_id)
        )

    async def thumbnail_url(self, asset_id: str, key: str, request: Request) -> str:
        return str(request.url_for("download_local_library_thumbnail", asset_id=asset_id))

    async def inspect(self, key: str) -> tuple[int, bytes] | None:
        path = self.path(key)
        if not path.is_file():
            return None

        def read() -> tuple[int, bytes]:
            with path.open("rb") as stream:
                return path.stat().st_size, stream.read(4)

        return await asyncio.to_thread(read)

    @asynccontextmanager
    async def stage_delete(self, keys: list[str]) -> AsyncIterator[None]:
        # Keep recoverable bytes until the SQL transaction has committed.
        # Renames stay on the same filesystem and never copy a multi-GB PLY.
        staging = Path(tempfile.mkdtemp(prefix=".delete-", dir=self.directory))
        moved: list[tuple[Path, Path]] = []
        preserve_staging = False
        try:
            for key in keys:
                source = self.path(key)
                destination = staging / key
                destination.parent.mkdir(parents=True, exist_ok=True)
                try:
                    source.replace(destination)
                except FileNotFoundError:
                    continue
                moved.append((source, destination))
            yield
        except BaseException:
            try:
                for source, destination in reversed(moved):
                    destination.replace(source)
            except BaseException:
                preserve_staging = True
                raise
            raise
        finally:
            try:
                if not preserve_staging:
                    shutil.rmtree(staging)
            except OSError:
                # After commit these are unreferenced trash bytes, never live files.
                logging.getLogger(__name__).exception("Could not clean deletion trash: %s", staging)
