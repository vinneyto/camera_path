"""Atomic registration of externally produced items, independent of delivery engine."""

import asyncio
import hashlib
import io
import json
import logging
import tempfile
import time
from contextlib import asynccontextmanager, suppress
from uuid import uuid4

from sqlalchemy import select, text

from camera_path.persistence.enums import LibraryAssetStatus
from camera_path.persistence.records import (
    LibraryAssetFileRecord,
    LibraryAssetRecord,
    LibraryClientIdRecord,
)
from camera_path.services.io import blocking_io
from camera_path.services.library import LibraryService
from camera_path.services.library_import_models import LibraryImportItem, LibraryImportMessage
from camera_path.services.library_metadata import LibraryError
from camera_path.services.library_storage import LibraryStorage, has_library_file_header

logger = logging.getLogger(__name__)


class LibraryImportService:
    def __init__(self, library: LibraryService, sources: dict[str, LibraryStorage]):
        self.library, self.storage = library, library.storage
        self.sessions = library.repository.sessions
        self.sources = {**sources, "library": self.storage}

    async def _existing(self, item: LibraryImportItem) -> str | None:
        async with self.sessions() as session:
            ledger = await session.get(LibraryClientIdRecord, item.client_id)
            if ledger is None:
                return None
            if ledger.deleted_at is not None:
                raise LibraryError("library_client_id_deleted")
            asset = await session.scalar(
                select(LibraryAssetRecord).where(LibraryAssetRecord.client_id == item.client_id)
            )
            if asset.status != LibraryAssetStatus.READY:
                raise LibraryError("library_client_id_conflict")
            if ledger.import_descriptor is not None:
                if ledger.import_descriptor != item.descriptor():
                    raise LibraryError("library_client_id_conflict")
                return asset.id
        # Legacy/manual files were not hashed by the schema migration. Verify on demand,
        # outside the writer transaction, before adopting this identity for imports.
        primary = next(f.id for f in asset.files if f.is_primary)
        actual_files = []
        for file in asset.files:
            digest = await blocking_io(
                lambda f=file: self._verify(
                    self.storage, f.object_key, f.format, f.size_bytes, None
                )
            )
            actual_files.append(
                {
                    "id": file.id,
                    "format": file.format,
                    "size_bytes": file.size_bytes,
                    "sha256": digest,
                }
            )
        descriptor = {
            "name": asset.name,
            "tags": sorted(t.casefold() for t in asset.tags),
            "thumbnail_key": asset.thumbnail_key,
            "primary_file_id": primary,
            "files": actual_files,
        }
        if descriptor != item.descriptor():
            raise LibraryError("library_client_id_conflict")
        async with self.sessions.begin() as session:
            await session.execute(text("BEGIN IMMEDIATE"))
            current = await session.get(LibraryClientIdRecord, item.client_id)
            if current.deleted_at is not None:
                raise LibraryError("library_client_id_deleted")
            current.import_descriptor = descriptor
            for file in actual_files:
                row = await session.get(LibraryAssetFileRecord, (asset.id, file["id"]))
                row.sha256 = file["sha256"]
        return asset.id

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

    async def register(self, message: LibraryImportMessage) -> str:
        item = message.item
        existing = await self._existing(item)
        if existing is not None:
            return existing
        resolved, identities = [], set()
        for file in item.files:
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
        new_keys = [key for _, _, key, adopted in resolved if not adopted]
        async with self._attempt(new_keys) as marker:
            for file, source, key, adopted in resolved:
                await blocking_io(
                    lambda f=file, s=source, k=key, a=adopted: self._verify(
                        s,
                        f.source.path,
                        f.format,
                        f.size_bytes,
                        f.sha256,
                        destination=None if a else k,
                        owner=marker,
                    )
                )
            await self.library.check_thumbnail(item.thumbnail_key)
            async with self.sessions.begin() as session:
                await session.execute(text("BEGIN IMMEDIATE"))
                # Recovery may have claimed an expired attempt while its worker was
                # suspended. A lost marker must not publish references to removed bytes.
                try:
                    await blocking_io(lambda: self._read_marker(marker))
                except FileNotFoundError as error:
                    raise OSError("Import attempt expired") from error
                ledger = await session.get(LibraryClientIdRecord, item.client_id)
                if ledger is not None:
                    if ledger.deleted_at is not None:
                        raise LibraryError("library_client_id_deleted")
                    if ledger.import_descriptor != item.descriptor():
                        raise LibraryError("library_client_id_conflict")
                    winner = await session.scalar(
                        select(LibraryAssetRecord.id).where(
                            LibraryAssetRecord.client_id == item.client_id
                        )
                    )
                    return winner
                owned = await self._owned_keys(session)
                if any(key in owned for _, _, key, _ in resolved):
                    raise LibraryError("library_import_object_conflict", 422)
                from datetime import UTC, datetime

                asset_id = str(uuid4())
                primary = next((f, k) for f, _, k, _ in resolved if f.id == item.primary_file_id)
                session.add(
                    LibraryClientIdRecord(
                        client_id=item.client_id, import_descriptor=item.descriptor()
                    )
                )
                await session.flush()
                session.add(
                    LibraryAssetRecord(
                        id=asset_id,
                        client_id=item.client_id,
                        name=item.name,
                        format=primary[0].format,
                        size_bytes=primary[0].size_bytes,
                        object_key=primary[1],
                        status=LibraryAssetStatus.READY,
                        created_at=datetime.now(UTC),
                        tags=item.tags,
                        thumbnail_key=item.thumbnail_key,
                        files=[
                            LibraryAssetFileRecord(
                                id=f.id,
                                position=i,
                                is_primary=f.id == item.primary_file_id,
                                format=f.format,
                                object_key=key,
                                size_bytes=f.size_bytes,
                                sha256=f.sha256,
                            )
                            for i, (f, _, key, _) in enumerate(resolved)
                        ],
                    )
                )
                await session.flush()
            return asset_id
