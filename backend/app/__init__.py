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
        _migrate_users_is_admin(flask_app)
        _migrate_generation_jobs(flask_app)
        _recover_queued_generation_jobs(flask_app)
        table_names = sorted(db.metadata.tables.keys())
        flask_app.logger.info("Database schema ready (%d tables): %s", len(table_names), ", ".join(table_names))


def _migrate_users_is_admin(flask_app: Flask) -> None:
    from sqlalchemy import inspect, select, text

    from app.models import User
    from app.services.auth_service import AuthService

    inspector = inspect(db.engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "is_admin" not in columns:
        with db.engine.connect() as conn:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0")
            )
            conn.commit()
        flask_app.logger.info("Added users.is_admin column")

    if flask_app.config.get("TESTING"):
        return

    admin = db.session.scalar(select(User).where(User.is_admin.is_(True)))
    if admin is None:
        user = User(display_name="Admin", is_admin=True)
        db.session.add(user)
        db.session.commit()
        tokens = AuthService.issue_tokens(user)
        flask_app.logger.info(
            "[INIT] Bootstrap admin user id=%s — save this JWT for /admin: %s",
            user.id,
            tokens["access_token"],
        )


def _migrate_generation_jobs(flask_app: Flask) -> None:
    """Add columns introduced after early prototypes (submission-linked jobs)."""
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    if "generation_jobs" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("generation_jobs")}
    with db.engine.connect() as conn:
        if "submission_id" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE generation_jobs "
                    "ADD COLUMN submission_id INTEGER NOT NULL DEFAULT 0"
                )
            )
            conn.commit()
            flask_app.logger.info("Added generation_jobs.submission_id column")
        if "retry_count" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE generation_jobs "
                    "ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0"
                )
            )
            conn.commit()
            flask_app.logger.info("Added generation_jobs.retry_count column")

        table_sql = conn.execute(
            text(
                "SELECT sql FROM sqlite_master "
                "WHERE type='table' AND name='generation_jobs'"
            )
        ).scalar()
        if table_sql and "uq_generation_job_round" in table_sql:
            conn.execute(text("DROP TABLE IF EXISTS generation_jobs_new"))
            conn.commit()
            conn.execute(
                text(
                    """
                    UPDATE generation_jobs
                    SET submission_id = (
                        SELECT s.id FROM submissions s
                        WHERE s.round_id = generation_jobs.round_id
                        ORDER BY s.id ASC
                        LIMIT 1
                    )
                    WHERE submission_id = 0 OR submission_id IS NULL
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE generation_jobs_new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        submission_id INTEGER NOT NULL,
                        round_id INTEGER NOT NULL,
                        job_type VARCHAR(13) NOT NULL,
                        status VARCHAR(9) NOT NULL,
                        retry_count INTEGER NOT NULL DEFAULT 0,
                        error_message TEXT,
                        started_at DATETIME,
                        finished_at DATETIME,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_generation_job_submission UNIQUE (submission_id),
                        FOREIGN KEY(submission_id) REFERENCES submissions (id),
                        FOREIGN KEY(round_id) REFERENCES rounds (id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_generation_jobs_round_id "
                    "ON generation_jobs_new (round_id)"
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO generation_jobs_new (
                        id, submission_id, round_id, job_type, status,
                        retry_count, error_message, started_at, finished_at,
                        created_at, updated_at
                    )
                    SELECT
                        id, submission_id, round_id, job_type, status,
                        retry_count, error_message, started_at, finished_at,
                        created_at, updated_at
                    FROM generation_jobs
                    WHERE submission_id IS NOT NULL AND submission_id != 0
                    """
                )
            )
            conn.execute(text("DROP TABLE generation_jobs"))
            conn.execute(text("ALTER TABLE generation_jobs_new RENAME TO generation_jobs"))
            conn.commit()
            flask_app.logger.info(
                "Rebuilt generation_jobs table (unique per submission, not per round)"
            )


def _recover_queued_generation_jobs(flask_app: Flask) -> None:
    """Re-dispatch jobs left queued when the API restarts in local dev (thread pool mode)."""
    from sqlalchemy import select

    from app.enums import JobStatus
    from app.jobs.executor import enqueue_generation_job
    from app.jobs.queue_config import should_use_rq_queue
    from app.models import GenerationJob

    if should_use_rq_queue(flask_app):
        return

    queued_ids = list(
        db.session.scalars(
            select(GenerationJob.id).where(GenerationJob.status == JobStatus.QUEUED)
        ).all()
    )
    if not queued_ids:
        return

    flask_app.logger.info(
        "Recovering %d queued generation job(s) via in-process thread pool",
        len(queued_ids),
    )
    for job_id in queued_ids:
        enqueue_generation_job(job_id, app=flask_app)


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

    async_mode = app.config.get("SOCKETIO_ASYNC_MODE", "threading")
    socketio.init_app(
        app,
        cors_allowed_origins=cors_origins or "*",
        message_queue=app.config.get("SOCKETIO_MESSAGE_QUEUE"),
        async_mode=async_mode,
    )
    app.logger.info("Flask-SocketIO initialized async_mode=%s", socketio.async_mode)
    if not app.config.get("TESTING") and async_mode == "threading" and not app.debug:
        app.logger.warning(
            "SOCKETIO_ASYNC_MODE=threading in a non-debug app. "
            "Production (Gunicorn) requires eventlet: "
            "gunicorn -c gunicorn.conf.py wsgi:app"
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
    from sqlalchemy.exc import SQLAlchemyError

    @app.errorhandler(AppError)
    def handle_app_error(exc: AppError):
        return jsonify({"error": {"code": exc.code, "message": exc.message}}), exc.status_code

    @app.errorhandler(SQLAlchemyError)
    def handle_db_error(exc: SQLAlchemyError):
        from sqlalchemy.exc import IntegrityError

        app.logger.exception("Database error")
        if isinstance(exc, IntegrityError):
            return (
                jsonify(
                    {
                        "error": {
                            "code": "CONFLICT",
                            "message": "Database constraint conflict",
                        }
                    }
                ),
                409,
            )
        return (
            jsonify(
                {
                    "error": {
                        "code": "DATABASE_ERROR",
                        "message": "Database error — restart the API after upgrading",
                    }
                }
            ),
            500,
        )

    @app.errorhandler(404)
    def handle_not_found(_exc):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Not found"}}), 404

    @app.errorhandler(500)
    def handle_server_error(_exc):
        return jsonify({"error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}}), 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):
        if isinstance(exc, (AppError, SQLAlchemyError)):
            raise exc
        app.logger.exception("Unhandled error")
        return (
            jsonify({"error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}}),
            500,
        )


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
