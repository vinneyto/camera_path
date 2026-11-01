"""Atomic registration of externally produced items, independent of delivery engine."""

import asyncio
import hashlib
import io
import json
import logging
import tempfile
import time
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select, text

from camera_path.persistence.enums import LibraryAssetStatus
from camera_path.persistence.records import (
    JobRecord,
    LibraryAssetFileRecord,
    LibraryAssetRecord,
)
from camera_path.services.io import blocking_io
from camera_path.services.job_completion_models import JobCompletionMessage
from camera_path.services.library import LibraryService
from camera_path.services.library_metadata import LibraryError
from camera_path.services.library_storage import LibraryStorage, has_library_file_header

logger = logging.getLogger(__name__)


class JobCompletionService:
    def __init__(self, library: LibraryService, sources: dict[str, LibraryStorage]):
        self.library, self.storage = library, library.storage
        self.sessions = library.repository.sessions
        self.sources = {**sources, "library": self.storage}

    async def _completed(self, job_id: str) -> bool:
        async with self.sessions() as session:
            job = await session.get(JobRecord, job_id)
            if job is None:
                raise LibraryError("job_not_found", 404)
            return job.completed_at is not None

    def _verify(
        self, source, path, file_format, size, expected_hash, destination=None, owner=None
    ) -> str:
        digest, count, header = hashlib.sha256(), 0, b""
        try:
            with source.open_reader(path) as stream, tempfile.TemporaryFile() as spool:
                while chunk := stream.read(1024 * 1024):
                    header = (header + chunk[:4])[:4]
                    count += len(chunk)
                    if count > size:
                        raise LibraryError("library_import_invalid_file", 422)
                    digest.update(chunk)
                    if destination is not None:
                        spool.write(chunk)
                value = digest.hexdigest()
                if (
                    count != size
                    or not has_library_file_header(f"x.{file_format}", header)
                    or (expected_hash is not None and expected_hash != value)
                ):
                    raise LibraryError("library_import_invalid_file", 422)
                if destination is not None:
                    spool.seek(0)
                    self.storage.write_import_object(destination, spool, owner)
                return value
        except FileExistsError as error:
            raise LibraryError("library_import_object_conflict", 422) from error
        except FileNotFoundError as error:
            raise LibraryError("library_import_source_missing", 422) from error
        except ValueError as error:
            raise LibraryError("library_import_invalid_source", 422) from error

    async def _owned_keys(self, session) -> set[str]:
        files = set(await session.scalars(select(LibraryAssetFileRecord.object_key)))
        files.update(await session.scalars(select(LibraryAssetRecord.object_key)))
        files.update(
            k for k in await session.scalars(select(LibraryAssetRecord.thumbnail_key)) if k
        )
        return files

    def _read_marker(self, marker):
        with self.storage.open_reader(marker) as stream:
            return json.load(stream)

    def _save_marker(self, marker, keys, *, replace):
        body = json.dumps({"keys": keys, "expires_at": time.time() + 120}).encode()
        self.storage.write_object(marker, io.BytesIO(body), replace=replace)

    async def _clean_attempt(self, marker, *, expired_only=False):
        # The same database writer guard serializes recovery, renewal and publication,
        # including across processes. Never remove a committed file or an adopted key.
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            try:
                state = await blocking_io(lambda: self._read_marker(marker))
            except FileNotFoundError:
                return
            if expired_only and state["expires_at"] > time.time():
                return
            owned = await self._owned_keys(session)
            for key in state["keys"]:
                await blocking_io(
                    lambda k=key: self.storage.clean_import_object(k, marker, committed=k in owned)
                )
            await blocking_io(lambda: self.storage.remove_object(marker))

    async def recover(self):
        for marker in await blocking_io(self.storage.import_markers):
            try:
                await self._clean_attempt(marker, expired_only=True)
            except (ValueError, KeyError):
                logger.warning("Invalid import recovery marker retained")

    @asynccontextmanager
    async def _attempt(self, keys):
        marker = f"_imports/{uuid4()}.json"
        await blocking_io(lambda: self._save_marker(marker, keys, replace=False))

        async def heartbeat():
            while True:
                await asyncio.sleep(15)
                async with self.sessions.begin() as session:
                    await session.execute(text("BEGIN IMMEDIATE"))
                    await blocking_io(lambda: self._read_marker(marker))
                    await blocking_io(lambda: self._save_marker(marker, keys, replace=True))

        pulse = asyncio.create_task(heartbeat())
        try:
            yield marker
            if pulse.done():
                pulse.result()
        finally:
            pulse.cancel()
            with suppress(asyncio.CancelledError):
                await pulse
            try:
                await self._clean_attempt(marker)
            except Exception:
                # Keep the durable marker for the next recovery pass. SQL may already
                # have committed: cleanup must never turn that success into a new import.
                logger.warning("Import cleanup deferred to recovery")

    async def register(self, message: JobCompletionMessage) -> str:
        if await self._completed(message.job_id):
            return message.job_id
        try:
            return await self._complete_pending(message)
        except Exception:
            # A concurrent winner makes this a successful replay, even if the
            # losing attempt's producer files were removed in the meantime.
            if await self._completed(message.job_id):
                return message.job_id
            raise

    async def _complete_pending(self, message: JobCompletionMessage) -> str:
        results, identities = [], set()
        for asset in message.assets:
            resolved = []
            for file in asset.files:
                source = self.sources.get(file.source.storage)
                if source is None:
                    raise LibraryError("library_import_invalid_source", 422)
                try:
                    identity = source.identity(file.source.path)
                    key = self.storage.key_for_identity(identity)
                except ValueError as error:
                    raise LibraryError("library_import_invalid_source", 422) from error
                if identity in identities:
                    raise LibraryError("library_import_invalid_source", 422)
                identities.add(identity)
                if key is not None and (
                    key.startswith(("_", ".", "thumbnails/")) or not key.endswith("." + file.format)
                ):
                    raise LibraryError("library_import_invalid_source", 422)
                resolved.append((file, source, key or f"{uuid4()}.{file.format}", key is not None))
            results.append((asset, resolved))
        new_keys = [key for _, files in results for _, _, key, adopted in files if not adopted]
        async with self._attempt(new_keys) as marker:
            for asset, files in results:
                for file, source, key, adopted in files:
                    await blocking_io(
                        lambda f=file, src=source, k=key, a=adopted: self._verify(
                            src,
                            f.source.path,
                            f.format,
                            f.size_bytes,
                            f.sha256,
                            destination=None if a else k,
                            owner=marker,
                        )
                    )
                await self.library.check_thumbnail(asset.thumbnail_key)
            async with self.sessions.begin() as session:
                await session.execute(text("BEGIN IMMEDIATE"))
                job = await session.get(JobRecord, message.job_id)
                if job is None:
                    raise LibraryError("job_not_found", 404)
                if job.completed_at is not None:
                    return job.id
                try:
                    await blocking_io(lambda: self._read_marker(marker))
                except FileNotFoundError as error:
                    raise OSError("Completion attempt expired") from error
                owned = await self._owned_keys(session)
                target_keys = [key for _, files in results for _, _, key, _ in files]
                target_keys.extend(
                    asset.thumbnail_key for asset, _ in results if asset.thumbnail_key
                )
                if any(key in owned for key in target_keys) or len(set(target_keys)) != len(
                    target_keys
                ):
                    raise LibraryError("library_import_object_conflict", 422)
                for position, (asset, files) in enumerate(results):
                    primary = next((f, k) for f, _, k, _ in files if f.id == asset.primary_file_id)
                    session.add(
                        LibraryAssetRecord(
                            id=str(uuid4()),
                            job_id=job.id,
                            job_position=position,
                            name=asset.name,
                            format=primary[0].format,
                            size_bytes=primary[0].size_bytes,
                            object_key=primary[1],
                            status=LibraryAssetStatus.READY,
                            created_at=datetime.now(UTC),
                            tags=asset.tags,
                            thumbnail_key=asset.thumbnail_key,
                            files=[
                                LibraryAssetFileRecord(
                                    id=f.id,
                                    position=i,
                                    is_primary=f.id == asset.primary_file_id,
                                    format=f.format,
                                    object_key=key,
                                    size_bytes=f.size_bytes,
                                    sha256=f.sha256,
                                )
                                for i, (f, _, key, _) in enumerate(files)
                            ],
                        )
                    )
                job.completed_at = datetime.now(UTC)
                await session.flush()
            return message.job_id
