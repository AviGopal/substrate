"""Integration tests for inference service."""

import tempfile
from pathlib import Path

import pytest

from cpg_inference import CoChangePredictor, InferenceConfig


@pytest.fixture
def model_path():
    """Get path to trained ONNX model."""
    from cpg_inference.bundled_models import get_model_path
    
    try:
        return get_model_path("default")
    except (ValueError, FileNotFoundError) as e:
        pytest.skip(f"Bundled model not found: {e}")


@pytest.fixture
def predictor(model_path):
    """Create predictor instance."""
    with tempfile.TemporaryDirectory() as tmpdir:
        config = InferenceConfig(
            model_path=model_path,
            index_path=Path(tmpdir) / "test_index.faiss",
            simhash_bits=128,
            neighborhood_depth=1,
            edge_filter_mode="all",
            embedding_dim=32,
            top_k=5,
        )
        
        yield CoChangePredictor(config)


def test_predictor_initialization(predictor):
    """Test predictor initialization."""
    assert predictor.config is not None
    assert predictor.extractor is not None
    assert predictor.feature_generator is not None
    assert predictor.model is not None
    assert predictor.index_manager is not None


def test_process_files(predictor):
    """Test processing files without updating index."""
    files = {
        "auth.py": "def login(user): return True",
        "user.py": "class User: pass",
    }
    
    file_components = predictor.process_files(files)
    
    assert "auth.py" in file_components
    assert "user.py" in file_components


def test_update_index(predictor):
    """Test updating index with new files."""
    files = {
        "auth.py": "def login(user): return True",
        "user.py": "class User: pass",
    }
    
    stats = predictor.update_index(files)
    
    assert stats["files_processed"] == 2
    assert stats["components_added"] > 0
    
    # Check index was updated
    index_stats = predictor.get_stats()
    assert index_stats["num_components"] > 0


def test_update_index_twice(predictor):
    """Test updating index with same files (should update, not add)."""
    files = {
        "auth.py": "def login(user): return True",
    }
    
    # First update
    stats1 = predictor.update_index(files)
    components_added = stats1["components_added"]
    
    # Second update (same files)
    stats2 = predictor.update_index(files)
    
    # Should update existing, not add new
    assert stats2["components_updated"] == components_added
    assert stats2["components_added"] == 0


def test_remove_files(predictor):
    """Test removing files from index."""
    files = {
        "auth.py": "def login(user): return True",
        "user.py": "class User: pass",
    }
    
    predictor.update_index(files)
    initial_size = predictor.get_stats()["num_components"]
    
    # Remove one file
    removed = predictor.remove_files(["auth.py"])
    
    assert removed > 0
    
    # Check size decreased
    new_size = predictor.get_stats()["num_components"]
    assert new_size < initial_size


def test_predict_cochanges(predictor):
    """Test co-change prediction."""
    files = {
        "auth.py": """
def login(user):
    return validate_user(user)

def logout(user):
    return True
""",
        "user.py": """
class User:
    def __init__(self, name):
        self.name = name

def validate_user(user):
    return user is not None
""",
        "db.py": """
def connect():
    return None

def query(sql):
    return []
""",
    }
    
    # Update index with all files
    predictor.update_index(files)
    
    # Predict co-changes for auth.py
    predictions = predictor.predict_cochanges(["auth.py"], files, top_k=5)
    
    # Should get some predictions
    assert isinstance(predictions, list)
    
    # Check prediction structure
    for pred in predictions:
        assert hasattr(pred, "component_id")
        assert hasattr(pred, "similarity_score")
        assert hasattr(pred, "file_path")
        # Inner product can be negative for normalized vectors
        assert -1.0 <= pred.similarity_score <= 1.0


def test_predict_cochanges_exclude_same_file(predictor):
    """Test that predictions exclude components from same file."""
    files = {
        "auth.py": """
def login(user): pass
def logout(user): pass
def validate(user): pass
""",
        "user.py": """
class User: pass
def get_user(): pass
""",
    }
    
    predictor.update_index(files)
    
    # Predict for auth.py
    predictions = predictor.predict_cochanges(
        ["auth.py"],
        files,
        top_k=10,
        exclude_same_file=True,
    )
    
    # Should not include components from auth.py
    for pred in predictions:
        assert pred.file_path != "auth.py"


def test_get_component_embeddings(predictor):
    """Test getting embeddings for file components."""
    files = {
        "test.py": """
def foo(): pass
def bar(): pass
class Baz: pass
""",
    }
    
    embeddings = predictor.get_component_embeddings("test.py", files)
    
    # Should have embeddings for components
    assert len(embeddings) > 0
    
    # Check embedding shape
    for component_id, embedding in embeddings.items():
        assert embedding.shape[0] == predictor.config.embedding_dim


def test_save_and_load_index(predictor, model_path):
    """Test saving and loading index."""
    with tempfile.TemporaryDirectory() as tmpdir:
        index_path = Path(tmpdir) / "saved_index.faiss"
        
        # Add some data
        files = {
            "test.py": "def foo(): pass",
        }
        predictor.update_index(files)
        
        # Save index
        predictor.save_index(index_path)
        
        # Create new predictor and load
        config = InferenceConfig(
            model_path=model_path,
            index_path=index_path,
            simhash_bits=128,
            embedding_dim=32,
        )
        
        new_predictor = CoChangePredictor(config)
        
        # Check state was loaded
        assert new_predictor.get_stats()["num_components"] > 0


def test_empty_files(predictor):
    """Test handling empty files."""
    files = {
        "empty.py": "",
    }
    
    stats = predictor.update_index(files)
    
    assert stats["files_processed"] == 1
    assert stats["components_added"] == 0


def test_invalid_syntax(predictor):
    """Test handling files with invalid syntax."""
    files = {
        "invalid.py": "def foo(: invalid",
    }
    
    stats = predictor.update_index(files)
    
    # Should handle gracefully
    assert stats["files_processed"] == 1


def test_get_stats(predictor):
    """Test getting predictor statistics."""
    files = {
        "test1.py": "def foo(): pass",
        "test2.py": "def bar(): pass",
    }
    
    predictor.update_index(files)
    
    stats = predictor.get_stats()
    
    assert "num_files" in stats
    assert "num_components" in stats
    assert "num_cached_components" in stats
    assert stats["num_files"] == 2


def test_workflow_add_update_remove(predictor):
    """Test complete workflow: add, update, remove."""
    # Step 1: Add initial files
    files_v1 = {
        "auth.py": "def login(): pass",
        "user.py": "class User: pass",
    }
    
    stats1 = predictor.update_index(files_v1)
    assert stats1["components_added"] > 0
    
    # Step 2: Update existing file
    files_v2 = {
        "auth.py": "def login(): pass\ndef logout(): pass",
    }
    
    stats2 = predictor.update_index(files_v2)
    assert stats2["components_updated"] > 0 or stats2["components_added"] > 0
    
    # Step 3: Remove file
    removed = predictor.remove_files(["user.py"])
    assert removed > 0
    
    # Step 4: Verify final state
    final_stats = predictor.get_stats()
    assert final_stats["num_files"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

