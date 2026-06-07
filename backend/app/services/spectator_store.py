from __future__ import annotations

from app.services.redis_client import get_redis

_SPECTATOR_TTL = 3600


class MemorySpectatorStore:
    _rooms: dict[int, set[str]] = {}
    _sid_rooms: dict[str, set[int]] = {}

    def add(self, room_id: int, sid: str) -> int:
        self._rooms.setdefault(room_id, set()).add(sid)
        self._sid_rooms.setdefault(sid, set()).add(room_id)
        return len(self._rooms[room_id])

    def remove(self, room_id: int, sid: str) -> int:
        room_set = self._rooms.get(room_id)
        if room_set:
            room_set.discard(sid)
            if not room_set:
                self._rooms.pop(room_id, None)
        sid_set = self._sid_rooms.get(sid)
        if sid_set:
            sid_set.discard(room_id)
            if not sid_set:
                self._sid_rooms.pop(sid, None)
        return len(self._rooms.get(room_id, set()))

    def remove_sid(self, sid: str) -> list[tuple[int, int]]:
        room_ids = list(self._sid_rooms.pop(sid, set()))
        updates: list[tuple[int, int]] = []
        for room_id in room_ids:
            count = self.remove(room_id, sid)
            updates.append((room_id, count))
        return updates


class RedisSpectatorStore:
    def __init__(self, redis_client) -> None:
        self._redis = redis_client

    def _key(self, room_id: int) -> str:
        return f"spectators:{room_id}"

    def add(self, room_id: int, sid: str) -> int:
        key = self._key(room_id)
        self._redis.sadd(key, sid)
        self._redis.expire(key, _SPECTATOR_TTL)
        self._redis.sadd(f"spectator_sid:{sid}", str(room_id))
        self._redis.expire(f"spectator_sid:{sid}", _SPECTATOR_TTL)
        return int(self._redis.scard(key))

    def remove(self, room_id: int, sid: str) -> int:
        key = self._key(room_id)
        self._redis.srem(key, sid)
        self._redis.srem(f"spectator_sid:{sid}", str(room_id))
        count = int(self._redis.scard(key))
        if count == 0:
            self._redis.delete(key)
        return count

    def remove_sid(self, sid: str) -> list[tuple[int, int]]:
        room_ids_raw = self._redis.smembers(f"spectator_sid:{sid}")
        self._redis.delete(f"spectator_sid:{sid}")
        updates: list[tuple[int, int]] = []
        for raw in room_ids_raw:
            room_id = int(raw)
            count = self.remove(room_id, sid)
            updates.append((room_id, count))
        return updates


_store: MemorySpectatorStore | RedisSpectatorStore | None = None


def get_spectator_store() -> MemorySpectatorStore | RedisSpectatorStore:
    global _store
    if _store is not None:
        return _store

    redis_client = get_redis()
    if redis_client is not None:
        _store = RedisSpectatorStore(redis_client)
    else:
        _store = MemorySpectatorStore()
    return _store
