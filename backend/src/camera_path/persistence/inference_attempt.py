"""Durable worker claims and terminal receipts, separate from job input snapshots."""

from sqlalchemy import JSON, Float, ForeignKey, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from camera_path.persistence.records import Base


class InferenceAttemptRecord(Base):
    __tablename__ = "inference_attempts"
    __table_args__ = (
        UniqueConstraint("worker_id", "claim_id", name="uq_inference_claim"),
        UniqueConstraint("job_id", "ordinal", name="uq_inference_attempt_ordinal"),
        Index(
            "uq_inference_active_job", "job_id", unique=True, sqlite_where=text("state = 'active'")
        ),
        Index(
            "uq_inference_active_worker",
            "worker_id",
            unique=True,
            sqlite_where=text("state = 'active'"),
        ),
        Index("ix_inference_expiry", "state", "lease_expires_at"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    worker_id: Mapped[str] = mapped_column(Text)
    claim_id: Mapped[str] = mapped_column(Text)
    lease_expires_at: Mapped[float] = mapped_column(Float)
    state: Mapped[str] = mapped_column(Text)
    ordinal: Mapped[int] = mapped_column(Integer)
    terminal_hash: Mapped[str | None] = mapped_column(Text)
    terminal_result: Mapped[dict | None] = mapped_column(JSON(none_as_null=True))
