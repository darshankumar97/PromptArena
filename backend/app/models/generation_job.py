from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import JobStatus, JobType
from app.models.base import BaseModel, TimestampMixin

if TYPE_CHECKING:
    from app.models.round import Round
    from app.models.submission import Submission


class GenerationJob(TimestampMixin, BaseModel):
    __tablename__ = "generation_jobs"
    __table_args__ = (
        UniqueConstraint("submission_id", name="uq_generation_job_submission"),
    )

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id"),
        nullable=False,
        index=True,
    )
    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id"), nullable=False, index=True)
    job_type: Mapped[JobType] = mapped_column(
        Enum(JobType, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=JobType.GENERATE_SUBMISSION,
        nullable=False,
    )
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=JobStatus.QUEUED,
        nullable=False,
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    submission: Mapped[Submission] = relationship(
        "Submission",
        back_populates="generation_job",
    )
    round: Mapped[Round] = relationship("Round", foreign_keys=[round_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "submission_id": self.submission_id,
            "round_id": self.round_id,
            "job_type": self.job_type.value,
            "status": self.status.value,
            "retry_count": self.retry_count,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "created_at": self.created_at.isoformat(),
        }
