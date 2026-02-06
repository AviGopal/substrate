"""SQLite storage backend for local caching."""

import json
import pickle
import sqlite3
from pathlib import Path
from typing import Dict, List

from cpg_inference.models import CPGComponent
from cpg_inference.storage.base import StorageBackend


class SQLiteStorage(StorageBackend):
    """SQLite-based storage backend.
    
    Supports both in-memory and file-based persistence:
    - In-memory: SQLiteStorage() or SQLiteStorage(":memory:")
    - File-based: SQLiteStorage("/path/to/cache.db")
    
    Features:
    - Zero dependencies (sqlite3 is stdlib)
    - ACID transactions for consistency
    - Efficient batch operations
    - Automatic schema creation
    
    Example:
        ```python
        # In-memory (default, same as current behavior)
        storage = SQLiteStorage()
        
        # Persistent file-based cache
        storage = SQLiteStorage("/path/to/cache.db")
        
        # Use with context manager
        with SQLiteStorage("cache.db") as storage:
            storage.store_component(component)
        ```
    """
    
    def __init__(self, db_path: str | Path | None = None):
        """Initialize SQLite storage.
        
        Args:
            db_path: Path to database file. If None or ":memory:", uses in-memory DB.
        """
        if db_path is None or db_path == ":memory:":
            self.db_path = ":memory:"
            self.is_memory = True
        else:
            self.db_path = str(db_path)
            self.is_memory = False
            # Create parent directory if needed
            if self.db_path != ":memory:":
                Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()
    
    def _init_schema(self):
        """Initialize database schema."""
        cursor = self.conn.cursor()
        
        # Components table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS components (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                data BLOB NOT NULL
            )
        """)
        
        # File mappings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS file_mappings (
                file_path TEXT PRIMARY KEY,
                component_ids TEXT NOT NULL
            )
        """)
        
        # Create indexes for performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_components_file 
            ON components(file_path)
        """)
        
        self.conn.commit()
    
    def store_component(self, component: CPGComponent) -> None:
        """Store a single component."""
        cursor = self.conn.cursor()
        data = pickle.dumps(component)
        
        cursor.execute("""
            INSERT OR REPLACE INTO components (id, file_path, data)
            VALUES (?, ?, ?)
        """, (component.id, component.file_path, data))
        
        self.conn.commit()
    
    def get_component(self, component_id: str) -> CPGComponent | None:
        """Retrieve a component by ID."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT data FROM components WHERE id = ?
        """, (component_id,))
        
        row = cursor.fetchone()
        if row:
            return pickle.loads(row['data'])
        return None
    
    def batch_store_components(self, components: List[CPGComponent]) -> None:
        """Store multiple components efficiently."""
        if not components:
            return
        
        cursor = self.conn.cursor()
        data_batch = [
            (comp.id, comp.file_path, pickle.dumps(comp))
            for comp in components
        ]
        
        cursor.executemany("""
            INSERT OR REPLACE INTO components (id, file_path, data)
            VALUES (?, ?, ?)
        """, data_batch)
        
        self.conn.commit()
    
    def batch_get_components(self, component_ids: List[str]) -> Dict[str, CPGComponent]:
        """Retrieve multiple components efficiently."""
        if not component_ids:
            return {}
        
        cursor = self.conn.cursor()
        placeholders = ','.join('?' * len(component_ids))
        cursor.execute(f"""
            SELECT id, data FROM components WHERE id IN ({placeholders})
        """, component_ids)
        
        result = {}
        for row in cursor.fetchall():
            component = pickle.loads(row['data'])
            result[row['id']] = component
        
        return result
    
    def delete_component(self, component_id: str) -> None:
        """Delete a component."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM components WHERE id = ?", (component_id,))
        self.conn.commit()
    
    def get_file_components(self, file_path: str) -> List[str]:
        """Get component IDs for a file."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT component_ids FROM file_mappings WHERE file_path = ?
        """, (file_path,))
        
        row = cursor.fetchone()
        if row:
            return json.loads(row['component_ids'])
        return []
    
    def set_file_components(self, file_path: str, component_ids: List[str]) -> None:
        """Set component IDs for a file."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO file_mappings (file_path, component_ids)
            VALUES (?, ?)
        """, (file_path, json.dumps(component_ids)))
        
        self.conn.commit()
    
    def delete_file(self, file_path: str) -> None:
        """Delete file mapping and its components."""
        cursor = self.conn.cursor()
        
        # Get component IDs first
        component_ids = self.get_file_components(file_path)
        
        # Delete components
        if component_ids:
            placeholders = ','.join('?' * len(component_ids))
            cursor.execute(f"""
                DELETE FROM components WHERE id IN ({placeholders})
            """, component_ids)
        
        # Delete file mapping
        cursor.execute("""
            DELETE FROM file_mappings WHERE file_path = ?
        """, (file_path,))
        
        self.conn.commit()
    
    def get_all_files(self) -> List[str]:
        """Get all tracked file paths."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT file_path FROM file_mappings")
        return [row['file_path'] for row in cursor.fetchall()]
    
    def get_stats(self) -> Dict[str, int]:
        """Get storage statistics."""
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT COUNT(*) as count FROM components")
        num_components = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM file_mappings")
        num_files = cursor.fetchone()['count']
        
        return {
            "num_components": num_components,
            "num_files": num_files,
            "is_memory": self.is_memory,
        }
    
    def clear(self) -> None:
        """Clear all stored data."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM components")
        cursor.execute("DELETE FROM file_mappings")
        self.conn.commit()
    
    def close(self) -> None:
        """Close database connection."""
        if self.conn:
            self.conn.close()
    
    def __del__(self):
        """Ensure connection is closed on deletion."""
        self.close()

