from __future__ import annotations

import os

from flask import Flask

RQ_QUEUE_NAME = os.getenv("RQ_QUEUE_NAME", "arena").strip() or "arena"


def _env_flag(name: str) -> str | None:
    value = os.getenv(name, "").strip().lower()
    if value in ("1", "true", "yes"):
        return "yes"
    if value in ("0", "false", "no"):
        return "no"
    return None


def should_use_rq_queue(app: Flask | None = None) -> bool:
    """Use Redis/RQ for generation jobs when explicitly enabled or in production."""
    from app.services.redis_client import get_redis

    flag = _env_flag("USE_RQ_QUEUE")
    if flag == "no":
        return False
    if flag == "yes":
        return get_redis() is not None

    if app is not None and (app.config.get("TESTING") or app.config.get("DEBUG")):
        return False

    return get_redis() is not None
