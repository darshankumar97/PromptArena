from __future__ import annotations

from flask_jwt_extended import create_access_token, create_refresh_token

from app.errors import NotFoundError
from app.models import User
from extensions import db


class AuthService:
    @staticmethod
    def register_user(display_name: str) -> tuple[User, dict]:
        name = display_name.strip()
        if not name:
            raise ValueError("display_name is required")
        if len(name) > 64:
            raise ValueError("display_name must be 64 characters or fewer")

        user = User(display_name=name)
        db.session.add(user)
        db.session.commit()
        return user, AuthService.issue_tokens(user)

    @staticmethod
    def get_user(user_id: int) -> User:
        user = db.session.get(User, user_id)
        if user is None:
            raise NotFoundError("User not found", code="USER_NOT_FOUND")
        return user

    @staticmethod
    def issue_tokens(user: User) -> dict:
        identity = str(user.id)
        additional_claims = {"display_name": user.display_name}
        return {
            "access_token": create_access_token(
                identity=identity,
                additional_claims=additional_claims,
            ),
            "refresh_token": create_refresh_token(
                identity=identity,
                additional_claims=additional_claims,
            ),
            "token_type": "Bearer",
            "user": user.to_dict(),
        }
