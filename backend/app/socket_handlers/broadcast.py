from __future__ import annotations

from extensions import socketio


def socket_room_name(room_id: int) -> str:
    return f"room:{room_id}"


def emit_room_snapshot_broadcast(room_id: int, snapshot: dict) -> None:
    socketio.emit("room_snapshot", snapshot, room=socket_room_name(room_id))


def emit_activity(room_id: int, event_dict: dict) -> None:
    socketio.emit("activity", {"event": event_dict}, room=socket_room_name(room_id))


def emit_round_started(room_id: int, payload: dict) -> None:
    socketio.emit("round_started", payload, room=socket_room_name(room_id))


def emit_round_locked(room_id: int, payload: dict) -> None:
    socketio.emit("round_locked", payload, room=socket_room_name(room_id))


def emit_round_completed(room_id: int, payload: dict) -> None:
    socketio.emit("round_completed", payload, room=socket_room_name(room_id))


def emit_submission_received(room_id: int, payload: dict) -> None:
    socketio.emit("submission_received", payload, room=socket_room_name(room_id))


def emit_job_queued(room_id: int, payload: dict) -> None:
    socketio.emit("job_queued", payload, room=socket_room_name(room_id))


def emit_job_running(room_id: int, payload: dict) -> None:
    socketio.emit("job_running", payload, room=socket_room_name(room_id))


def emit_job_completed(room_id: int, payload: dict) -> None:
    socketio.emit("job_completed", payload, room=socket_room_name(room_id))


def emit_job_failed(room_id: int, payload: dict) -> None:
    socketio.emit("job_failed", payload, room=socket_room_name(room_id))


def emit_submission_scored(room_id: int, payload: dict) -> None:
    socketio.emit("submission_scored", payload, room=socket_room_name(room_id))


def emit_winner_selected(room_id: int, payload: dict) -> None:
    socketio.emit("winner_selected", payload, room=socket_room_name(room_id))


def emit_room_ended(room_id: int, payload: dict | None = None) -> None:
    socketio.emit(
        "room_ended",
        payload or {"room_id": room_id},
        room=socket_room_name(room_id),
    )


def emit_spectator_updated(room_id: int, spectator_count: int) -> None:
    socketio.emit(
        "spectator_updated",
        {"room_id": room_id, "spectator_count": spectator_count},
        room=socket_room_name(room_id),
    )


def notify_room_sync(room_id: int, *, skip_sid: str | None = None) -> None:
    """Broadcast latest activity row (if any) and a public room snapshot."""
    from app.services.activity_service import ActivityService
    from app.services.snapshot_service import SnapshotService

    snapshot = SnapshotService.build(room_id, viewer_user_id=None)
    socketio.emit(
        "room_snapshot",
        snapshot,
        room=socket_room_name(room_id),
        skip_sid=skip_sid,
    )
    event = ActivityService.latest_for_room(room_id)
    if event is not None:
        socketio.emit(
            "activity",
            {"event": event.to_dict()},
            room=socket_room_name(room_id),
            skip_sid=skip_sid,
        )
