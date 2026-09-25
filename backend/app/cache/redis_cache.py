import time

from app.config import get_settings


class CacheService:
    _memory_cache: dict[str, tuple[float, object]] = {}

    def __init__(self) -> None:
        self.settings = get_settings()
        self.redis_client = self._create_redis_client()

    def _create_redis_client(self):
        if not self.settings.redis_url:
            return None

        try:
            import redis
        except ImportError:
            return None

        return redis.from_url(self.settings.redis_url, decode_responses=True)

    def get(self, key: str):
        if self.redis_client is not None:
            return self.redis_client.get(key)

        entry = self._memory_cache.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if expires_at < time.time():
            self._memory_cache.pop(key, None)
            return None
        return value

    def set(self, key: str, value, ttl_seconds: int = 300) -> None:
        if self.redis_client is not None:
            self.redis_client.setex(key, ttl_seconds, value)
            return

        self._memory_cache[key] = (time.time() + ttl_seconds, value)
