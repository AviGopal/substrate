"""Integration tests for storage backends with CoChangePredictor."""

import tempfile
from pathlib import Path

import pytest

from cpg_inference.models import InferenceConfig
from cpg_inference.service import CoChangePredictor
from cpg_inference.storage import SQLiteStorage


@pytest.fixture
def model_path():
    """Get path to bundled model."""
    import cpg_inference
    pkg_dir = Path(cpg_inference.__file__).parent
    model_path = pkg_dir / "bundled_models" / "auc_0.9999_gcn_bce_all_h64_l2_d1_b128_fp32.onnx"
    return str(model_path)


@pytest.fixture
def sample_files():
    """Sample Python files for testing."""
    return {
        "test1.py": """
def hello():
    return "world"

def process_data(data):
    return data.upper()
""",
        "test2.py": """
class TestClass:
    def __init__(self):
        self.value = 0
    
    def increment(self):
        self.value += 1
"""
    }


def test_default_storage(model_path, sample_files):
    """Test that default behavior uses in-memory storage."""
    config = InferenceConfig(model_path=model_path)
    predictor = CoChangePredictor(config)
    
    # Verify default storage is SQLite in-memory
    assert isinstance(predictor.storage, SQLiteStorage)
    assert predictor.storage.is_memory
    
    # Verify it works
    stats = predictor.update_index(sample_files)
    assert stats["files_processed"] == 2
    assert stats["components_added"] > 0


def test_explicit_memory_storage(model_path, sample_files):
    """Test explicit in-memory storage."""
    storage = SQLiteStorage(":memory:")
    config = InferenceConfig(model_path=model_path)
    predictor = CoChangePredictor(config, storage_backend=storage)
    
    stats = predictor.update_index(sample_files)
    assert stats["files_processed"] == 2
    
    # Verify components are stored
    predictor_stats = predictor.get_stats()
    assert predictor_stats["num_components"] > 0


def test_file_based_storage(model_path, sample_files):
    """Test file-based persistent storage."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    
    try:
        # First session - create and populate
        storage1 = SQLiteStorage(db_path)
        config = InferenceConfig(model_path=model_path)
        predictor1 = CoChangePredictor(config, storage_backend=storage1)
        
        stats = predictor1.update_index(sample_files)
        assert stats["components_added"] > 0
        
        # Get stats before closing
        predictor1_stats = predictor1.get_stats()
        num_components = predictor1_stats["num_components"]
        
        storage1.close()
        
        # Second session - verify persistence
        storage2 = SQLiteStorage(db_path)
        config2 = InferenceConfig(model_path=model_path)
        predictor2 = CoChangePredictor(config2, storage_backend=storage2)
        
        # Components should be available
        predictor2_stats = predictor2.get_stats()
        assert predictor2_stats["num_cached_components"] == num_components
        
        storage2.close()
    finally:
        Path(db_path).unlink(missing_ok=True)


def test_incremental_updates(model_path, sample_files):
    """Test incremental updates with storage."""
    storage = SQLiteStorage()
    config = InferenceConfig(model_path=model_path)
    predictor = CoChangePredictor(config, storage_backend=storage)
    
    # Initial indexing
    stats1 = predictor.update_index(sample_files)
    initial_components = stats1["components_added"]
    
    # Add new file
    new_files = {
        **sample_files,
        "test3.py": """
def new_function():
    pass
"""
    }
    
    stats2 = predictor.update_index(new_files)
    # Should only add components from new file
    assert stats2["components_added"] > 0
    assert stats2["components_updated"] >= initial_components


def test_file_removal(model_path, sample_files):
    """Test file removal with storage."""
    storage = SQLiteStorage()
    config = InferenceConfig(model_path=model_path)
    predictor = CoChangePredictor(config, storage_backend=storage)
    
    # Index files
    predictor.update_index(sample_files)
    initial_stats = predictor.get_stats()
    initial_components = initial_stats["num_components"]
    
    # Remove one file
    removed = predictor.remove_files(["test1.py"])
    assert removed > 0
    
    # Verify components were removed
    final_stats = predictor.get_stats()
    assert final_stats["num_components"] < initial_components


def test_cochange_prediction_with_storage(model_path, sample_files):
    """Test co-change prediction works with storage backend."""
    storage = SQLiteStorage()
    config = InferenceConfig(model_path=model_path, top_k=5)
    predictor = CoChangePredictor(config, storage_backend=storage)
    
    # Index files
    predictor.update_index(sample_files)
    
    # Predict co-changes
    predictions = predictor.predict_cochanges(
        changed_files=["test1.py"],
        files=sample_files,
        top_k=5
    )
    
    # Should get predictions from other files
    assert isinstance(predictions, list)
    # Predictions may be empty if similarity is low, which is okay


def test_backward_compatibility(model_path, sample_files):
    """Test that old code without storage_backend still works."""
    # This is how users currently use the library
    config = InferenceConfig(model_path=model_path)
    predictor = CoChangePredictor(config)  # No storage_backend param
    
    # Should work exactly as before
    stats = predictor.update_index(sample_files)
    assert stats["files_processed"] == 2
    
    predictions = predictor.predict_cochanges(
        changed_files=["test1.py"],
        files=sample_files
    )
    assert isinstance(predictions, list)

