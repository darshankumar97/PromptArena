from __future__ import annotations

import json
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import ActivityEventType
from app.models.base import BaseModel, utcnow

if TYPE_CHECKING:
    from app.models.room import Room
    from app.models.round import Round
    from app.models.user import User


class ActivityEvent(BaseModel):
    __tablename__ = "activity_events"
    __table_args__ = (
        Index("ix_activity_room_id_desc", "room_id", "id"),
    )

    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    round_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rounds.id"), nullable=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )

    room: Mapped[Room] = relationship("Room", back_populates="activity_events")
    round: Mapped[Optional[Round]] = relationship("Round")
    actor: Mapped[Optional[User]] = relationship("User", back_populates="activity_events")

    def set_payload(self, data: dict) -> None:
        self.payload = json.dumps(data)

    def get_payload(self) -> dict:
        if not self.payload:
            return {}
        return json.loads(self.payload)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "room_id": self.room_id,
            "round_id": self.round_id,
            "actor_user_id": self.actor_user_id,
            "event_type": self.event_type,
            "payload": self.get_payload(),
            "created_at": self.created_at.isoformat()
            if hasattr(self.created_at, "isoformat")
            else str(self.created_at),
        }

    @classmethod
    def build(
        cls,
        *,
        room_id: int,
        event_type: ActivityEventType,
        payload: dict | None = None,
        round_id: int | None = None,
        actor_user_id: int | None = None,
    ) -> ActivityEvent:
        event = cls(
            room_id=room_id,
            round_id=round_id,
            actor_user_id=actor_user_id,
            event_type=event_type.value,
        )
        event.set_payload(payload or {})
        return event
