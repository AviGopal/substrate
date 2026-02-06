"""Tests for FAISS index manager."""

import tempfile
from pathlib import Path

import numpy as np
import pytest

from cpg_inference.index_manager import FAISSIndexManager


def test_index_initialization():
    """Test index initialization."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    assert manager.embedding_dim == 32
    assert manager.get_size() == 0
    assert manager.next_faiss_id == 0


def test_add_components():
    """Test adding components to index."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    component_ids = ["comp1", "comp2", "comp3"]
    embeddings = np.random.rand(3, 32).astype(np.float32)
    
    manager.add(component_ids, embeddings)
    
    assert manager.get_size() == 3
    assert manager.contains("comp1")
    assert manager.contains("comp2")
    assert manager.contains("comp3")


def test_update_components():
    """Test updating existing components."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    # Add initial components
    component_ids = ["comp1", "comp2"]
    embeddings1 = np.random.rand(2, 32).astype(np.float32)
    manager.add(component_ids, embeddings1)
    
    # Update with new embeddings
    embeddings2 = np.random.rand(2, 32).astype(np.float32)
    manager.update(component_ids, embeddings2)
    
    # Size should remain the same
    assert manager.get_size() == 2


def test_remove_components():
    """Test removing components from index."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    component_ids = ["comp1", "comp2", "comp3"]
    embeddings = np.random.rand(3, 32).astype(np.float32)
    manager.add(component_ids, embeddings)
    
    # Remove one component
    manager.remove(["comp2"])
    
    assert manager.get_size() == 2
    assert manager.contains("comp1")
    assert not manager.contains("comp2")
    assert manager.contains("comp3")


def test_search_basic():
    """Test basic similarity search."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    # Add components
    component_ids = ["comp1", "comp2", "comp3"]
    embeddings = np.random.rand(3, 32).astype(np.float32)
    
    # Normalize embeddings for cosine similarity
    embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
    
    manager.add(component_ids, embeddings)
    
    # Search with first embedding
    query = embeddings[0:1]
    result_ids, result_scores = manager.search(query, k=2)
    
    assert len(result_ids) == 1
    assert len(result_ids[0]) <= 2
    assert len(result_scores[0]) <= 2


def test_search_with_exclusions():
    """Test search with excluded IDs."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    component_ids = ["comp1", "comp2", "comp3", "comp4"]
    embeddings = np.random.rand(4, 32).astype(np.float32)
    embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
    
    manager.add(component_ids, embeddings)
    
    # Search excluding comp2 and comp3
    query = embeddings[0:1]
    result_ids, result_scores = manager.search(
        query,
        k=3,
        exclude_ids={"comp2", "comp3"},
    )
    
    # Should not contain excluded IDs
    for ids in result_ids:
        assert "comp2" not in ids
        assert "comp3" not in ids


def test_search_empty_index():
    """Test search on empty index."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    query = np.random.rand(1, 32).astype(np.float32)
    result_ids, result_scores = manager.search(query, k=5)
    
    assert len(result_ids) == 1
    assert len(result_ids[0]) == 0


def test_save_and_load():
    """Test saving and loading index."""
    with tempfile.TemporaryDirectory() as tmpdir:
        index_path = Path(tmpdir) / "test_index.faiss"
        
        # Create and populate index
        manager1 = FAISSIndexManager(embedding_dim=32, index_path=index_path)
        
        component_ids = ["comp1", "comp2", "comp3"]
        embeddings = np.random.rand(3, 32).astype(np.float32)
        manager1.add(component_ids, embeddings)
        
        # Save
        manager1.save()
        
        # Load in new manager
        manager2 = FAISSIndexManager(embedding_dim=32, index_path=index_path)
        
        # Check state is preserved
        assert manager2.get_size() == 3
        assert manager2.contains("comp1")
        assert manager2.contains("comp2")
        assert manager2.contains("comp3")
        assert manager2.next_faiss_id == manager1.next_faiss_id


def test_update_nonexistent_component():
    """Test updating component that doesn't exist (should add it)."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    # Update non-existent component
    component_ids = ["new_comp"]
    embeddings = np.random.rand(1, 32).astype(np.float32)
    manager.update(component_ids, embeddings)
    
    # Should be added
    assert manager.get_size() == 1
    assert manager.contains("new_comp")


def test_remove_nonexistent_component():
    """Test removing component that doesn't exist."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    # Add one component
    manager.add(["comp1"], np.random.rand(1, 32).astype(np.float32))
    
    # Try to remove non-existent component
    manager.remove(["nonexistent"])
    
    # Should not affect existing component
    assert manager.get_size() == 1
    assert manager.contains("comp1")


def test_multiple_queries():
    """Test searching with multiple queries."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    # Add components
    component_ids = ["comp1", "comp2", "comp3", "comp4", "comp5"]
    embeddings = np.random.rand(5, 32).astype(np.float32)
    embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
    
    manager.add(component_ids, embeddings)
    
    # Search with multiple queries
    queries = embeddings[:2]  # Use first 2 as queries
    result_ids, result_scores = manager.search(queries, k=3)
    
    assert len(result_ids) == 2
    assert len(result_scores) == 2


def test_add_empty_list():
    """Test adding empty list of components."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    manager.add([], np.zeros((0, 32), dtype=np.float32))
    
    assert manager.get_size() == 0


def test_id_mapping_consistency():
    """Test that ID mappings remain consistent."""
    manager = FAISSIndexManager(embedding_dim=32)
    
    component_ids = ["comp1", "comp2", "comp3"]
    embeddings = np.random.rand(3, 32).astype(np.float32)
    
    manager.add(component_ids, embeddings)
    
    # Check bidirectional mapping
    for comp_id in component_ids:
        faiss_id = manager.component_id_to_faiss_id[comp_id]
        assert manager.faiss_id_to_component_id[faiss_id] == comp_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

