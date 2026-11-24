"""Persistence for device challenges and inference-only CLI credentials."""

from sqlalchemy import Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from camera_path.persistence.records import Base


class CliDeviceRecord(Base):
    __tablename__ = "cli_devices"

    device_digest: Mapped[str] = mapped_column(Text, primary_key=True)
    user_digest: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    credential_version: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False)
    next_poll_at: Mapped[int] = mapped_column(Integer, nullable=False)
    interval: Mapped[int] = mapped_column(Integer, nullable=False)
    approved: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class CliSessionRecord(Base):
    __tablename__ = "cli_sessions"

    token_digest: Mapped[str] = mapped_column(Text, primary_key=True)
    worker_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    credential_version: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False)
