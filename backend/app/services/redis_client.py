from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from redis import Redis

logger = logging.getLogger(__name__)

_client: Any = None
_checked = False


def get_redis() -> "Redis | None":
    global _client, _checked
    if _checked:
        return _client

    _checked = True
    url = os.environ.get("REDIS_URL", "").strip()
    if not url:
        return None

    try:
        from redis import Redis

        _client = Redis.from_url(url, socket_connect_timeout=2)
        _client.ping()
        logger.info("Redis connected")
        return _client
    except Exception as exc:
        logger.warning("Redis unavailable: %s. Falling back to thread pool.", exc)
        _client = None
        return None
