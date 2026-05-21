import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")


def _csv_origins(value: str) -> list[str]:
    if not value:
        return []
    return [origin.strip() for origin in value.split(",") if origin.strip()]


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(_BACKEND_DIR / 'promptarena.db').as_posix()}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"check_same_thread": False},
    }

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "86400"))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", "604800"))
    )
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    CORS_ORIGINS = _csv_origins(os.getenv("CORS_ORIGINS", "http://localhost:3000"))

    SOCKETIO_MESSAGE_QUEUE = os.getenv("SOCKETIO_MESSAGE_QUEUE") or None
    SOCKETIO_ASYNC_MODE = os.getenv("SOCKETIO_ASYNC_MODE", "threading")

    ROOM_CODE_LENGTH = 6
    MAX_PLAYERS_DEFAULT = 8

    MOCK_AI_MIN_LATENCY = float(os.getenv("MOCK_AI_MIN_LATENCY", "2.0"))
    MOCK_AI_MAX_LATENCY = float(os.getenv("MOCK_AI_MAX_LATENCY", "6.0"))
    MOCK_AI_FAILURE_RATE = float(os.getenv("MOCK_AI_FAILURE_RATE", "0.12"))
    GENERATION_JOB_TIMEOUT_SECONDS = int(
        os.getenv("GENERATION_JOB_TIMEOUT_SECONDS", "120")
    )


class DevelopmentConfig(Config):
    DEBUG = True
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "86400"))
    )


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_SECRET_KEY = "test-jwt-secret"


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config() -> type[Config]:
    env = os.getenv("FLASK_ENV", "development")
    return config_by_name.get(env, DevelopmentConfig)
