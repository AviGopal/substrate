"""Abstract base class for storage backends."""

from abc import ABC, abstractmethod
from typing import Dict, List

from cpg_inference.models import CPGComponent


class StorageBackend(ABC):
    """Abstract interface for persistent storage of CPG components.
    
    Storage backends enable persistent caching of components and file mappings,
    providing significant performance improvements for incremental updates
    (10-50x faster than full reprocessing).
    """
    
    # ==================== Component Operations ====================
    
    @abstractmethod
    def store_component(self, component: CPGComponent) -> None:
        """Store a single component.
        
        Args:
            component: CPG component to store
        """
        pass
    
    @abstractmethod
    def get_component(self, component_id: str) -> CPGComponent | None:
        """Retrieve a component by ID.
        
        Args:
            component_id: Unique component identifier
            
        Returns:
            Component if found, None otherwise
        """
        pass
    
    @abstractmethod
    def batch_store_components(self, components: List[CPGComponent]) -> None:
        """Store multiple components efficiently.
        
        Implementations should use transactions/batching for performance.
        
        Args:
            components: List of components to store
        """
        pass
    
    @abstractmethod
    def batch_get_components(self, component_ids: List[str]) -> Dict[str, CPGComponent]:
        """Retrieve multiple components efficiently.
        
        Args:
            component_ids: List of component IDs
            
        Returns:
            Dictionary mapping component_id -> component (only for found components)
        """
        pass
    
    @abstractmethod
    def delete_component(self, component_id: str) -> None:
        """Delete a component.
        
        Args:
            component_id: ID of component to delete
        """
        pass
    
    # ==================== File Mapping Operations ====================
    
    @abstractmethod
    def get_file_components(self, file_path: str) -> List[str]:
        """Get component IDs for a file.
        
        Args:
            file_path: Path to file
            
        Returns:
            List of component IDs in this file
        """
        pass
    
    @abstractmethod
    def set_file_components(self, file_path: str, component_ids: List[str]) -> None:
        """Set component IDs for a file.
        
        Args:
            file_path: Path to file
            component_ids: List of component IDs in this file
        """
        pass
    
    @abstractmethod
    def delete_file(self, file_path: str) -> None:
        """Delete file mapping and optionally its components.
        
        Args:
            file_path: Path to file
        """
        pass
    
    @abstractmethod
    def get_all_files(self) -> List[str]:
        """Get all tracked file paths.
        
        Returns:
            List of file paths
        """
        pass
    
    # ==================== Utility Operations ====================
    
    @abstractmethod
    def get_stats(self) -> Dict[str, int]:
        """Get storage statistics.
        
        Returns:
            Dictionary with statistics like:
            - num_components: Total components stored
            - num_files: Total files tracked
        """
        pass
    
    @abstractmethod
    def clear(self) -> None:
        """Clear all stored data.
        
        Use with caution - this deletes all components and file mappings.
        """
        pass
    
    @abstractmethod
    def close(self) -> None:
        """Close storage connection and release resources.
        
        Should be called when done using the storage backend.
        Can be used as a context manager.
        """
        pass
    
    # Context manager support
    def __enter__(self):
        """Enter context manager."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context manager."""
        self.close()
        return False

