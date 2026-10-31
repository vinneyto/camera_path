"""A SQLite-backed dev queue, fed by the dev HTTP adapter."""

import asyncio
import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError

from camera_path.dev.records import DevQueueMessageRecord
from camera_path.services.library_import_models import LibraryImportMessage, LibraryImportStatus
from camera_path.services.library_metadata import LibraryError
from camera_path.services.message_queue import Delivery, MessageQueue


class DevMessageQueue(MessageQueue):
    def __init__(self, sessions, lease_seconds: int = 60):
        self.sessions, self.lease_seconds = sessions, lease_seconds

    async def enqueue(self, message: LibraryImportMessage) -> None:
        digest = hashlib.sha256(message.canonical_body().encode()).hexdigest()
        try:
            async with self.sessions.begin() as session:
                now = datetime.now(UTC)
                session.add(
                    DevQueueMessageRecord(
                        message_id=message.message_id,
                        body=message.model_dump(),
                        body_sha256=digest,
                        available_at=now,
                        created_at=now,
                        updated_at=now,
                    )
                )
        except IntegrityError:
            async with self.sessions() as session:
                row = await session.get(DevQueueMessageRecord, message.message_id)
                if row is None or row.body_sha256 != digest:
                    raise LibraryError("queue_message_id_conflict") from None

    async def status(self, message_id: str) -> LibraryImportStatus:
        async with self.sessions() as session:
            row = await session.get(DevQueueMessageRecord, message_id)
            if row is None:
                raise LibraryError("not_found", 404)
            return LibraryImportStatus.model_validate(
                {name: getattr(row, name) for name in LibraryImportStatus.model_fields}
            )

    async def receive(self) -> Delivery | None:
        now, token = datetime.now(UTC), str(uuid4())
        eligible = or_(
            and_(
                DevQueueMessageRecord.status == "queued", DevQueueMessageRecord.available_at <= now
            ),
            and_(
                DevQueueMessageRecord.status == "processing",
                DevQueueMessageRecord.lease_until <= now,
            ),
        )
        candidate = (
            select(DevQueueMessageRecord.message_id)
            .where(eligible)
            .order_by(DevQueueMessageRecord.created_at)
            .limit(1)
            .scalar_subquery()
        )
        async with self.sessions.begin() as session:
            row = (
                await session.execute(
                    update(DevQueueMessageRecord)
                    .where(DevQueueMessageRecord.message_id == candidate, eligible)
                    .values(
                        status="processing",
                        attempts=DevQueueMessageRecord.attempts + 1,
                        lease_token=token,
                        lease_until=now + timedelta(seconds=self.lease_seconds),
                        updated_at=now,
                    )
                    .returning(DevQueueMessageRecord)
                )
            ).scalar_one_or_none()
            if row is not None:
                return Delivery(LibraryImportMessage.model_validate(row.body), token, row.attempts)
        await asyncio.sleep(0.1)
        return None

    async def _update(self, receipt: str, **values) -> None:
        async with self.sessions.begin() as session:
            await session.execute(
                update(DevQueueMessageRecord)
                .where(
                    DevQueueMessageRecord.lease_token == receipt,
                    DevQueueMessageRecord.status == "processing",
                    DevQueueMessageRecord.lease_until > datetime.now(UTC),
                )
                .values(updated_at=datetime.now(UTC), **values)
            )

    async def ack(self, receipt: str, asset_id: str) -> None:
        await self._update(
            receipt,
            status="succeeded",
            asset_id=asset_id,
            lease_token=None,
            lease_until=None,
            error_code=None,
        )

    async def retry(self, receipt: str, delay: int) -> None:
        await self._update(
            receipt,
            status="queued",
            available_at=datetime.now(UTC) + timedelta(seconds=delay),
            lease_token=None,
            lease_until=None,
        )

    async def reject(self, receipt: str, error_code: str) -> None:
        await self._update(
            receipt, status="failed", error_code=error_code, lease_token=None, lease_until=None
        )

    async def extend_lease(self, receipt: str) -> None:
        await self._update(
            receipt, lease_until=datetime.now(UTC) + timedelta(seconds=self.lease_seconds)
        )
