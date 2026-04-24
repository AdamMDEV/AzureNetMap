from typing import Any

from cachetools import TTLCache

from .config import get_settings

_caches: dict[str, TTLCache] = {}


def get_cache(name: str = "default") -> TTLCache:
    if name not in _caches:
        settings = get_settings()
        _caches[name] = TTLCache(maxsize=256, ttl=settings.cache_ttl_seconds)
    return _caches[name]


def cache_stats() -> dict[str, Any]:
    return {
        name: {"size": len(c), "maxsize": c.maxsize, "ttl": c.ttl}
        for name, c in _caches.items()
    }
