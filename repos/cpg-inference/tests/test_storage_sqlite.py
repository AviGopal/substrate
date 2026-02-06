"""Tests for SQLite storage backend."""

import tempfile
from pathlib import Path

import pytest

from cpg_inference.models import CPGComponent
from cpg_inference.cpg.models import NodeType
from cpg_inference.storage.sqlite_backend import SQLiteStorage


@pytest.fixture
def temp_db():
    """Create temporary database file."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    yield db_path
    # Cleanup
    Path(db_path).unlink(missing_ok=True)


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


def test_sqlite_in_memory():
    """Test in-memory SQLite storage."""
    storage = SQLiteStorage()
    assert storage.is_memory
    assert storage.db_path == ":memory:"


def test_sqlite_file_based(temp_db):
    """Test file-based SQLite storage."""
    storage = SQLiteStorage(temp_db)
    assert not storage.is_memory
    assert str(storage.db_path) == temp_db
    assert Path(temp_db).exists()


def test_store_and_get_component(sample_component):
    """Test storing and retrieving a component."""
    storage = SQLiteStorage()
    
    # Store component
    storage.store_component(sample_component)
    
    # Retrieve component
    retrieved = storage.get_component(sample_component.id)
    
    assert retrieved is not None
    assert retrieved.id == sample_component.id
    assert retrieved.name == sample_component.name
    assert retrieved.file_path == sample_component.file_path


def test_get_nonexistent_component():
    """Test retrieving non-existent component returns None."""
    storage = SQLiteStorage()
    
    component = storage.get_component("nonexistent")
    assert component is None


def test_batch_store_and_get():
    """Test batch operations."""
    storage = SQLiteStorage()
    
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
    storage.batch_store_components(components)
    
    # Batch retrieve
    component_ids = [c.id for c in components]
    retrieved = storage.batch_get_components(component_ids)
    
    assert len(retrieved) == 5
    for comp in components:
        assert comp.id in retrieved
        assert retrieved[comp.id].name == comp.name


def test_delete_component(sample_component):
    """Test deleting a component."""
    storage = SQLiteStorage()
    
    # Store and verify
    storage.store_component(sample_component)
    assert storage.get_component(sample_component.id) is not None
    
    # Delete
    storage.delete_component(sample_component.id)
    
    # Verify deletion
    assert storage.get_component(sample_component.id) is None


def test_file_components_mapping():
    """Test file-to-components mapping."""
    storage = SQLiteStorage()
    
    file_path = "test.py"
    component_ids = ["id1", "id2", "id3"]
    
    # Set mapping
    storage.set_file_components(file_path, component_ids)
    
    # Get mapping
    retrieved_ids = storage.get_file_components(file_path)
    assert retrieved_ids == component_ids


def test_get_nonexistent_file_components():
    """Test retrieving components for non-existent file."""
    storage = SQLiteStorage()
    
    components = storage.get_file_components("nonexistent.py")
    assert components == []


def test_delete_file():
    """Test deleting file and its components."""
    storage = SQLiteStorage()
    
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
    storage.batch_store_components(components)
    component_ids = [c.id for c in components]
    storage.set_file_components("test.py", component_ids)
    
    # Verify components exist
    assert storage.get_component(component_ids[0]) is not None
    
    # Delete file
    storage.delete_file("test.py")
    
    # Verify file mapping is gone
    assert storage.get_file_components("test.py") == []
    
    # Verify components are gone
    assert storage.get_component(component_ids[0]) is None


def test_get_all_files():
    """Test getting all tracked files."""
    storage = SQLiteStorage()
    
    # Add file mappings
    storage.set_file_components("file1.py", ["id1", "id2"])
    storage.set_file_components("file2.py", ["id3"])
    
    files = storage.get_all_files()
    assert set(files) == {"file1.py", "file2.py"}


def test_get_stats(sample_component):
    """Test getting storage statistics."""
    storage = SQLiteStorage()
    
    # Initial stats
    stats = storage.get_stats()
    assert stats["num_components"] == 0
    assert stats["num_files"] == 0
    assert stats["is_memory"]
    
    # Add components and files
    storage.store_component(sample_component)
    storage.set_file_components("test.py", [sample_component.id])
    
    # Check updated stats
    stats = storage.get_stats()
    assert stats["num_components"] == 1
    assert stats["num_files"] == 1


def test_clear():
    """Test clearing all data."""
    storage = SQLiteStorage()
    
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
    storage.store_component(component)
    storage.set_file_components("test.py", [component.id])
    
    # Verify data exists
    assert storage.get_stats()["num_components"] == 1
    
    # Clear
    storage.clear()
    
    # Verify empty
    stats = storage.get_stats()
    assert stats["num_components"] == 0
    assert stats["num_files"] == 0


def test_persistence(temp_db):
    """Test data persists across connections."""
    # First connection - write data
    storage1 = SQLiteStorage(temp_db)
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
    storage1.store_component(component)
    storage1.set_file_components("test.py", [component.id])
    storage1.close()
    
    # Second connection - read data
    storage2 = SQLiteStorage(temp_db)
    retrieved = storage2.get_component(component.id)
    assert retrieved is not None
    assert retrieved.name == "func"
    
    file_components = storage2.get_file_components("test.py")
    assert file_components == [component.id]
    storage2.close()


def test_context_manager():
    """Test using storage as context manager."""
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
    
    with SQLiteStorage() as storage:
        storage.store_component(component)
        retrieved = storage.get_component(component.id)
        assert retrieved is not None


def test_update_component(sample_component):
    """Test updating an existing component."""
    storage = SQLiteStorage()
    
    # Store original
    storage.store_component(sample_component)
    
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
    storage.store_component(modified)
    
    # Verify update
    retrieved = storage.get_component(sample_component.id)
    assert retrieved.name == "modified_func"

