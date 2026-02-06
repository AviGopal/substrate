"""FAISS index manager for efficient similarity search and updates."""

import json
import pickle
from pathlib import Path

import faiss
import numpy as np


class FAISSIndexManager:
    """Manage FAISS index with ID-based updates."""
    
    def __init__(self, embedding_dim: int, index_path: Path | str | None = None):
        """Initialize index manager.
        
        Args:
            embedding_dim: Dimension of embeddings
            index_path: Path to load/save index (optional)
        """
        self.embedding_dim = embedding_dim
        self.index_path = Path(index_path) if index_path else None
        
        # Create FAISS index (inner product for cosine similarity)
        base_index = faiss.IndexFlatIP(embedding_dim)
        self.index = faiss.IndexIDMap(base_index)
        
        # Maintain mappings
        self.component_id_to_faiss_id: dict[str, int] = {}
        self.faiss_id_to_component_id: dict[int, str] = {}
        self.next_faiss_id = 0
        
        # Load existing index if provided
        if self.index_path and self.index_path.exists():
            self.load()
    
    def add(self, component_ids: list[str], embeddings: np.ndarray) -> None:
        """Add new components to index.
        
        Args:
            component_ids: List of component IDs
            embeddings: Embedding matrix [num_components, embedding_dim]
        """
        if len(component_ids) != embeddings.shape[0]:
            raise ValueError("Number of IDs must match number of embeddings")
        
        if embeddings.shape[0] == 0:
            return
        
        # Assign FAISS IDs
        faiss_ids = []
        for component_id in component_ids:
            if component_id in self.component_id_to_faiss_id:
                # Component already exists, skip
                continue
            
            faiss_id = self.next_faiss_id
            self.next_faiss_id += 1
            
            self.component_id_to_faiss_id[component_id] = faiss_id
            self.faiss_id_to_component_id[faiss_id] = component_id
            faiss_ids.append(faiss_id)
        
        if not faiss_ids:
            return
        
        # Add to FAISS index
        faiss_ids_array = np.array(faiss_ids, dtype=np.int64)
        
        # Filter embeddings to only include new components
        new_indices = [i for i, cid in enumerate(component_ids) if cid not in self.component_id_to_faiss_id or self.component_id_to_faiss_id[cid] in faiss_ids]
        new_embeddings = embeddings[new_indices]
        
        if new_embeddings.shape[0] > 0:
            self.index.add_with_ids(new_embeddings, faiss_ids_array)
    
    def update(self, component_ids: list[str], embeddings: np.ndarray) -> None:
        """Update existing components in index.
        
        Args:
            component_ids: List of component IDs
            embeddings: Embedding matrix [num_components, embedding_dim]
        """
        if len(component_ids) != embeddings.shape[0]:
            raise ValueError("Number of IDs must match number of embeddings")
        
        if embeddings.shape[0] == 0:
            return
        
        # Remove existing and re-add
        for i, component_id in enumerate(component_ids):
            if component_id in self.component_id_to_faiss_id:
                # Remove old entry
                faiss_id = self.component_id_to_faiss_id[component_id]
                self.index.remove_ids(np.array([faiss_id], dtype=np.int64))
                
                # Add new entry with same FAISS ID
                self.index.add_with_ids(
                    embeddings[i:i+1],
                    np.array([faiss_id], dtype=np.int64)
                )
            else:
                # Component doesn't exist, add it
                faiss_id = self.next_faiss_id
                self.next_faiss_id += 1
                
                self.component_id_to_faiss_id[component_id] = faiss_id
                self.faiss_id_to_component_id[faiss_id] = component_id
                
                self.index.add_with_ids(
                    embeddings[i:i+1],
                    np.array([faiss_id], dtype=np.int64)
                )
    
    def remove(self, component_ids: list[str]) -> None:
        """Remove components from index.
        
        Args:
            component_ids: List of component IDs to remove
        """
        faiss_ids_to_remove = []
        
        for component_id in component_ids:
            if component_id in self.component_id_to_faiss_id:
                faiss_id = self.component_id_to_faiss_id[component_id]
                faiss_ids_to_remove.append(faiss_id)
                
                # Remove from mappings
                del self.component_id_to_faiss_id[component_id]
                del self.faiss_id_to_component_id[faiss_id]
        
        if faiss_ids_to_remove:
            self.index.remove_ids(np.array(faiss_ids_to_remove, dtype=np.int64))
    
    def search(
        self,
        query_embeddings: np.ndarray,
        k: int = 10,
        exclude_ids: set[str] | None = None,
    ) -> tuple[list[list[str]], list[list[float]]]:
        """Search for similar components.
        
        Args:
            query_embeddings: Query embedding matrix [num_queries, embedding_dim]
            k: Number of results per query
            exclude_ids: Component IDs to exclude from results
            
        Returns:
            Tuple of (component_ids, scores)
            - component_ids: List of lists of component IDs
            - scores: List of lists of similarity scores
        """
        if query_embeddings.shape[0] == 0:
            return [], []
        
        if self.index.ntotal == 0:
            # Empty index
            return [[] for _ in range(query_embeddings.shape[0])], [[] for _ in range(query_embeddings.shape[0])]
        
        # Search FAISS index
        k_search = min(k * 2, self.index.ntotal)  # Search more to account for exclusions
        scores, faiss_ids = self.index.search(query_embeddings, k_search)
        
        # Convert FAISS IDs to component IDs
        result_ids = []
        result_scores = []
        
        for i in range(query_embeddings.shape[0]):
            query_ids = []
            query_scores = []
            
            for j in range(k_search):
                faiss_id = int(faiss_ids[i, j])
                score = float(scores[i, j])
                
                # Skip invalid IDs
                if faiss_id < 0:
                    continue
                
                # Get component ID
                component_id = self.faiss_id_to_component_id.get(faiss_id)
                if component_id is None:
                    continue
                
                # Skip excluded IDs
                if exclude_ids and component_id in exclude_ids:
                    continue
                
                query_ids.append(component_id)
                query_scores.append(score)
                
                # Stop when we have enough results
                if len(query_ids) >= k:
                    break
            
            result_ids.append(query_ids)
            result_scores.append(query_scores)
        
        return result_ids, result_scores
    
    def save(self, path: Path | str | None = None) -> None:
        """Save index and metadata to disk.
        
        Args:
            path: Path to save to (uses self.index_path if not provided)
        """
        save_path = Path(path) if path else self.index_path
        if save_path is None:
            raise ValueError("No save path provided")
        
        save_path = Path(save_path)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save FAISS index
        faiss.write_index(self.index, str(save_path))
        
        # Save metadata
        metadata = {
            "embedding_dim": self.embedding_dim,
            "next_faiss_id": self.next_faiss_id,
            "component_id_to_faiss_id": self.component_id_to_faiss_id,
            "faiss_id_to_component_id": {
                str(k): v for k, v in self.faiss_id_to_component_id.items()
            },
        }
        
        metadata_path = save_path.with_suffix('.metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def load(self, path: Path | str | None = None) -> None:
        """Load index and metadata from disk.
        
        Args:
            path: Path to load from (uses self.index_path if not provided)
        """
        load_path = Path(path) if path else self.index_path
        if load_path is None:
            raise ValueError("No load path provided")
        
        load_path = Path(load_path)
        
        if not load_path.exists():
            raise FileNotFoundError(f"Index file not found: {load_path}")
        
        # Load FAISS index
        self.index = faiss.read_index(str(load_path))
        
        # Load metadata
        metadata_path = load_path.with_suffix('.metadata.json')
        if metadata_path.exists():
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            self.embedding_dim = metadata["embedding_dim"]
            self.next_faiss_id = metadata["next_faiss_id"]
            self.component_id_to_faiss_id = metadata["component_id_to_faiss_id"]
            self.faiss_id_to_component_id = {
                int(k): v for k, v in metadata["faiss_id_to_component_id"].items()
            }
    
    def get_size(self) -> int:
        """Get number of components in index.
        
        Returns:
            Number of components
        """
        return self.index.ntotal
    
    def contains(self, component_id: str) -> bool:
        """Check if component is in index.
        
        Args:
            component_id: Component ID
            
        Returns:
            True if component is in index
        """
        return component_id in self.component_id_to_faiss_id

