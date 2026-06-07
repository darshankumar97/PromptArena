from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.enums import ActivityEventType, ConnectionStatus, ParticipantRole, RoomStatus
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import Participant, Room, User
from app.models.base import utcnow
from app.services.activity_service import ActivityService
from app.utils.codes import generate_room_code
from config import Config
from extensions import db


class RoomService:
    @staticmethod
    def create_room(*, host: User, max_players: int | None = None) -> Room:
        cap = max_players or Config.MAX_PLAYERS_DEFAULT
        if cap < 2 or cap > 32:
            raise ValueError("max_players must be between 2 and 32")

        code = RoomService._unique_room_code()
        room = Room(
            code=code,
            host_user_id=host.id,
            status=RoomStatus.LOBBY,
            max_players=cap,
        )
        db.session.add(room)
        db.session.flush()

        participant = Participant(
            room_id=room.id,
            user_id=host.id,
            role=ParticipantRole.HOST,
            connection_status=ConnectionStatus.OFFLINE,
            joined_at=utcnow(),
        )
        db.session.add(participant)
        ActivityService.log(
            room_id=room.id,
            event_type=ActivityEventType.ROOM_CREATED,
            payload={"code": room.code},
            actor_user_id=host.id,
        )
        db.session.commit()
        return room

    @staticmethod
    def get_by_code(code: str) -> Room:
        room = db.session.scalar(select(Room).where(Room.code == code.upper()))
        if room is None:
            raise NotFoundError("Room not found", code="ROOM_NOT_FOUND")
        return room

    @staticmethod
    def get_by_id(room_id: int) -> Room:
        room = db.session.get(Room, room_id)
        if room is None:
            raise NotFoundError("Room not found", code="ROOM_NOT_FOUND")
        return room

    @staticmethod
    def get_lobby_summary(code: str) -> dict:
        room = RoomService.get_by_code(code)
        active_count = sum(
            1
            for p in room.participants
            if p.is_active and p.connection_status == ConnectionStatus.ONLINE
        )
        return {
            "code": room.code,
            "status": room.status.value,
            "player_count": active_count,
            "max_players": room.max_players,
        }

    @staticmethod
    def get_member_room(room_id: int, user_id: int) -> Room:
        room = RoomService.get_by_id(room_id)
        participant = RoomService.get_active_participant(room_id, user_id)
        if participant is None:
            raise ForbiddenError("Not a member of this room", code="NOT_ROOM_MEMBER")
        return room

    @staticmethod
    def get_active_participant(room_id: int, user_id: int) -> Participant | None:
        return db.session.scalar(
            select(Participant).where(
                Participant.room_id == room_id,
                Participant.user_id == user_id,
                Participant.left_at.is_(None),
            )
        )

    @staticmethod
    def enter_room(*, room: Room, user: User) -> tuple[Participant, bool]:
        """Enter or restore room membership.

        Returns (participant, is_new_join). Existing active members may
        reattach in any non-finished phase; phase join rules apply only to
        new participants.
        """
        if room.status == RoomStatus.FINISHED:
            raise ConflictError("Room has ended", code="ROOM_FINISHED")

        existing = RoomService.get_active_participant(room.id, user.id)
        if existing:
            return existing, False

        if room.status not in (RoomStatus.LOBBY, RoomStatus.PROMPTING):
            raise ConflictError(
                "Cannot join this room in its current phase",
                code="ROOM_NOT_JOINABLE",
            )

        active_count = db.session.scalar(
            select(func.count())
            .select_from(Participant)
            .where(Participant.room_id == room.id, Participant.left_at.is_(None))
        )
        if active_count and active_count >= room.max_players:
            raise ConflictError("Room is full", code="ROOM_FULL")

        participant = Participant(
            room_id=room.id,
            user_id=user.id,
            role=ParticipantRole.PLAYER,
            connection_status=ConnectionStatus.OFFLINE,
            joined_at=utcnow(),
        )
        db.session.add(participant)
        ActivityService.log(
            room_id=room.id,
            event_type=ActivityEventType.PLAYER_JOINED,
            payload={"display_name": user.display_name},
            actor_user_id=user.id,
        )
        db.session.commit()
        return participant, True

    @staticmethod
    def end_room(*, room_id: int, host_user_id: int) -> Room:
        from app.services.round_service import RoundService

        RoundService._require_host(room_id, host_user_id)
        room = RoomService.get_by_id(room_id)

        if room.status == RoomStatus.FINISHED:
            raise ConflictError("Room has already ended", code="ROOM_FINISHED")

        if room.status != RoomStatus.RESULTS:
            raise ConflictError(
                "Room can only be ended from the results phase",
                code="INVALID_ROOM_STATE",
            )

        room.status = RoomStatus.FINISHED
        ActivityService.log(
            room_id=room.id,
            event_type=ActivityEventType.ROOM_ENDED,
            payload={"room_id": room.id, "code": room.code},
            actor_user_id=host_user_id,
        )
        db.session.commit()
        db.session.refresh(room)
        return room

    @staticmethod
    def join_room(*, room: Room, user: User) -> Participant:
        participant, _ = RoomService.enter_room(room=room, user=user)
        return participant

    @staticmethod
    def list_active_participants_for_user(user_id: int) -> list[Participant]:
        return list(
            db.session.scalars(
                select(Participant).where(
                    Participant.user_id == user_id,
                    Participant.left_at.is_(None),
                )
            ).all()
        )

    @staticmethod
    def list_active_participants(room_id: int) -> list[Participant]:
        return list(
            db.session.scalars(
                select(Participant)
                .options(joinedload(Participant.user))
                .where(Participant.room_id == room_id, Participant.left_at.is_(None))
                .order_by(Participant.joined_at.asc())
            ).all()
        )

    @staticmethod
    def _unique_room_code() -> str:
        for _ in range(10):
            code = generate_room_code(Config.ROOM_CODE_LENGTH)
            exists = db.session.scalar(select(Room.id).where(Room.code == code))
            if exists is None:
                return code
        raise RuntimeError("Failed to generate unique room code")
