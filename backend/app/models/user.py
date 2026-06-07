from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, TimestampMixin

if TYPE_CHECKING:
    from app.models.activity_event import ActivityEvent
    from app.models.participant import Participant
    from app.models.room import Room
    from app.models.submission import Submission


class User(TimestampMixin, BaseModel):
    __tablename__ = "users"

    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    hosted_rooms: Mapped[list[Room]] = relationship(
        "Room",
        back_populates="host",
        foreign_keys="Room.host_user_id",
    )
    participations: Mapped[list[Participant]] = relationship(
        "Participant",
        back_populates="user",
    )
    submissions: Mapped[list[Submission]] = relationship(
        "Submission",
        back_populates="user",
    )
    activity_events: Mapped[list[ActivityEvent]] = relationship(
        "ActivityEvent",
        back_populates="actor",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "created_at": self.created_at.isoformat(),
        }
