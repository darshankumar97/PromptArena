from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS

from app.blueprints import register_blueprints
from app.errors import AppError
from app.socket_handlers import register_socket_handlers
from config import get_config
from extensions import db, jwt, socketio


def create_app(config_object: type | None = None) -> Flask:
    app = Flask(__name__)
    config = config_object or get_config()
    app.config.from_object(config)

    _init_extensions(app)
    _ensure_database_schema(app)
    register_blueprints(app)
    register_socket_handlers()
    _register_error_handlers(app)
    _register_cli(app)
    _register_shutdown(app)

    return app


def _ensure_database_schema(flask_app: Flask) -> None:
    """Create tables when missing (idempotent). Required on fresh deploys (e.g. Render).

    Schema changes are not migrated automatically; use init-db after model updates
    in development or add Alembic for production migrations later.
    """
    import app.models  # noqa: F401 — register all models with SQLAlchemy metadata

    with flask_app.app_context():
        db.create_all()


def _register_shutdown(_app: Flask) -> None:
    import atexit
    from app.jobs.executor import shutdown_executor

    atexit.register(shutdown_executor)


def _init_extensions(app: Flask) -> None:
    db.init_app(app)
    jwt.init_app(app)

    cors_origins = app.config.get("CORS_ORIGINS") or []
    if cors_origins:
        CORS(app, resources={r"/api/*": {"origins": cors_origins}}, supports_credentials=True)

    socketio.init_app(
        app,
        cors_allowed_origins=cors_origins or "*",
        message_queue=app.config.get("SOCKETIO_MESSAGE_QUEUE"),
        async_mode=app.config.get("SOCKETIO_ASYNC_MODE", "threading"),
    )

    @jwt.expired_token_loader
    def expired_token_callback(_jwt_header, _jwt_payload):
        return jsonify({"error": {"code": "TOKEN_EXPIRED", "message": "Token has expired"}}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"error": {"code": "INVALID_TOKEN", "message": str(error)}}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"error": {"code": "UNAUTHORIZED", "message": str(error)}}), 401


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(exc: AppError):
        return jsonify({"error": {"code": exc.code, "message": exc.message}}), exc.status_code

    @app.errorhandler(404)
    def handle_not_found(_exc):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Not found"}}), 404

    @app.errorhandler(500)
    def handle_server_error(_exc):
        return jsonify({"error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}}), 500


def _register_cli(app: Flask) -> None:
    @app.cli.command("init-db")
    def init_db():
        import app.models  # noqa: F401 — register models with metadata

        db.create_all()
        print("Database tables created.")

    @app.cli.command("seed-demo")
    def seed_demo():
        """Print quick demo steps (DB must be initialized)."""
        print(
            """
PromptArena demo (two browser windows recommended):

1. Start backend:  python run.py
2. Start frontend: cd ../frontend && npm run dev
3. Window A: open http://localhost:3000 — name "Host" — Create room — copy code
4. Window B: open http://localhost:3000 — name "Guest" — Join with code
5. Host: Start round → Guest: Submit prompt → wait for campaign cards
6. Host: Lock submissions → Score (1-10) → Select winner

Run automated checks: python -m pytest tests/ -v
"""
        )
