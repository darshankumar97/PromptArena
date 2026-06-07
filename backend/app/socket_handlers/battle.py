from __future__ import annotations

from sqlalchemy import func, select

from app.errors import AppError
from app.models import Round, Submission
from app.services.room_service import RoomService
from app.services.round_service import RoundService
from app.utils.submission_hooks import schedule_generation_for_submission
from app.socket_handlers.broadcast import (
    emit_round_completed,
    emit_round_locked,
    emit_round_started,
    emit_room_ended,
    emit_submission_received,
    notify_room_sync,
)
from app.socket_handlers.connection import get_socket_user_id
from extensions import db, socketio


def register_battle_handlers() -> None:
    @socketio.on("start_round")
    def on_start_round(data):
        user_id = get_socket_user_id()
        if user_id is None:
            return _ack_unauthenticated()

        body = data or {}
        room_id = body.get("room_id")
        if not room_id:
            return _validation_error("room_id is required")

        battle_theme = body.get("battle_theme")
        deadline_seconds = body.get("deadline_seconds")

        try:
            round_ = RoundService.start_round(
                room_id=int(room_id),
                host_user_id=user_id,
                battle_theme=battle_theme,
                deadline_seconds=int(deadline_seconds)
                if deadline_seconds is not None
                else None,
            )
        except (AppError, ValueError, TypeError) as exc:
            return _handle_exc(exc)

        room_id_int = int(room_id)
        notify_room_sync(room_id_int)
        emit_round_started(
            room_id_int,
            {
                "round_id": round_.id,
                "round_number": round_.round_number,
                "battle_theme": round_.battle_theme,
                "prompt_deadline": round_.to_dict()["prompt_deadline"],
            },
        )
        return {"ok": True, "round_id": round_.id}

    @socketio.on("lock_submissions")
    def on_lock_submissions(data):
        user_id = get_socket_user_id()
        if user_id is None:
            return _ack_unauthenticated()

        body = data or {}
        room_id = body.get("room_id")
        round_id = body.get("round_id")
        if not room_id or not round_id:
            return _validation_error("room_id and round_id are required")

        try:
            round_ = RoundService.lock_submissions(
                room_id=int(room_id),
                host_user_id=user_id,
                round_id=int(round_id),
            )
        except (AppError, TypeError) as exc:
            return _handle_exc(exc)

        room_id_int = int(room_id)
        notify_room_sync(room_id_int)
        emit_round_locked(
            room_id_int,
            {"round_id": round_.id, "round_number": round_.round_number},
        )
        return {"ok": True, "round_id": round_.id}

    @socketio.on("complete_round")
    def on_complete_round(data):
        user_id = get_socket_user_id()
        if user_id is None:
            return _ack_unauthenticated()

        body = data or {}
        room_id = body.get("room_id")
        round_id = body.get("round_id")
        if not room_id or not round_id:
            return _validation_error("room_id and round_id are required")

        try:
            round_ = RoundService.complete_round(
                room_id=int(room_id),
                host_user_id=user_id,
                round_id=int(round_id),
            )
        except (AppError, TypeError) as exc:
            return _handle_exc(exc)

        room_id_int = int(room_id)
        notify_room_sync(room_id_int)
        emit_round_completed(
            room_id_int,
            {"round_id": round_.id, "round_number": round_.round_number},
        )
        return {"ok": True, "round_id": round_.id}

    @socketio.on("end_room")
    def on_end_room(data):
        user_id = get_socket_user_id()
        if user_id is None:
            return _ack_unauthenticated()

        body = data or {}
        room_id = body.get("room_id")
        if not room_id:
            return _validation_error("room_id is required")

        try:
            room = RoomService.end_room(
                room_id=int(room_id),
                host_user_id=user_id,
            )
        except (AppError, TypeError) as exc:
            return _handle_exc(exc)

        room_id_int = int(room_id)
        notify_room_sync(room_id_int)
        emit_room_ended(room_id_int, {"room_id": room.id, "code": room.code})
        return {"ok": True, "room_id": room.id}

    @socketio.on("submit_prompt")
    def on_submit_prompt(data):
        from flask_socketio import emit

        user_id = get_socket_user_id()
        if user_id is None:
            return _ack_unauthenticated()

        body = data or {}
        round_id = body.get("round_id")
        prompt_text = body.get("prompt_text", "")
        if not round_id:
            return _validation_error("round_id is required")

        try:
            submission = RoundService.submit_prompt(
                round_id=int(round_id),
                user_id=user_id,
                prompt_text=prompt_text,
            )
        except (AppError, ValueError, TypeError) as exc:
            return _handle_exc(exc)

        schedule_generation_for_submission(submission)

        round_row = db.session.get(Round, submission.round_id)
        if round_row is None:
            raise RuntimeError("Round missing after submission write")
        room_id_int = round_row.room_id
        submitted_count = (
            db.session.scalar(
                select(func.count())
                .select_from(Submission)
                .where(Submission.round_id == submission.round_id)
            )
            or 0
        )

        notify_room_sync(room_id_int)
        emit_submission_received(
            room_id_int,
            {
                "round_id": submission.round_id,
                "user_id": user_id,
                "submission_id": submission.id,
                "submitted_count": int(submitted_count),
            },
        )
        emit(
            "submission_saved",
            {"round_id": submission.round_id, "submission_id": submission.id},
        )
        return {"ok": True, "submission_id": submission.id}


def _ack_unauthenticated():
    from flask_socketio import emit

    emit("error", {"code": "UNAUTHENTICATED", "message": "Authenticate first"})
    return {"ok": False, "error": {"code": "UNAUTHENTICATED", "message": "Authenticate first"}}


def _validation_error(message: str):
    from flask_socketio import emit

    emit("error", {"code": "VALIDATION_ERROR", "message": message})
    return {"ok": False, "error": {"code": "VALIDATION_ERROR", "message": message}}


def _handle_exc(exc: Exception):
    from flask_socketio import emit

    if isinstance(exc, AppError):
        emit("error", {"code": exc.code, "message": exc.message})
        return {"ok": False, "error": {"code": exc.code, "message": exc.message}}
    emit("error", {"code": "VALIDATION_ERROR", "message": str(exc)})
    return {"ok": False, "error": {"code": "VALIDATION_ERROR", "message": str(exc)}}
