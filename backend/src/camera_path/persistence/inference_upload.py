"""Durable artifact reservations, scoped to a single inference attempt."""

from sqlalchemy import BigInteger, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from camera_path.persistence.records import Base


class InferenceUploadRecord(Base):
    __tablename__ = "inference_uploads"
    __table_args__ = (UniqueConstraint("attempt_id", "file_id", name="uq_inference_upload_file"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    job_id: Mapped[str] = mapped_column(
        Text, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    attempt_id: Mapped[str] = mapped_column(Text, nullable=False)
    file_id: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(Text, nullable=False)
