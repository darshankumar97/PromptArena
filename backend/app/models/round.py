from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import RoundStatus
from app.models.base import BaseModel, TimestampMixin

if TYPE_CHECKING:
    from app.models.room import Room
    from app.models.submission import Submission
    from app.models.user import User


class Round(TimestampMixin, BaseModel):
    __tablename__ = "rounds"

    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[RoundStatus] = mapped_column(
        Enum(RoundStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=RoundStatus.OPEN,
        nullable=False,
    )
    battle_theme: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    winner_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    room: Mapped[Room] = relationship(
        "Room",
        back_populates="rounds",
        foreign_keys=[room_id],
    )
    winner: Mapped[Optional[User]] = relationship("User", foreign_keys=[winner_user_id])
    submissions: Mapped[list[Submission]] = relationship(
        "Submission",
        back_populates="round",
    )

    def to_dict(self, *, include_submissions: bool = False) -> dict:
        payload = {
            "id": self.id,
            "room_id": self.room_id,
            "round_number": self.round_number,
            "status": self.status.value,
            "battle_theme": self.battle_theme,
            "prompt_deadline": self.prompt_deadline.isoformat() if self.prompt_deadline else None,
            "winner_user_id": self.winner_user_id,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "created_at": self.created_at.isoformat(),
        }
        if include_submissions:
            payload["submissions"] = [s.to_dict() for s in self.submissions]
        return payload
