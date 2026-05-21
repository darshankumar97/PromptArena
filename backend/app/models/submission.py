from __future__ import annotations

import json
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import SubmissionStatus
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.generation_job import GenerationJob
    from app.models.round import Round
    from app.models.user import User


class Submission(BaseModel):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("round_id", "user_id", name="uq_round_user_submission"),
    )

    round_id: Mapped[int] = mapped_column(ForeignKey("rounds.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=SubmissionStatus.PENDING,
        nullable=False,
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ai_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    judge_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    round: Mapped[Round] = relationship("Round", back_populates="submissions")
    user: Mapped[User] = relationship("User", back_populates="submissions")
    generation_job: Mapped[Optional[GenerationJob]] = relationship(
        "GenerationJob",
        back_populates="submission",
        uselist=False,
    )

    def get_ai_output_parsed(self) -> dict[str, Any] | None:
        if not self.ai_output:
            return None
        try:
            data = json.loads(self.ai_output)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            return {"raw": self.ai_output}
        return None

    def to_dict(self, *, reveal_prompt: bool = True, include_job: bool = True) -> dict:
        payload = {
            "id": self.id,
            "round_id": self.round_id,
            "user_id": self.user_id,
            "status": self.status.value,
            "submitted_at": self.submitted_at.isoformat(),
            "score": self.score,
            "judge_reason": self.judge_reason,
        }
        campaign = self.get_ai_output_parsed()
        if campaign is not None:
            payload["campaign"] = campaign
        elif self.ai_output:
            payload["ai_output"] = self.ai_output

        if include_job and self.generation_job is not None:
            payload["generation_job"] = self.generation_job.to_dict()

        if reveal_prompt:
            payload["prompt_text"] = self.prompt_text
        else:
            payload["submitted"] = True
        return payload
