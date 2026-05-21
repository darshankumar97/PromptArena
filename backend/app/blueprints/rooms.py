from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, select

from app.enums import ConnectionStatus
from app.errors import AppError
from app.models import Round, Submission
from app.services.generation_service import GenerationService
from app.services.judging_service import JudgingService
from app.services.activity_service import ActivityService
from app.services.auth_service import AuthService
from app.services.room_service import RoomService
from app.services.round_service import RoundService
from app.services.snapshot_service import SnapshotService
from app.socket_handlers.broadcast import (
    emit_round_completed,
    emit_round_locked,
    emit_round_started,
    emit_submission_received,
    emit_submission_scored,
    emit_winner_selected,
    notify_room_sync,
)
from app.utils.submission_hooks import schedule_generation_for_submission
from extensions import db

rooms_bp = Blueprint("rooms", __name__, url_prefix="/api/rooms")


@rooms_bp.post("")
@jwt_required()
def create_room():
    user_id = int(get_jwt_identity())
    user = AuthService.get_user(user_id)
    body = request.get_json(silent=True) or {}
    max_players = body.get("max_players")
    try:
        room = RoomService.create_room(host=user, max_players=max_players)
    except ValueError as exc:
        raise AppError(str(exc), code="VALIDATION_ERROR", status_code=422) from exc
    return jsonify({"room": room.to_dict()}), 201


@rooms_bp.get("/<code>")
def get_room_by_code(code: str):
    summary = RoomService.get_lobby_summary(code)
    return jsonify(summary)


@rooms_bp.get("/id/<int:room_id>")
@jwt_required()
def get_room_detail(room_id: int):
    user_id = int(get_jwt_identity())
    room = RoomService.get_member_room(room_id, user_id)
    participants = RoomService.list_active_participants(room_id)
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify(
        {
            "room": room.to_dict(),
            "participants": [p.to_dict() for p in participants],
            "snapshot": snapshot,
        }
    )


@rooms_bp.get("/id/<int:room_id>/snapshot")
@jwt_required()
def get_room_snapshot(room_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify({"snapshot": snapshot})


@rooms_bp.post("/id/<int:room_id>/join")
@jwt_required()
def join_room_rest(room_id: int):
    user_id = int(get_jwt_identity())
    user = AuthService.get_user(user_id)
    room = RoomService.get_by_id(room_id)

    participant, is_new_join = RoomService.enter_room(room=room, user=user)
    participant.connection_status = ConnectionStatus.ONLINE
    db.session.commit()
    if is_new_join:
        notify_room_sync(room_id)
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify(
        {
            "participant": participant.to_dict(),
            "snapshot": snapshot,
            "reconnected": not is_new_join,
        }
    ), 200


@rooms_bp.get("/id/<int:room_id>/activity")
@jwt_required()
def get_room_activity(room_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)
    after_id = request.args.get("after_id", 0, type=int)
    limit = request.args.get("limit", 50, type=int)
    events = ActivityService.list_for_room(room_id, after_id=after_id, limit=limit)
    return jsonify({"events": [event.to_dict() for event in events]})


@rooms_bp.post("/id/<int:room_id>/round/start")
@jwt_required()
def rest_start_round(room_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)
    body = request.get_json(silent=True) or {}
    battle_theme = body.get("battle_theme")
    deadline_seconds = body.get("deadline_seconds")

    try:
        round_ = RoundService.start_round(
            room_id=room_id,
            host_user_id=user_id,
            battle_theme=battle_theme,
            deadline_seconds=int(deadline_seconds)
            if deadline_seconds is not None
            else None,
        )
    except (AppError, ValueError, TypeError) as exc:
        if isinstance(exc, AppError):
            raise
        raise AppError(str(exc), code="VALIDATION_ERROR", status_code=422) from exc

    notify_room_sync(room_id)
    emit_round_started(
        room_id,
        {
            "round_id": round_.id,
            "round_number": round_.round_number,
            "battle_theme": round_.battle_theme,
            "prompt_deadline": round_.prompt_deadline.isoformat()
            if round_.prompt_deadline
            else None,
        },
    )

    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify({"round": round_.to_dict(), "snapshot": snapshot}), 201


@rooms_bp.post("/id/<int:room_id>/round/<int:round_id>/lock")
@jwt_required()
def rest_lock_round(room_id: int, round_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)

    try:
        round_ = RoundService.lock_submissions(
            room_id=room_id,
            host_user_id=user_id,
            round_id=round_id,
        )
    except AppError:
        raise

    notify_room_sync(room_id)
    emit_round_locked(
        room_id,
        {"round_id": round_.id, "round_number": round_.round_number},
    )
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify({"round": round_.to_dict(), "snapshot": snapshot})


@rooms_bp.post("/id/<int:room_id>/round/<int:round_id>/complete")
@jwt_required()
def rest_complete_round(room_id: int, round_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)

    try:
        round_ = RoundService.complete_round(
            room_id=room_id,
            host_user_id=user_id,
            round_id=round_id,
        )
    except AppError:
        raise

    notify_room_sync(room_id)
    emit_round_completed(
        room_id,
        {"round_id": round_.id, "round_number": round_.round_number},
    )
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify({"round": round_.to_dict(), "snapshot": snapshot})


@rooms_bp.post("/id/<int:room_id>/round/<int:round_id>/submit")
@jwt_required()
def rest_submit_prompt(room_id: int, round_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)
    body = request.get_json(silent=True) or {}
    prompt_text = body.get("prompt_text", "")

    try:
        submission = RoundService.submit_prompt(
            round_id=round_id,
            user_id=user_id,
            prompt_text=prompt_text,
            expected_room_id=room_id,
        )
    except (AppError, ValueError, TypeError) as exc:
        if isinstance(exc, AppError):
            raise
        raise AppError(str(exc), code="VALIDATION_ERROR", status_code=422) from exc

    job = schedule_generation_for_submission(submission)
    db.session.expire_all()

    submitted_count = (
        db.session.scalar(
            select(func.count())
            .select_from(Submission)
            .where(Submission.round_id == submission.round_id)
        )
        or 0
    )

    notify_room_sync(room_id)
    emit_submission_received(
        room_id,
        {
            "round_id": submission.round_id,
            "user_id": user_id,
            "submission_id": submission.id,
            "submitted_count": int(submitted_count),
        },
    )

    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify(
        {
            "submission": submission.to_dict(reveal_prompt=True),
            "generation_job": job.to_dict(),
            "snapshot": snapshot,
        }
    ), 201


@rooms_bp.post("/id/<int:room_id>/submissions/<int:submission_id>/score")
@jwt_required()
def score_submission(room_id: int, submission_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)
    body = request.get_json(silent=True) or {}
    score = body.get("score")

    try:
        submission = JudgingService.score_submission(
            room_id=room_id,
            host_user_id=user_id,
            submission_id=submission_id,
            score=score,
        )
    except (AppError, ValueError, TypeError) as exc:
        if isinstance(exc, AppError):
            raise
        raise AppError(str(exc), code="VALIDATION_ERROR", status_code=422) from exc

    notify_room_sync(room_id)
    emit_submission_scored(
        room_id,
        {
            "submission_id": submission.id,
            "round_id": submission.round_id,
            "user_id": submission.user_id,
            "score": submission.score,
        },
    )
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify({"submission": submission.to_dict(reveal_prompt=True), "snapshot": snapshot})


@rooms_bp.post("/id/<int:room_id>/round/<int:round_id>/winner")
@jwt_required()
def select_winner(room_id: int, round_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)
    body = request.get_json(silent=True) or {}
    submission_id = body.get("submission_id")
    if not submission_id:
        raise AppError("submission_id is required", code="VALIDATION_ERROR", status_code=422)

    try:
        round_ = JudgingService.select_winner(
            room_id=room_id,
            host_user_id=user_id,
            round_id=round_id,
            submission_id=int(submission_id),
        )
    except (AppError, TypeError):
        raise

    notify_room_sync(room_id)
    emit_winner_selected(
        room_id,
        {
            "round_id": round_.id,
            "round_number": round_.round_number,
            "winner_user_id": round_.winner_user_id,
            "submission_id": int(submission_id),
        },
    )
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify({"round": round_.to_dict(), "snapshot": snapshot})


@rooms_bp.post("/id/<int:room_id>/submissions/<int:submission_id>/retry")
@jwt_required()
def retry_generation(room_id: int, submission_id: int):
    user_id = int(get_jwt_identity())
    RoomService.get_member_room(room_id, user_id)

    submission = db.session.get(Submission, submission_id)
    if submission is None:
        raise AppError("Submission not found", code="SUBMISSION_NOT_FOUND", status_code=404)

    round_row = db.session.get(Round, submission.round_id)
    if round_row is None or round_row.room_id != room_id:
        raise AppError("Submission not found for this room", code="SUBMISSION_NOT_FOUND", status_code=404)

    if submission.user_id != user_id:
        raise AppError("You can only retry your own submission", code="FORBIDDEN", status_code=403)

    job = submission.generation_job
    if job is None:
        raise AppError("No generation job for this submission", code="JOB_NOT_FOUND", status_code=404)

    from flask import current_app

    job = GenerationService.retry_job(job.id, app=current_app._get_current_object())
    snapshot = SnapshotService.build(room_id, viewer_user_id=user_id)
    return jsonify({"generation_job": job.to_dict(), "snapshot": snapshot})
