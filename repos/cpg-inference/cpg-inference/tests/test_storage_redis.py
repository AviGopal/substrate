"""Tests for Redis storage backend (optional - skipped if Redis not available)."""

import os
import tempfile
from pathlib import Path

import pytest

from cpg_inference.models import CPGComponent
from cpg_inference.cpg.models import NodeType

# Try to import Redis
try:
    import redis
    from cpg_inference.storage.redis_backend import RedisStorage
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    RedisStorage = None

# Get Redis URI from environment, default to localhost
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "15"))  # Use DB 15 for tests to avoid conflicts
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

# Skip all tests if Redis is not available
pytestmark = pytest.mark.skipif(
    not REDIS_AVAILABLE,
    reason="Redis not installed. Install with: pip install cpg-inference[redis]"
)


def redis_connection_available():
    """Check if Redis server is actually running and accessible."""
    if not REDIS_AVAILABLE:
        return False
    
    try:
        client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            socket_connect_timeout=1
        )
        client.ping()
        client.close()
        return True
    except (redis.ConnectionError, redis.TimeoutError):
        return False


# Skip tests if Redis server is not running
skip_if_no_redis_server = pytest.mark.skipif(
    not redis_connection_available(),
    reason=f"Redis server not available at {REDIS_HOST}:{REDIS_PORT}"
)


@pytest.fixture
def redis_storage():
    """Create Redis storage instance for testing."""
    storage = RedisStorage(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD
    )
    
    # Clear test data before test
    storage.clear()
    
    yield storage
    
    # Cleanup after test
    try:
        storage.clear()
        storage.close()
    except:
        pass


@pytest.fixture
def sample_component():
    """Create sample CPG component."""
    return CPGComponent(
        id="test.py::function::test_func::10",
        file_path="test.py",
        component_type=NodeType.FUNCTION,
        name="test_func",
        start_line=10,
        end_line=20,
        source_text="def test_func(): pass",
        language="python",
        cpg_node_id="node_1"
    )


@skip_if_no_redis_server
def test_redis_connection(redis_storage):
    """Test Redis connection."""
    assert redis_storage is not None
    stats = redis_storage.get_stats()
    assert "num_components" in stats


@skip_if_no_redis_server
def test_store_and_get_component(redis_storage, sample_component):
    """Test storing and retrieving a component."""
    # Store component
    redis_storage.store_component(sample_component)
    
    # Retrieve component
    retrieved = redis_storage.get_component(sample_component.id)
    
    assert retrieved is not None
    assert retrieved.id == sample_component.id
    assert retrieved.name == sample_component.name
    assert retrieved.file_path == sample_component.file_path


@skip_if_no_redis_server
def test_get_nonexistent_component(redis_storage):
    """Test retrieving non-existent component returns None."""
    component = redis_storage.get_component("nonexistent")
    assert component is None


@skip_if_no_redis_server
def test_batch_store_and_get(redis_storage):
    """Test batch operations."""
    # Create multiple components
    components = [
        CPGComponent(
            id=f"test.py::function::func{i}::10",
            file_path="test.py",
            component_type=NodeType.FUNCTION,
            name=f"func{i}",
            start_line=10 + i * 10,
            end_line=20 + i * 10,
            source_text=f"def func{i}(): pass",
            language="python",
            cpg_node_id=f"node_{i}"
        )
        for i in range(5)
    ]
    
    # Batch store
    redis_storage.batch_store_components(components)
    
    # Batch retrieve
    component_ids = [c.id for c in components]
    retrieved = redis_storage.batch_get_components(component_ids)
    
    assert len(retrieved) == 5
    for comp in components:
        assert comp.id in retrieved
        assert retrieved[comp.id].name == comp.name


@skip_if_no_redis_server
def test_delete_component(redis_storage, sample_component):
    """Test deleting a component."""
    # Store and verify
    redis_storage.store_component(sample_component)
    assert redis_storage.get_component(sample_component.id) is not None
    
    # Delete
    redis_storage.delete_component(sample_component.id)
    
    # Verify deletion
    assert redis_storage.get_component(sample_component.id) is None


@skip_if_no_redis_server
def test_file_components_mapping(redis_storage):
    """Test file-to-components mapping."""
    file_path = "test.py"
    component_ids = ["id1", "id2", "id3"]
    
    # Set mapping
    redis_storage.set_file_components(file_path, component_ids)
    
    # Get mapping
    retrieved_ids = redis_storage.get_file_components(file_path)
    assert retrieved_ids == component_ids


@skip_if_no_redis_server
def test_get_nonexistent_file_components(redis_storage):
    """Test retrieving components for non-existent file."""
    components = redis_storage.get_file_components("nonexistent.py")
    assert components == []


@skip_if_no_redis_server
def test_delete_file(redis_storage):
    """Test deleting file and its components."""
    # Create components
    components = [
        CPGComponent(
            id=f"test.py::function::func{i}::10",
            file_path="test.py",
            component_type=NodeType.FUNCTION,
            name=f"func{i}",
            start_line=10,
            end_line=20,
            source_text=f"def func{i}(): pass",
            language="python",
            cpg_node_id=f"node_{i}"
        )
        for i in range(3)
    ]
    
    # Store components
    redis_storage.batch_store_components(components)
    component_ids = [c.id for c in components]
    redis_storage.set_file_components("test.py", component_ids)
    
    # Verify components exist
    assert redis_storage.get_component(component_ids[0]) is not None
    
    # Delete file
    redis_storage.delete_file("test.py")
    
    # Verify file mapping is gone
    assert redis_storage.get_file_components("test.py") == []
    
    # Verify components are gone
    assert redis_storage.get_component(component_ids[0]) is None


@skip_if_no_redis_server
def test_get_all_files(redis_storage):
    """Test getting all tracked files."""
    # Add file mappings
    redis_storage.set_file_components("file1.py", ["id1", "id2"])
    redis_storage.set_file_components("file2.py", ["id3"])
    
    files = redis_storage.get_all_files()
    assert set(files) == {"file1.py", "file2.py"}


@skip_if_no_redis_server
def test_get_stats(redis_storage, sample_component):
    """Test getting storage statistics."""
    # Initial stats (should be empty after fixture cleanup)
    stats = redis_storage.get_stats()
    assert stats["num_components"] == 0
    assert stats["num_files"] == 0
    assert not stats["is_memory"]
    
    # Add components and files
    redis_storage.store_component(sample_component)
    redis_storage.set_file_components("test.py", [sample_component.id])
    
    # Check updated stats
    stats = redis_storage.get_stats()
    assert stats["num_components"] == 1
    assert stats["num_files"] == 1


@skip_if_no_redis_server
def test_clear(redis_storage):
    """Test clearing all data."""
    # Add data
    component = CPGComponent(
        id="test.py::function::func::10",
        file_path="test.py",
        component_type=NodeType.FUNCTION,
        name="func",
        start_line=10,
        end_line=20,
        source_text="def func(): pass",
        language="python",
        cpg_node_id="node_1"
    )
    redis_storage.store_component(component)
    redis_storage.set_file_components("test.py", [component.id])
    
    # Verify data exists
    assert redis_storage.get_stats()["num_components"] == 1
    
    # Clear
    redis_storage.clear()
    
    # Verify empty
    stats = redis_storage.get_stats()
    assert stats["num_components"] == 0
    assert stats["num_files"] == 0


@skip_if_no_redis_server
def test_ttl_setting():
    """Test that TTL can be set."""
    storage = RedisStorage(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        ttl=3600  # 1 hour
    )
    
    assert storage.ttl == 3600
    
    # Store a component
    component = CPGComponent(
        id="test.py::function::func::10",
        file_path="test.py",
        component_type=NodeType.FUNCTION,
        name="func",
        start_line=10,
        end_line=20,
        source_text="def func(): pass",
        language="python",
        cpg_node_id="node_1"
    )
    
    storage.store_component(component)
    
    # Verify it exists
    retrieved = storage.get_component(component.id)
    assert retrieved is not None
    
    # Check TTL was set
    key = storage._component_key(component.id)
    ttl = storage.client.ttl(key)
    assert ttl > 0  # Should have TTL set
    assert ttl <= 3600
    
    # Cleanup
    storage.clear()
    storage.close()


@skip_if_no_redis_server
def test_context_manager():
    """Test using Redis storage as context manager."""
    component = CPGComponent(
        id="test.py::function::func::10",
        file_path="test.py",
        component_type=NodeType.FUNCTION,
        name="func",
        start_line=10,
        end_line=20,
        source_text="def func(): pass",
        language="python",
        cpg_node_id="node_1"
    )
    
    with RedisStorage(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, password=REDIS_PASSWORD) as storage:
        storage.store_component(component)
        retrieved = storage.get_component(component.id)
        assert retrieved is not None
        storage.clear()


@skip_if_no_redis_server
def test_retry_logic():
    """Test that retry logic is in place (basic check)."""
    storage = RedisStorage(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        max_retries=3,
        retry_delay=0.1
    )
    
    assert storage.max_retries == 3
    assert storage.retry_delay == 0.1
    
    storage.close()


@skip_if_no_redis_server  
def test_update_component(redis_storage, sample_component):
    """Test updating an existing component."""
    # Store original
    redis_storage.store_component(sample_component)
    
    # Modify and store again
    modified = CPGComponent(
        id=sample_component.id,  # Same ID
        file_path=sample_component.file_path,
        component_type=sample_component.component_type,
        name="modified_func",  # Different name
        start_line=sample_component.start_line,
        end_line=sample_component.end_line,
        source_text="def modified_func(): pass",
        language=sample_component.language,
        cpg_node_id=sample_component.cpg_node_id
    )
    redis_storage.store_component(modified)
    
    # Verify update
    retrieved = redis_storage.get_component(sample_component.id)
    assert retrieved.name == "modified_func"


@skip_if_no_redis_server
def test_redis_integration_with_predictor():
    """Test Redis storage with CoChangePredictor."""
    from cpg_inference.models import InferenceConfig
    from cpg_inference.service import CoChangePredictor
    import cpg_inference
    
    # Get model path
    pkg_dir = Path(cpg_inference.__file__).parent
    model_path = pkg_dir / "bundled_models" / "auc_0.9999_gcn_bce_all_h64_l2_d1_b128_fp32.onnx"
    
    # Create Redis storage
    storage = RedisStorage(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD
    )
    
    try:
        # Clear before test
        storage.clear()
        
        # Initialize predictor with Redis
        config = InferenceConfig(model_path=str(model_path))
        predictor = CoChangePredictor(config, storage_backend=storage)
        
        # Index some files
        files = {
            "test1.py": "def hello():\n    return 'world'",
            "test2.py": "def goodbye():\n    return 'bye'"
        }
        
        stats = predictor.update_index(files)
        assert stats["files_processed"] == 2
        
        # Verify components are in Redis
        predictor_stats = predictor.get_stats()
        assert predictor_stats["num_components"] > 0
        
    finally:
        # Cleanup
        storage.clear()
        storage.close()


@skip_if_no_redis_server
def test_redis_multi_repository_isolation(sample_component):
    """Test that different prefixes isolate repositories."""
    # Repo A with prefix "repo_a"
    storage_a = RedisStorage(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        prefix="repo_a"
    )
    storage_a.clear()
    
    # Repo B with prefix "repo_b"
    storage_b = RedisStorage(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        prefix="repo_b"
    )
    storage_b.clear()
    
    try:
        # Store component with same ID in both repos
        component_a = CPGComponent(
            id="test.py::function::func::10",
            file_path="test.py",
            component_type=NodeType.FUNCTION,
            name="func_a",
            start_line=10,
            end_line=20,
            source_text="def func_a(): pass",
            language="python",
            cpg_node_id="node_a"
        )
        storage_a.store_component(component_a)
        storage_a.set_file_components("test.py", [component_a.id])
        
        component_b = CPGComponent(
            id="test.py::function::func::10",  # Same ID!
            file_path="test.py",
            component_type=NodeType.FUNCTION,
            name="func_b",
            start_line=10,
            end_line=20,
            source_text="def func_b(): pass",
            language="python",
            cpg_node_id="node_b"
        )
        storage_b.store_component(component_b)
        storage_b.set_file_components("test.py", [component_b.id])
        
        # Verify isolation - both should exist with different data
        retrieved_a = storage_a.get_component(component_a.id)
        retrieved_b = storage_b.get_component(component_b.id)
        
        assert retrieved_a is not None
        assert retrieved_b is not None
        assert retrieved_a.name == "func_a"
        assert retrieved_b.name == "func_b"
        
        # Verify stats are isolated
        stats_a = storage_a.get_stats()
        stats_b = storage_b.get_stats()
        assert stats_a["num_components"] == 1
        assert stats_b["num_components"] == 1
        assert stats_a["num_files"] == 1
        assert stats_b["num_files"] == 1
        
        # Verify file listings are isolated
        files_a = storage_a.get_all_files()
        files_b = storage_b.get_all_files()
        assert files_a == ["test.py"]
        assert files_b == ["test.py"]
        
        # Clear repo A - should not affect repo B
        storage_a.clear()
        
        assert storage_a.get_component(component_a.id) is None
        assert storage_b.get_component(component_b.id) is not None
        
        stats_a = storage_a.get_stats()
        stats_b = storage_b.get_stats()
        assert stats_a["num_components"] == 0
        assert stats_b["num_components"] == 1
        
    finally:
        # Cleanup both storages
        try:
            storage_a.clear()
            storage_a.close()
        except:
            pass
        try:
            storage_b.clear()
            storage_b.close()
        except:
            pass

