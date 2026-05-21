from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import ConnectionStatus, ParticipantRole
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.room import Room
    from app.models.user import User


class Participant(BaseModel):
    __tablename__ = "room_participants"
    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_participant"),
    )

    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[ParticipantRole] = mapped_column(
        Enum(ParticipantRole, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    connection_status: Mapped[ConnectionStatus] = mapped_column(
        Enum(ConnectionStatus, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=ConnectionStatus.OFFLINE,
        nullable=False,
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    room: Mapped[Room] = relationship("Room", back_populates="participants")
    user: Mapped[User] = relationship("User", back_populates="participations")

    @property
    def is_active(self) -> bool:
        return self.left_at is None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "room_id": self.room_id,
            "user_id": self.user_id,
            "role": self.role.value,
            "connection_status": self.connection_status.value,
            "display_name": self.user.display_name if self.user else None,
            "joined_at": self.joined_at.isoformat(),
            "left_at": self.left_at.isoformat() if self.left_at else None,
        }
