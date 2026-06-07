from __future__ import annotations

import logging

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import disconnect, emit, join_room, leave_room
from jwt.exceptions import ExpiredSignatureError, PyJWTError

from app.enums import ConnectionStatus, RoomStatus
from app.errors import AppError
from app.models.base import utcnow
from app.services.auth_service import AuthService
from app.services.room_service import RoomService
from app.services.session_store import get_session_store
from app.services.snapshot_service import SnapshotService
from app.services.spectator_store import get_spectator_store
from app.socket_handlers.broadcast import emit_spectator_updated, notify_room_sync, socket_room_name
from extensions import db, socketio

logger = logging.getLogger(__name__)

_session_store = get_session_store()
_spectator_store = get_spectator_store()


def get_socket_user_id() -> int | None:
    sid = request.sid
    return _session_store.get(sid)


def register_connection_handlers() -> None:
    @socketio.on("connect")
    def on_connect():
        logger.info("socket connected sid=%s", request.sid)
        emit("connected", {"sid": request.sid})

    @socketio.on("disconnect")
    def on_disconnect():
        sid = request.sid
        user_id = _session_store.get(sid)
        _session_store.delete(sid)

        for room_id, count in _spectator_store.remove_sid(sid):
            emit_spectator_updated(room_id, count)

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
        _session_store.set(request.sid, user.id)
        logger.info("socket authenticated sid=%s user_id=%s", request.sid, user.id)
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

        logger.info("socket join_room requested sid=%s user_id=%s code=%s", request.sid, user_id, code)

        user = AuthService.get_user(user_id)
        try:
            room = RoomService.get_by_code(code)
        except AppError as exc:
            emit("error", {"code": exc.code, "message": exc.message})
            return

        if room.status == RoomStatus.FINISHED:
            emit("error", {"code": "ROOM_FINISHED", "message": "Room has ended"})
            return

        participant = RoomService.get_active_participant(room.id, user_id)

        if participant is None and room.status == RoomStatus.LOBBY:
            try:
                participant, is_new_join = RoomService.enter_room(room=room, user=user)
            except AppError as exc:
                logger.warning(
                    "socket join_room rejected sid=%s code=%s code_err=%s",
                    request.sid,
                    code,
                    exc.code,
                )
                emit("error", {"code": exc.code, "message": exc.message})
                return

            participant.connection_status = ConnectionStatus.ONLINE
            db.session.commit()
            join_room(socket_room_name(room.id))
            snapshot = SnapshotService.build(
                room.id,
                viewer_user_id=user.id,
                is_participant=True,
            )
            emit("room_snapshot", snapshot)
            logger.info(
                "socket lobby join sid=%s room_id=%s is_new_join=%s",
                request.sid,
                room.id,
                is_new_join,
            )
            if not is_new_join:
                emit("room_reconnected", {"participant": participant.to_dict()})
            notify_room_sync(room.id, skip_sid=request.sid)
            return

        is_spectator = participant is None

        if is_spectator:
            join_room(socket_room_name(room.id))
            count = _spectator_store.add(room.id, request.sid)
            snapshot = SnapshotService.build(
                room.id,
                viewer_user_id=user.id,
                is_participant=False,
            )
            emit("room_snapshot", snapshot)
            emit_spectator_updated(room.id, count)
            logger.info(
                "socket spectator join sid=%s room_id=%s spectators=%s",
                request.sid,
                room.id,
                count,
            )
            return

        try:
            participant, is_new_join = RoomService.enter_room(room=room, user=user)
        except AppError as exc:
            logger.warning(
                "socket join_room rejected sid=%s code=%s code_err=%s",
                request.sid,
                code,
                exc.code,
            )
            emit("error", {"code": exc.code, "message": exc.message})
            return

        participant.connection_status = ConnectionStatus.ONLINE
        db.session.commit()

        join_room(socket_room_name(room.id))
        snapshot = SnapshotService.build(
            room.id,
            viewer_user_id=user.id,
            is_participant=True,
        )
        emit("room_snapshot", snapshot)
        logger.info(
            "socket join_room acknowledged sid=%s room_id=%s is_new_join=%s",
            request.sid,
            room.id,
            is_new_join,
        )
        if not is_new_join:
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

        count = _spectator_store.remove(int(room_id), request.sid)
        if count >= 0:
            emit_spectator_updated(int(room_id), count)

        participant = RoomService.get_active_participant(room_id, user_id)
        if participant:
            participant.connection_status = ConnectionStatus.OFFLINE
            participant.left_at = utcnow()
            db.session.commit()
            leave_room(socket_room_name(room_id))
            notify_room_sync(room_id)
