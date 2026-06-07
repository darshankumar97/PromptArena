from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.enums import (
    ActivityEventType,
    ParticipantRole,
    RoomStatus,
    RoundStatus,
    SubmissionStatus,
)
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.models import Round, Submission, User
from app.models.base import utcnow
from app.services.activity_service import ActivityService
from app.services.room_service import RoomService
from extensions import db


logger = logging.getLogger(__name__)

class RoundService:
    MAX_PROMPT_CHARS = 10_000

    @staticmethod
    def _require_host(room_id: int, user_id: int):
        participant = RoomService.get_active_participant(room_id, user_id)
        if participant is None:
            raise ForbiddenError("Not a member of this room", code="NOT_ROOM_MEMBER")
        if participant.role != ParticipantRole.HOST:
            raise ForbiddenError("Host only", code="HOST_ONLY")

    @staticmethod
    def _require_active_member(room_id: int, user_id: int):
        participant = RoomService.get_active_participant(room_id, user_id)
        if participant is None:
            raise ForbiddenError("Not a member of this room", code="NOT_ROOM_MEMBER")

    @staticmethod
    def get_round_in_room(round_id: int, room_id: int) -> Round:
        round_ = db.session.scalar(
            select(Round)
            .options(joinedload(Round.submissions))
            .where(Round.id == round_id, Round.room_id == room_id)
        )
        if round_ is None:
            raise NotFoundError("Round not found for this room", code="ROUND_NOT_IN_ROOM")
        return round_

    @staticmethod
    def start_round(
        *,
        room_id: int,
        host_user_id: int,
        battle_theme: str | None = None,
        deadline_seconds: int | None = None,
    ) -> Round:
        RoundService._require_host(room_id, host_user_id)

        room = RoomService.get_by_id(room_id)
        active_members = RoomService.list_active_participants(room_id)
        logger.info(
            "start_round request: room_id=%s host_user_id=%s status=%s active_members=%s battle_theme=%r deadline_seconds=%s",
            room_id,
            host_user_id,
            room.status.value,
            len(active_members),
            battle_theme,
            deadline_seconds,
        )

        if room.status != RoomStatus.LOBBY:
            logger.warning(
                "start_round rejected: invalid room state %s for room_id=%s",
                room.status.value,
                room_id,
            )
            raise ConflictError(
                "Round can only be started from the lobby",
                code="INVALID_ROOM_STATE",
            )

        if len(active_members) < 2:
            logger.warning(
                "start_round rejected: not enough active players (%s) for room_id=%s",
                len(active_members),
                room_id,
            )
            raise ConflictError(
                "Need at least two players to start",
                code="NOT_ENOUGH_PLAYERS",
            )

        theme = (battle_theme or "Freestyle battle").strip()
        if not theme:
            raise ValueError("battle_theme cannot be empty")

        round_ = Round(
            room_id=room.id,
            round_number=1,
            status=RoundStatus.OPEN,
            battle_theme=theme,
            prompt_deadline=None,
        )
        db.session.add(round_)
        db.session.flush()

        room.current_round_id = round_.id
        room.status = RoomStatus.PROMPTING

        ActivityService.log(
            room_id=room.id,
            event_type=ActivityEventType.ROUND_STARTED,
            payload={
                "round_id": round_.id,
                "round_number": round_.round_number,
                "battle_theme": theme,
            },
            actor_user_id=host_user_id,
            round_id=round_.id,
        )

        db.session.flush()
        db.session.commit()
        db.session.refresh(round_)
        logger.info(
            "start_round succeeded: room_id=%s round_id=%s active_members=%s",
            room_id,
            round_.id,
            len(active_members),
        )
        return round_

    @staticmethod
    def lock_submissions(*, room_id: int, host_user_id: int, round_id: int) -> Round:
        RoundService._require_host(room_id, host_user_id)

        room = RoomService.get_by_id(room_id)
        if room.status != RoomStatus.PROMPTING:
            raise ConflictError(
                "Room is not accepting submissions",
                code="INVALID_ROOM_STATE",
            )

        round_ = RoundService.get_round_in_room(round_id, room_id)

        if room.current_round_id != round_.id:
            raise ConflictError(
                "This round is not the active room round",
                code="ROUND_NOT_ACTIVE",
            )

        if round_.status != RoundStatus.OPEN:
            raise ConflictError(
                "Submissions are already locked",
                code="ROUND_NOT_OPEN",
            )

        round_.status = RoundStatus.LOCKED
        room.status = RoomStatus.RESOLVING

        ActivityService.log(
            room_id=room.id,
            event_type=ActivityEventType.ROUND_LOCKED,
            payload={
                "round_id": round_.id,
                "round_number": round_.round_number,
            },
            actor_user_id=host_user_id,
            round_id=round_.id,
        )

        db.session.commit()
        db.session.refresh(round_)
        return round_

    @staticmethod
    def complete_round(*, room_id: int, host_user_id: int, round_id: int) -> Round:
        RoundService._require_host(room_id, host_user_id)

        room = RoomService.get_by_id(room_id)
        if room.status != RoomStatus.RESOLVING:
            raise ConflictError(
                "Round cannot be completed in this room state",
                code="INVALID_ROOM_STATE",
            )

        round_ = RoundService.get_round_in_room(round_id, room_id)

        if room.current_round_id != round_.id:
            raise ConflictError(
                "This round is not the active room round",
                code="ROUND_NOT_ACTIVE",
            )

        if round_.status != RoundStatus.LOCKED:
            raise ConflictError(
                "Round must be locked before completion",
                code="ROUND_NOT_LOCKED",
            )

        round_.status = RoundStatus.COMPLETE
        round_.resolved_at = utcnow()
        room.status = RoomStatus.RESULTS

        # Leave in-flight or failed generations unchanged; only settle idle pending rows.
        for sub in round_.submissions:
            if sub.status == SubmissionStatus.PENDING:
                sub.status = SubmissionStatus.COMPLETED

        ActivityService.log(
            room_id=room.id,
            event_type=ActivityEventType.ROUND_COMPLETED,
            payload={
                "round_id": round_.id,
                "round_number": round_.round_number,
            },
            actor_user_id=host_user_id,
            round_id=round_.id,
        )

        db.session.flush()
        db.session.commit()
        db.session.refresh(round_)
        return round_

    @staticmethod
    def _validate_prompt_text(prompt_text: str) -> str:
        text = prompt_text.strip()
        if not text:
            raise ValueError("prompt_text is required")
        if len(text) > RoundService.MAX_PROMPT_CHARS:
            raise ValueError(f"prompt_text must be {RoundService.MAX_PROMPT_CHARS} characters or fewer")
        return text

    @staticmethod
    def submit_prompt(
        *,
        round_id: int,
        user_id: int,
        prompt_text: str,
        expected_room_id: int | None = None,
    ) -> Submission:
        round_ = db.session.scalar(
            select(Round)
            .options(joinedload(Round.submissions))
            .where(Round.id == round_id)
        )
        if round_ is None:
            raise NotFoundError("Round not found", code="ROUND_NOT_FOUND")

        if expected_room_id is not None and round_.room_id != expected_room_id:
            raise NotFoundError("Round not found for this room", code="ROUND_NOT_IN_ROOM")

        room = RoomService.get_by_id(round_.room_id)
        participant = RoomService.get_active_participant(room.id, user_id)
        if participant is None:
            raise ForbiddenError("Not a member of this room", code="NOT_ROOM_MEMBER")
        if participant.role == ParticipantRole.HOST:
            raise ForbiddenError(
                "Host cannot submit prompts",
                code="HOST_CANNOT_SUBMIT",
            )

        if room.current_round_id != round_.id:
            raise ConflictError(
                "This round is not active",
                code="ROUND_NOT_ACTIVE",
            )

        if room.status != RoomStatus.PROMPTING:
            raise ConflictError(
                "Submissions are closed",
                code="SUBMISSIONS_CLOSED",
            )

        if round_.status != RoundStatus.OPEN:
            raise ConflictError(
                "This round is not accepting prompts",
                code="ROUND_NOT_OPEN",
            )

        text = RoundService._validate_prompt_text(prompt_text)

        existing = db.session.scalar(
            select(Submission).where(
                Submission.round_id == round_.id,
                Submission.user_id == user_id,
            )
        )
        if existing is not None:
            raise ConflictError(
                "You already submitted for this round",
                code="DUPLICATE_SUBMISSION",
            )

        submission = Submission(
            round_id=round_.id,
            user_id=user_id,
            prompt_text=text,
            status=SubmissionStatus.PENDING,
            submitted_at=utcnow(),
        )
        db.session.add(submission)

        user = db.session.get(User, user_id)
        display_name = user.display_name if user else ""

        ActivityService.log(
            room_id=room.id,
            event_type=ActivityEventType.PROMPT_SUBMITTED,
            payload={
                "round_id": round_.id,
                "display_name": display_name,
                "user_id": user_id,
            },
            actor_user_id=user_id,
            round_id=round_.id,
        )

        try:
            db.session.flush()
            db.session.commit()
        except IntegrityError as exc:
            db.session.rollback()
            raise ConflictError(
                "You already submitted for this round",
                code="DUPLICATE_SUBMISSION",
            ) from exc

        db.session.refresh(submission)
        return submission
