from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.enums import (
    ActivityEventType,
    JobStatus,
    RoomStatus,
    RoundStatus,
    SubmissionStatus,
)
from app.errors import ConflictError, NotFoundError
from app.models import Round, Submission, User
from app.models.base import utcnow
from app.services.activity_service import ActivityService
from app.services.room_service import RoomService
from app.services.round_service import RoundService
from extensions import db


class JudgingService:
    MIN_SCORE = 1
    MAX_SCORE = 10

    @staticmethod
    def score_submission(
        *,
        room_id: int,
        host_user_id: int,
        submission_id: int,
        score: int | float,
    ) -> Submission:
        RoundService._require_host(room_id, host_user_id)
        room = RoomService.get_by_id(room_id)
        JudgingService._require_judging_phase(room)

        submission = JudgingService._get_judgeable_submission(
            room_id=room_id,
            submission_id=submission_id,
        )

        numeric = JudgingService._validate_score(score)
        submission.score = numeric

        host = db.session.get(User, host_user_id)
        ActivityService.log(
            room_id=room_id,
            event_type=ActivityEventType.SUBMISSION_SCORED,
            payload={
                "submission_id": submission.id,
                "round_id": submission.round_id,
                "user_id": submission.user_id,
                "display_name": host.display_name if host else "",
                "score": numeric,
            },
            actor_user_id=host_user_id,
            round_id=submission.round_id,
        )

        db.session.flush()
        db.session.commit()
        db.session.refresh(submission)
        return submission

    @staticmethod
    def select_winner(
        *,
        room_id: int,
        host_user_id: int,
        round_id: int,
        submission_id: int,
    ) -> Round:
        RoundService._require_host(room_id, host_user_id)
        room = RoomService.get_by_id(room_id)
        JudgingService._require_judging_phase(room)

        round_ = RoundService.get_round_in_room(round_id, room_id)
        if room.current_round_id != round_.id:
            raise ConflictError(
                "This round is not the active room round",
                code="ROUND_NOT_ACTIVE",
            )

        if round_.status not in (RoundStatus.LOCKED, RoundStatus.COMPLETE):
            raise ConflictError(
                "Winner can only be selected after submissions are locked",
                code="ROUND_NOT_LOCKED",
            )

        submission = JudgingService._get_judgeable_submission(
            room_id=room_id,
            submission_id=submission_id,
            round_id=round_id,
        )

        round_.winner_user_id = submission.user_id
        if submission.score is None:
            submission.score = float(JudgingService.MAX_SCORE)

        if room.status == RoomStatus.RESOLVING:
            round_.status = RoundStatus.COMPLETE
            round_.resolved_at = utcnow()
            room.status = RoomStatus.RESULTS

        winner = db.session.get(User, submission.user_id)
        ActivityService.log(
            room_id=room_id,
            event_type=ActivityEventType.WINNER_ANNOUNCED,
            payload={
                "round_id": round_.id,
                "round_number": round_.round_number,
                "submission_id": submission.id,
                "winner_user_id": submission.user_id,
                "display_name": winner.display_name if winner else "",
                "score": submission.score,
            },
            actor_user_id=host_user_id,
            round_id=round_.id,
        )

        db.session.flush()
        db.session.commit()
        db.session.refresh(round_)
        return round_

    @staticmethod
    def _validate_score(score: int | float) -> float:
        try:
            numeric = float(score)
        except (TypeError, ValueError) as exc:
            raise ValueError("score must be a number") from exc

        if numeric != int(numeric):
            raise ValueError("score must be a whole number")

        whole = int(numeric)
        if whole < JudgingService.MIN_SCORE or whole > JudgingService.MAX_SCORE:
            raise ValueError(
                f"score must be between {JudgingService.MIN_SCORE} and {JudgingService.MAX_SCORE}"
            )
        return float(whole)

    @staticmethod
    def _require_judging_phase(room) -> None:
        if room.status not in (RoomStatus.RESOLVING, RoomStatus.RESULTS):
            raise ConflictError(
                "Judging is only available after submissions are locked",
                code="INVALID_ROOM_STATE",
            )

    @staticmethod
    def _get_judgeable_submission(
        *,
        room_id: int,
        submission_id: int,
        round_id: int | None = None,
    ) -> Submission:
        submission = db.session.scalar(
            select(Submission)
            .options(
                joinedload(Submission.round),
                joinedload(Submission.generation_job),
            )
            .where(Submission.id == submission_id)
        )
        if submission is None:
            raise NotFoundError("Submission not found", code="SUBMISSION_NOT_FOUND")

        if submission.round.room_id != room_id:
            raise NotFoundError(
                "Submission not found for this room",
                code="SUBMISSION_NOT_FOUND",
            )

        if round_id is not None and submission.round_id != round_id:
            raise NotFoundError(
                "Submission not found for this round",
                code="SUBMISSION_NOT_IN_ROUND",
            )

        room = RoomService.get_by_id(room_id)
        if room.current_round_id != submission.round_id:
            raise ConflictError(
                "This submission is not part of the active round",
                code="ROUND_NOT_ACTIVE",
            )

        if submission.status != SubmissionStatus.COMPLETED:
            raise ConflictError(
                "Submission generation must complete before judging",
                code="GENERATION_NOT_COMPLETE",
            )

        if not submission.ai_output:
            raise ConflictError(
                "Submission has no generated output to judge",
                code="GENERATION_NOT_COMPLETE",
            )

        job = submission.generation_job
        if job is not None and job.status != JobStatus.COMPLETED:
            raise ConflictError(
                "Submission generation must complete before judging",
                code="GENERATION_NOT_COMPLETE",
            )

        return submission
