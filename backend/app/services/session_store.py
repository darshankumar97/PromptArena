from __future__ import annotations

from app.services.redis_client import get_redis

_SESSION_HASH = "socket_sessions"
_SESSION_TTL = 86400


class MemorySessionStore:
    _map: dict[str, int] = {}

    def set(self, sid: str, user_id: int) -> None:
        self._map[sid] = user_id

    def get(self, sid: str) -> int | None:
        return self._map.get(sid)

    def delete(self, sid: str) -> None:
        self._map.pop(sid, None)


class RedisSessionStore:
    def __init__(self, redis_client) -> None:
        self._redis = redis_client

    def set(self, sid: str, user_id: int) -> None:
        self._redis.hset(_SESSION_HASH, sid, str(user_id))
        self._redis.expire(_SESSION_HASH, _SESSION_TTL)

    def get(self, sid: str) -> int | None:
        val = self._redis.hget(_SESSION_HASH, sid)
        if val is None:
            return None
        return int(val)

    def delete(self, sid: str) -> None:
        self._redis.hdel(_SESSION_HASH, sid)


_store: MemorySessionStore | RedisSessionStore | None = None


def get_session_store() -> MemorySessionStore | RedisSessionStore:
    global _store
    if _store is not None:
        return _store

    redis_client = get_redis()
    if redis_client is not None:
        _store = RedisSessionStore(redis_client)
    else:
        _store = MemorySessionStore()
    return _store
