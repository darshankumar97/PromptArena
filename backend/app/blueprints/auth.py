from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.errors import AppError
from app.services.auth_service import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    display_name = body.get("display_name", "")
    try:
        user, tokens = AuthService.register_user(display_name)
    except ValueError as exc:
        raise AppError(str(exc), code="VALIDATION_ERROR", status_code=422) from exc
    return jsonify(tokens), 201


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user_id = int(get_jwt_identity())
    user = AuthService.get_user(user_id)
    tokens = AuthService.issue_tokens(user)
    return jsonify(
        {
            "access_token": tokens["access_token"],
            "token_type": tokens["token_type"],
        }
    )


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = AuthService.get_user(user_id)
    return jsonify({"user": user.to_dict()})
