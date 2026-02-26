import time
from typing import Any, Optional


class CacheService:
    """
    Cache simples em memória com TTL.
    Estrutura interna:
    {
        "chave": {
            "value": dados,
            "expires_at": timestamp
        }
    }
    """

    def __init__(self):
        self._cache = {}

    def get(self, key: str) -> Optional[Any]:
        item = self._cache.get(key)

        if not item:
            return None

        if item["expires_at"] < time.time():
            del self._cache[key]
            return None

        return item["value"]

    def set(self, key: str, value: Any, ttl: int = 60):
        self._cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl
        }

    def delete(self, key: str):
        self._cache.pop(key, None)

    def clear(self):
        self._cache.clear()

    def get_stats(self):
        now = time.time()
        valid = sum(
            1 for item in self._cache.values()
            if item["expires_at"] > now
        )

        return {
            "total_entries": len(self._cache),
            "valid_entries": valid,
            "expired_entries": len(self._cache) - valid
        }


# 🔥 INSTÂNCIA GLOBAL ÚNICA
_cache_instance = CacheService()


def get_cache() -> CacheService:
    return _cache_instance