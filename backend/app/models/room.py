from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import RoomStatus
from app.models.base import BaseModel, TimestampMixin

if TYPE_CHECKING:
    from app.models.activity_event import ActivityEvent
    from app.models.participant import Participant
    from app.models.round import Round
    from app.models.user import User


class Room(TimestampMixin, BaseModel):
    __tablename__ = "rooms"

    code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, index=True)
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[RoomStatus] = mapped_column(
        Enum(RoomStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=RoomStatus.LOBBY,
        nullable=False,
    )
    current_round_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("rounds.id", use_alter=True, name="fk_rooms_current_round"),
        nullable=True,
    )
    max_players: Mapped[int] = mapped_column(Integer, default=8, nullable=False)

    host: Mapped[User] = relationship(
        "User",
        back_populates="hosted_rooms",
        foreign_keys=[host_user_id],
    )
    current_round: Mapped[Optional[Round]] = relationship(
        "Round",
        foreign_keys=[current_round_id],
        post_update=True,
    )
    participants: Mapped[list[Participant]] = relationship(
        "Participant",
        back_populates="room",
    )
    rounds: Mapped[list[Round]] = relationship(
        "Round",
        back_populates="room",
        foreign_keys="Round.room_id",
    )
    activity_events: Mapped[list[ActivityEvent]] = relationship(
        "ActivityEvent",
        back_populates="room",
    )

    def to_dict(self, *, include_host: bool = False) -> dict:
        payload = {
            "id": self.id,
            "code": self.code,
            "host_user_id": self.host_user_id,
            "status": self.status.value,
            "current_round_id": self.current_round_id,
            "max_players": self.max_players,
            "created_at": self.created_at.isoformat(),
        }
        if include_host and self.host:
            payload["host"] = self.host.to_dict()
        return payload
