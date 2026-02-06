"""Storage backends for persistent component caching."""

from cpg_inference.storage.base import StorageBackend
from cpg_inference.storage.sqlite_backend import SQLiteStorage

__all__ = ["StorageBackend", "SQLiteStorage"]

# Redis is optional
try:
    from cpg_inference.storage.redis_backend import RedisStorage
    __all__.append("RedisStorage")
except ImportError:
    RedisStorage = None

