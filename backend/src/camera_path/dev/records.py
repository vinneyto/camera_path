"""Persistent dev transport state; domain services do not import this module."""

from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from camera_path.persistence.records import Base


class DevQueueMessageRecord(Base):
    __tablename__ = "dev_queue_messages"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'processing', 'succeeded', 'failed')",
            name="ck_dev_queue_messages_status",
        ),
        CheckConstraint("attempts >= 0", name="ck_dev_queue_messages_attempts"),
        Index("ix_dev_queue_messages_ready", "status", "available_at"),
        Index("ix_dev_queue_messages_lease", "status", "lease_until"),
    )

    message_id: Mapped[str] = mapped_column(Text, primary_key=True)
    body: Mapped[dict] = mapped_column(JSON, nullable=False)
    body_sha256: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="queued", server_default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lease_token: Mapped[str | None] = mapped_column(Text)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    asset_id: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
