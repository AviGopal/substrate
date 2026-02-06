"""Redis storage backend for centralized caching."""

import json
import pickle
import time
from typing import Dict, List

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

from cpg_inference.models import CPGComponent
from cpg_inference.storage.base import StorageBackend


class RedisStorage(StorageBackend):
    """Redis-based storage backend for centralized caching.
    
    Features:
    - Centralized shared state across multiple services
    - Connection pooling for performance
    - Retry logic with exponential backoff
    - Optional TTL for automatic expiration
    - Batch operations with pipeline
    - Multi-repository support via prefix parameter
    
    Requires:
        pip install redis
    
    Example:
        ```python
        # Basic usage
        storage = RedisStorage(host="localhost", port=6379)
        
        # With authentication
        storage = RedisStorage(
            host="redis.example.com",
            password="secret",
            db=0
        )
        
        # With TTL (components expire after 24 hours)
        storage = RedisStorage(host="localhost", ttl=86400)
        
        # Multiple repositories on same Redis instance
        storage_a = RedisStorage(host="localhost", prefix="repo_a")
        storage_b = RedisStorage(host="localhost", prefix="repo_b")
        
        # Use with context manager
        with RedisStorage(host="localhost") as storage:
            storage.store_component(component)
        ```
    """
    
    def __init__(self,
                 host: str = "localhost",
                 port: int = 6379,
                 db: int = 0,
                 password: str | None = None,
                 prefix: str = "cpg_inference",
                 ttl: int | None = None,
                 max_retries: int = 3,
                 retry_delay: float = 0.1):
        """Initialize Redis storage.
        
        Args:
            host: Redis server host
            port: Redis server port
            db: Redis database number
            password: Optional authentication password
            prefix: Key prefix for namespacing (enables multiple repositories)
            ttl: Optional TTL in seconds for automatic expiration
            max_retries: Maximum number of retries for failed operations
            retry_delay: Initial delay between retries (doubles each retry)
        """
        if not REDIS_AVAILABLE:
            raise ImportError(
                "Redis is not installed. Install it with: pip install redis"
            )
        
        self.host = host
        self.port = port
        self.db = db
        self.prefix = prefix
        self.ttl = ttl
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
        # Create connection pool
        self.pool = redis.ConnectionPool(
            host=host,
            port=port,
            db=db,
            password=password,
            decode_responses=False,  # We use binary data (pickle)
            max_connections=10,
        )
        
        self.client = redis.Redis(connection_pool=self.pool)
        
        # Test connection
        try:
            self.client.ping()
        except redis.ConnectionError as e:
            raise ConnectionError(
                f"Failed to connect to Redis at {host}:{port}: {e}"
            )
    
    def _component_key(self, component_id: str) -> str:
        """Generate Redis key for component."""
        return f"{self.prefix}:component:{component_id}"
    
    def _file_key(self, file_path: str) -> str:
        """Generate Redis key for file mapping."""
        return f"{self.prefix}:file:{file_path}:components"
    
    def _retry_operation(self, operation, *args, **kwargs):
        """Execute operation with retry logic."""
        last_exception = None
        delay = self.retry_delay
        
        for attempt in range(self.max_retries):
            try:
                return operation(*args, **kwargs)
            except (redis.ConnectionError, redis.TimeoutError) as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
        
        raise last_exception
    
    def store_component(self, component: CPGComponent) -> None:
        """Store a single component."""
        key = self._component_key(component.id)
        data = pickle.dumps(component)
        
        def _store():
            if self.ttl:
                self.client.setex(key, self.ttl, data)
            else:
                self.client.set(key, data)
        
        self._retry_operation(_store)
    
    def get_component(self, component_id: str) -> CPGComponent | None:
        """Retrieve a component by ID."""
        key = self._component_key(component_id)
        
        def _get():
            data = self.client.get(key)
            if data:
                return pickle.loads(data)
            return None
        
        return self._retry_operation(_get)
    
    def batch_store_components(self, components: List[CPGComponent]) -> None:
        """Store multiple components efficiently using pipeline."""
        if not components:
            return
        
        def _batch_store():
            pipe = self.client.pipeline()
            
            for component in components:
                key = self._component_key(component.id)
                data = pickle.dumps(component)
                
                if self.ttl:
                    pipe.setex(key, self.ttl, data)
                else:
                    pipe.set(key, data)
            
            pipe.execute()
        
        self._retry_operation(_batch_store)
    
    def batch_get_components(self, component_ids: List[str]) -> Dict[str, CPGComponent]:
        """Retrieve multiple components efficiently using pipeline."""
        if not component_ids:
            return {}
        
        def _batch_get():
            keys = [self._component_key(cid) for cid in component_ids]
            
            # Use pipeline for efficient batch get
            pipe = self.client.pipeline()
            for key in keys:
                pipe.get(key)
            
            values = pipe.execute()
            
            result = {}
            for component_id, data in zip(component_ids, values):
                if data:
                    component = pickle.loads(data)
                    result[component_id] = component
            
            return result
        
        return self._retry_operation(_batch_get)
    
    def delete_component(self, component_id: str) -> None:
        """Delete a component."""
        key = self._component_key(component_id)
        self._retry_operation(self.client.delete, key)
    
    def get_file_components(self, file_path: str) -> List[str]:
        """Get component IDs for a file."""
        key = self._file_key(file_path)
        
        def _get():
            data = self.client.get(key)
            if data:
                return json.loads(data.decode('utf-8'))
            return []
        
        return self._retry_operation(_get)
    
    def set_file_components(self, file_path: str, component_ids: List[str]) -> None:
        """Set component IDs for a file."""
        key = self._file_key(file_path)
        data = json.dumps(component_ids).encode('utf-8')
        
        def _set():
            if self.ttl:
                self.client.setex(key, self.ttl, data)
            else:
                self.client.set(key, data)
        
        self._retry_operation(_set)
    
    def delete_file(self, file_path: str) -> None:
        """Delete file mapping and its components."""
        # Get component IDs first
        component_ids = self.get_file_components(file_path)
        
        def _delete():
            pipe = self.client.pipeline()
            
            # Delete components
            for component_id in component_ids:
                key = self._component_key(component_id)
                pipe.delete(key)
            
            # Delete file mapping
            file_key = self._file_key(file_path)
            pipe.delete(file_key)
            
            pipe.execute()
        
        if component_ids:
            self._retry_operation(_delete)
        else:
            # Just delete file mapping
            file_key = self._file_key(file_path)
            self._retry_operation(self.client.delete, file_key)
    
    def get_all_files(self) -> List[str]:
        """Get all tracked file paths."""
        def _get():
            pattern = f"{self.prefix}:file:*:components"
            keys = self.client.keys(pattern)
            
            # Extract file paths from keys
            file_paths = []
            prefix_len = len(f"{self.prefix}:file:")
            suffix_len = len(":components")
            
            for key in keys:
                key_str = key.decode('utf-8')
                # Remove prefix and suffix
                file_path = key_str[prefix_len:-suffix_len]
                file_paths.append(file_path)
            
            return file_paths
        
        return self._retry_operation(_get)
    
    def get_stats(self) -> Dict[str, int]:
        """Get storage statistics."""
        def _stats():
            # Count components
            component_pattern = f"{self.prefix}:component:*"
            component_keys = self.client.keys(component_pattern)
            num_components = len(component_keys)
            
            # Count files
            file_pattern = f"{self.prefix}:file:*:components"
            file_keys = self.client.keys(file_pattern)
            num_files = len(file_keys)
            
            return {
                "num_components": num_components,
                "num_files": num_files,
                "is_memory": False,
            }
        
        return self._retry_operation(_stats)
    
    def clear(self) -> None:
        """Clear all stored data for this prefix.
        
        Deletes all keys matching this storage's prefix, enabling safe
        cleanup of specific repositories without affecting others.
        """
        def _clear():
            patterns = [f"{self.prefix}:component:*", f"{self.prefix}:file:*"]
            
            pipe = self.client.pipeline()
            for pattern in patterns:
                keys = self.client.keys(pattern)
                if keys:
                    for key in keys:
                        pipe.delete(key)
            
            pipe.execute()
        
        self._retry_operation(_clear)
    
    def close(self) -> None:
        """Close Redis connection."""
        if self.client:
            self.client.close()
        if self.pool:
            self.pool.disconnect()

