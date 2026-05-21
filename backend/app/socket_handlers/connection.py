from __future__ import annotations

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import disconnect, emit, join_room, leave_room
from jwt.exceptions import ExpiredSignatureError, PyJWTError

from app.enums import ConnectionStatus
from app.errors import AppError
from app.models.base import utcnow
from app.services.auth_service import AuthService
from app.services.room_service import RoomService
from app.services.snapshot_service import SnapshotService
from app.socket_handlers.broadcast import notify_room_sync, socket_room_name
from extensions import db, socketio

_connected_users: dict[str, int] = {}


def get_socket_user_id() -> int | None:
    sid = request.sid
    return _connected_users.get(sid)


def register_connection_handlers() -> None:
    @socketio.on("connect")
    def on_connect():
        emit("connected", {"sid": request.sid})

    @socketio.on("disconnect")
    def on_disconnect():
        user_id = _connected_users.pop(request.sid, None)
        if user_id is None:
            return
        participants = RoomService.list_active_participants_for_user(user_id)
        affected_rooms: set[int] = set()
        for participant in participants:
            participant.connection_status = ConnectionStatus.OFFLINE
            affected_rooms.add(participant.room_id)
        db.session.commit()
        for rid in affected_rooms:
            notify_room_sync(rid)

    @socketio.on("authenticate")
    def on_authenticate(data):
        token = (data or {}).get("access_token")
        if not token:
            emit("error", {"code": "MISSING_TOKEN", "message": "access_token is required"})
            return
        try:
            claims = decode_token(token)
            user_id = int(claims["sub"])
        except ExpiredSignatureError:
            emit("error", {"code": "TOKEN_EXPIRED", "message": "Token has expired"})
            disconnect()
            return
        except (PyJWTError, KeyError, TypeError, ValueError):
            emit("error", {"code": "INVALID_TOKEN", "message": "Invalid access token"})
            disconnect()
            return

        user = AuthService.get_user(user_id)
        _connected_users[request.sid] = user.id
        emit("authenticated", {"user": user.to_dict()})

    @socketio.on("join_room")
    def on_join_room(data):
        user_id = get_socket_user_id()
        if user_id is None:
            emit("error", {"code": "UNAUTHENTICATED", "message": "Authenticate first"})
            return

        code = ((data or {}).get("room_code") or "").strip().upper()
        if not code:
            emit("error", {"code": "VALIDATION_ERROR", "message": "room_code is required"})
            return

        user = AuthService.get_user(user_id)
        room = RoomService.get_by_code(code)
        try:
            participant, is_new_join = RoomService.enter_room(room=room, user=user)
        except AppError as exc:
            emit("error", {"code": exc.code, "message": exc.message})
            return

        participant.connection_status = ConnectionStatus.ONLINE
        db.session.commit()

        join_room(socket_room_name(room.id))
        if is_new_join:
            notify_room_sync(room.id)
        else:
            emit(
                "room_snapshot",
                SnapshotService.build(room.id, viewer_user_id=user.id),
            )
            emit("room_reconnected", {"participant": participant.to_dict()})
            notify_room_sync(room.id, skip_sid=request.sid)

    @socketio.on("leave_room")
    def on_leave_room(data):
        user_id = get_socket_user_id()
        if user_id is None:
            emit("error", {"code": "UNAUTHENTICATED", "message": "Authenticate first"})
            return

        room_id = (data or {}).get("room_id")
        if not room_id:
            emit("error", {"code": "VALIDATION_ERROR", "message": "room_id is required"})
            return

        participant = RoomService.get_active_participant(room_id, user_id)
        if participant:
            participant.connection_status = ConnectionStatus.OFFLINE
            participant.left_at = utcnow()
            db.session.commit()
            leave_room(socket_room_name(room_id))
            notify_room_sync(room_id)
