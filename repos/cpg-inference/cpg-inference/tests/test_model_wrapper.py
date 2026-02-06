"""Tests for ONNX model wrapper."""

import numpy as np
import pytest

from cpg_inference.model_wrapper import ONNXModelWrapper


@pytest.fixture
def model_path():
    """Get path to trained ONNX model."""
    from cpg_inference.bundled_models import get_model_path
    
    try:
        return get_model_path("default")
    except (ValueError, FileNotFoundError) as e:
        pytest.skip(f"Bundled model not found: {e}")


def test_model_loading(model_path):
    """Test loading ONNX model."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    assert wrapper.session is not None
    assert len(wrapper.input_names) > 0
    assert len(wrapper.output_names) > 0


def test_infer_single_batch(model_path):
    """Test inference on single batch."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    # Create dummy features (128-bit SimHash)
    num_nodes = 10
    features = np.random.rand(num_nodes, 128).astype(np.float32)
    
    embeddings = wrapper.infer(features)
    
    assert embeddings.shape[0] == num_nodes
    assert embeddings.shape[1] == 32  # embedding_dim
    assert embeddings.dtype == np.float32
    
    # Check embeddings are normalized
    norms = np.linalg.norm(embeddings, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)


def test_infer_empty_input(model_path):
    """Test inference with empty input."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    features = np.zeros((0, 128), dtype=np.float32)
    embeddings = wrapper.infer(features)
    
    assert embeddings.shape[0] == 0
    assert embeddings.shape[1] == 32


def test_infer_single_node(model_path):
    """Test inference with single node."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    features = np.random.rand(1, 128).astype(np.float32)
    embeddings = wrapper.infer(features)
    
    assert embeddings.shape[0] == 1
    assert embeddings.shape[1] == 32


def test_edge_index_generation(model_path):
    """Test edge index generation."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    # Single node - no edges
    edge_index = wrapper._build_edge_index(1)
    assert edge_index.shape == (2, 0)
    
    # Multiple nodes - star graph
    edge_index = wrapper._build_edge_index(5)
    assert edge_index.shape[0] == 2
    assert edge_index.shape[1] > 0
    
    # Check bidirectional edges
    num_edges = edge_index.shape[1]
    assert num_edges % 2 == 0  # Should be even (bidirectional)


def test_embedding_normalization(model_path):
    """Test L2 normalization."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    # Create unnormalized embeddings
    embeddings = np.random.rand(10, 32).astype(np.float32) * 10
    
    normalized = wrapper._normalize_embeddings(embeddings)
    
    # Check all vectors have unit norm
    norms = np.linalg.norm(normalized, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)


def test_infer_batch_multiple(model_path):
    """Test batch inference with multiple feature matrices."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    # Create multiple feature matrices
    features_list = [
        np.random.rand(5, 128).astype(np.float32),
        np.random.rand(3, 128).astype(np.float32),
        np.random.rand(7, 128).astype(np.float32),
    ]
    
    embeddings = wrapper.infer_batch(features_list, batch_size=2)
    
    total_nodes = sum(f.shape[0] for f in features_list)
    assert embeddings.shape[0] == total_nodes
    assert embeddings.shape[1] == 32


def test_infer_consistency(model_path):
    """Test that same input produces same output."""
    wrapper = ONNXModelWrapper(model_path, embedding_dim=32)
    
    features = np.random.rand(5, 128).astype(np.float32)
    
    embeddings1 = wrapper.infer(features)
    embeddings2 = wrapper.infer(features)
    
    # Should be identical
    assert np.allclose(embeddings1, embeddings2, atol=1e-6)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

