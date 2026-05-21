from __future__ import annotations

from app.errors import AppError
from app.services.judging_service import JudgingService
from app.socket_handlers.broadcast import (
    emit_submission_scored,
    emit_winner_selected,
    notify_room_sync,
)
from app.socket_handlers.connection import get_socket_user_id
from extensions import socketio


def register_judging_handlers() -> None:
    @socketio.on("score_submission")
    def on_score_submission(data):
        user_id = get_socket_user_id()
        if user_id is None:
            return _ack_unauthenticated()

        body = data or {}
        room_id = body.get("room_id")
        submission_id = body.get("submission_id")
        score = body.get("score")
        if not room_id or not submission_id or score is None:
            return _validation_error("room_id, submission_id, and score are required")

        try:
            submission = JudgingService.score_submission(
                room_id=int(room_id),
                host_user_id=user_id,
                submission_id=int(submission_id),
                score=score,
            )
        except (AppError, ValueError, TypeError) as exc:
            return _handle_exc(exc)

        room_id_int = int(room_id)
        notify_room_sync(room_id_int)
        emit_submission_scored(
            room_id_int,
            {
                "submission_id": submission.id,
                "round_id": submission.round_id,
                "user_id": submission.user_id,
                "score": submission.score,
            },
        )
        return {"ok": True, "submission_id": submission.id, "score": submission.score}

    @socketio.on("select_winner")
    def on_select_winner(data):
        user_id = get_socket_user_id()
        if user_id is None:
            return _ack_unauthenticated()

        body = data or {}
        room_id = body.get("room_id")
        round_id = body.get("round_id")
        submission_id = body.get("submission_id")
        if not room_id or not round_id or not submission_id:
            return _validation_error("room_id, round_id, and submission_id are required")

        try:
            round_ = JudgingService.select_winner(
                room_id=int(room_id),
                host_user_id=user_id,
                round_id=int(round_id),
                submission_id=int(submission_id),
            )
        except (AppError, TypeError) as exc:
            return _handle_exc(exc)

        room_id_int = int(room_id)
        notify_room_sync(room_id_int)
        emit_winner_selected(
            room_id_int,
            {
                "round_id": round_.id,
                "round_number": round_.round_number,
                "winner_user_id": round_.winner_user_id,
                "submission_id": int(submission_id),
            },
        )
        return {
            "ok": True,
            "round_id": round_.id,
            "winner_user_id": round_.winner_user_id,
        }


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
