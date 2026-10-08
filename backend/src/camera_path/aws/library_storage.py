"""Private S3 library storage with direct browser transfers and recoverable deletion."""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any, TypeVar
from uuid import uuid4

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Request

from camera_path.config import Settings
from camera_path.services.library_storage import LibraryStorage, LibraryStorageError

T = TypeVar("T")
logger = logging.getLogger(__name__)


class S3LibraryStorage(LibraryStorage):
    def __init__(self, client: Any, bucket: str, prefix: str = "library/", ttl: int = 300):
        self.client = client
        self.bucket = bucket
        self.prefix = prefix
        self.ttl = ttl

    @classmethod
    def from_settings(cls, settings: Settings) -> "S3LibraryStorage":
        session = boto3.Session(
            profile_name=settings.aws_profile,
            region_name=settings.aws_region or settings.aws_default_region,
            aws_access_key_id=(
                settings.aws_access_key_id.get_secret_value()
                if settings.aws_access_key_id
                else None
            ),
            aws_secret_access_key=(
                settings.aws_secret_access_key.get_secret_value()
                if settings.aws_secret_access_key
                else None
            ),
            aws_session_token=(
                settings.aws_session_token.get_secret_value()
                if settings.aws_session_token
                else None
            ),
        )
        client = session.client(
            "s3",
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=30,
                retries={"mode": "standard", "total_max_attempts": 3},
            ),
        )
        assert settings.s3_bucket is not None
        return cls(client, settings.s3_bucket, settings.s3_prefix, settings.s3_url_ttl_seconds)

    def _key(self, key: str, *, pending: bool = False) -> str:
        if not key or "/" in key or "\\" in key or key in {".", ".."}:
            raise ValueError("invalid library key")
        return f"{self.prefix}{'_uploads/' if pending else ''}{key}"

    async def _run(self, operation: Callable[[], T]) -> T:
        # Boto3 is synchronous. Let an in-flight operation finish before rollback on cancellation.
        task = asyncio.create_task(asyncio.to_thread(operation))
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            try:
                await task
            finally:
                raise
        except (BotoCoreError, ClientError) as error:
            raise LibraryStorageError("S3 operation failed") from error

    async def upload_url(self, asset_id: str, key: str, request: Request) -> str:
        return await self._run(
            lambda: self.client.generate_presigned_url(
                "put_object",
                Params={"Bucket": self.bucket, "Key": self._key(key, pending=True)},
                ExpiresIn=self.ttl,
                HttpMethod="PUT",
            )
        )

    async def download_url(self, asset_id: str, key: str, request: Request) -> str:
        return await self._run(
            lambda: self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": self._key(key),
                    "ResponseContentDisposition": f'attachment; filename="{key}"',
                },
                ExpiresIn=self.ttl,
                HttpMethod="GET",
            )
        )

    def _inspect(self, key: str) -> tuple[int, bytes, str] | None:
        try:
            head = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as error:
            if error.response["Error"]["Code"] in {"404", "NoSuchKey", "NotFound"}:
                return None
            raise
        if head["ContentLength"] == 0:
            return 0, b"", head["ETag"]
        response = self.client.get_object(
            Bucket=self.bucket, Key=key, Range="bytes=0-3", IfMatch=head["ETag"]
        )
        try:
            header = response["Body"].read(4)
        finally:
            response["Body"].close()
        return head["ContentLength"], header, head["ETag"]

    async def inspect(self, key: str) -> tuple[int, bytes] | None:
        result = await self._run(lambda: self._inspect(self._key(key, pending=True)))
        return (result[0], result[1]) if result is not None else None

    async def finalize_upload(self, key: str, expected_size: int) -> bool:
        def finalize() -> bool:
            pending = self._key(key, pending=True)
            ready = self._key(key)
            inspected = self._inspect(pending)
            if inspected is None:
                # A SQL failure after promotion leaves a recoverable pending DB record.
                inspected = self._inspect(ready)
                return (
                    inspected is not None
                    and inspected[0] == expected_size
                    and inspected[1] in {b"ply\n", b"ply\r"}
                )
            if inspected[0] != expected_size or inspected[1] not in {b"ply\n", b"ply\r"}:
                return False
            self.client.copy_object(
                Bucket=self.bucket,
                Key=ready,
                CopySource={"Bucket": self.bucket, "Key": pending},
                CopySourceIfMatch=inspected[2],
            )
            self.client.delete_object(Bucket=self.bucket, Key=pending)
            return True

        # Upload URLs only target _uploads/. Reusing one cannot overwrite a ready asset.
        return await self._run(finalize)

    @asynccontextmanager
    async def stage_delete(self, keys: list[str]) -> AsyncIterator[None]:
        backup_prefix = f"{self.prefix}_delete/{uuid4().hex}/"
        backups: list[tuple[str, str]] = []

        def stage() -> None:
            for key in dict.fromkeys(keys):
                for pending in (False, True):
                    source = self._key(key, pending=pending)
                    try:
                        head = self.client.head_object(Bucket=self.bucket, Key=source)
                    except ClientError as error:
                        if error.response["Error"]["Code"] in {"404", "NoSuchKey", "NotFound"}:
                            continue
                        raise
                    backup = f"{backup_prefix}{'_uploads/' if pending else ''}{key}"
                    self.client.copy_object(
                        Bucket=self.bucket,
                        Key=backup,
                        CopySource={"Bucket": self.bucket, "Key": source},
                        CopySourceIfMatch=head["ETag"],
                    )
                    backups.append((source, backup))
                    self.client.delete_object(Bucket=self.bucket, Key=source)

        def restore() -> None:
            for source, backup in reversed(backups):
                self.client.copy_object(
                    Bucket=self.bucket,
                    Key=source,
                    CopySource={"Bucket": self.bucket, "Key": backup},
                )

        def cleanup() -> None:
            for _, backup in backups:
                self.client.delete_object(Bucket=self.bucket, Key=backup)

        try:
            await self._run(stage)
            yield
        except BaseException:
            # Preserve backups if restoration fails, so an operator can recover the bytes.
            await self._run(restore)
            await self._run(cleanup)
            raise
        else:
            try:
                await self._run(cleanup)
            except LibraryStorageError:
                # SQL has committed: leftover backup bytes are no longer live assets.
                logger.warning("S3 deletion backup cleanup failed; retained at %s", backup_prefix)
