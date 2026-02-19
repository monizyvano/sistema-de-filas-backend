from datetime import datetime
from typing import Any, Optional
import time


class CacheService:
    _cache = {}
    
    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        if key not in cls._cache:
            return None
        
        entry = cls._cache[key]
        
        if time.time() > entry['expires_at']:
            del cls._cache[key]
            return None
        
        return entry['value']
    
    @classmethod
    def set(cls, key: str, value: Any, ttl_seconds: int = 60):
        cls._cache[key] = {
            'value': value,
            'expires_at': time.time() + ttl_seconds,
        }
    
    @classmethod
    def delete(cls, key: str):
        if key in cls._cache:
            del cls._cache[key]
    
    @classmethod
    def clear(cls):
        cls._cache.clear()