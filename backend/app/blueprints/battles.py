from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.errors import AppError, ForbiddenError, NotFoundError
from app.models import User
from app.services.battle_history_service import BattleHistoryService
from extensions import db

battles_bp = Blueprint("battles", __name__, url_prefix="/api/battles")


def _current_user() -> User:
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found", code="USER_NOT_FOUND")
    return user


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise ForbiddenError("Admins only", code="FORBIDDEN")


@battles_bp.get("/my")
@jwt_required()
def my_battles():
    user = _current_user()
    battles = BattleHistoryService.list_my_battles(user.id)
    return jsonify(battles)


@battles_bp.get("/admin")
@jwt_required()
def admin_battles():
    user = _current_user()
    _require_admin(user)
    battles = BattleHistoryService.list_admin_battles()
    return jsonify(battles)


@battles_bp.get("/admin/users")
@jwt_required()
def admin_users():
    user = _current_user()
    _require_admin(user)
    users = BattleHistoryService.list_admin_users()
    return jsonify(users)


@battles_bp.post("/admin/grant")
@jwt_required()
def grant_admin():
    user = _current_user()
    _require_admin(user)
    body = request.get_json(silent=True) or {}
    target_id = body.get("user_id")
    if not target_id:
        raise AppError("user_id is required", code="VALIDATION_ERROR", status_code=422)

    target = db.session.get(User, int(target_id))
    if target is None:
        raise NotFoundError("User not found", code="USER_NOT_FOUND")

    target.is_admin = True
    db.session.commit()
    return jsonify({"ok": True})
