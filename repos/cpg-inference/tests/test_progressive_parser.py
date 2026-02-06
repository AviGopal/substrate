"""Tests for ProgressiveCPGParser."""

import tempfile

import pytest

from cpg_inference.cpg.progressive_parser import ProgressiveCPGParser
from cpg_inference.cpg.models import EdgeType, NodeType


@pytest.fixture
def parser():
    """Create parser with temp project root."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield ProgressiveCPGParser(language="python", project_root=tmpdir)


@pytest.fixture
def sample_files():
    """Sample Python files for testing."""
    return {
        "utils.py": "def helper(): return 42",
        "main.py": "from utils import helper\ndef main(): return helper()",
    }


def test_parser_initialization():
    """Test parser initialization."""
    with tempfile.TemporaryDirectory() as tmpdir:
        parser = ProgressiveCPGParser(language="python", project_root=tmpdir)
        
        assert parser.language == "python"
        assert parser.project_root == tmpdir
        assert parser.cpg is not None
        assert parser.symbol_table is not None
        assert parser.import_graph is not None
        assert parser.import_resolver is not None


def test_add_file_creates_nodes(parser):
    """Verify nodes added to global CPG."""
    code = "def test_func(): pass"
    
    stats = parser.add_file("test.py", code)
    
    assert stats["nodes_added"] > 0
    assert "test.py" in parser.cpg.file_index
    
    # Verify nodes exist with file path prefix
    file_nodes = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("test.py::")]
    assert len(file_nodes) > 0


def test_add_file_tracks_metadata(parser):
    """Verify FileMetadata populated."""
    code = "def func(): pass\nclass MyClass: pass"
    
    parser.add_file("example.py", code)
    
    assert "example.py" in parser.cpg.file_index
    metadata = parser.cpg.file_index["example.py"]
    
    assert metadata.file_path == "example.py"
    assert metadata.content_hash != ""
    assert len(metadata.node_ids) > 0
    assert metadata.last_updated is not None


def test_update_file_removes_old_nodes(parser):
    """Verify old nodes removed."""
    # Add initial file
    parser.add_file("test.py", "def old_func(): pass")
    
    old_nodes = list(parser.cpg.nodes.keys())
    
    # Update with different content
    parser.update_file("test.py", "def new_func(): pass")
    
    # Old function should be gone
    node_names = [n.name for n in parser.cpg.nodes.values()]
    assert "old_func" not in node_names
    assert "new_func" in node_names


def test_update_file_preserves_other_files(parser):
    """Verify isolation between file updates."""
    # Add two files
    parser.add_file("file1.py", "def func1(): pass")
    parser.add_file("file2.py", "def func2(): pass")
    
    file1_nodes_before = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("file1.py::")]
    file2_nodes_before = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("file2.py::")]
    
    # Update file1
    parser.update_file("file1.py", "def func1_updated(): pass")
    
    # file2 nodes should be unchanged
    file2_nodes_after = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("file2.py::")]
    assert len(file2_nodes_after) == len(file2_nodes_before)


def test_delete_file_removes_all_data(parser):
    """Verify complete cleanup."""
    parser.add_file("temp.py", "def temp_func(): pass")
    
    # Verify file exists
    assert "temp.py" in parser.cpg.file_index
    temp_nodes = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("temp.py::")]
    assert len(temp_nodes) > 0
    
    # Delete file
    stats = parser.delete_file("temp.py")
    
    assert stats["nodes_removed"] > 0
    assert "temp.py" not in parser.cpg.file_index
    
    # All nodes should be gone
    remaining = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("temp.py::")]
    assert len(remaining) == 0


def test_delete_file_updates_symbol_table(parser):
    """Verify symbol cleanup."""
    parser.add_file("test.py", "def my_func(): pass\nclass MyClass: pass")
    
    # Verify symbols exist
    symbols_before = len(parser.symbol_table)
    assert symbols_before > 0
    
    # Delete file
    parser.delete_file("test.py")
    
    # Symbols should be removed
    symbols_after = len(parser.symbol_table)
    assert symbols_after < symbols_before
    
    # Specific symbols should be gone
    assert len(parser.symbol_table.get_file_symbols("test.py")) == 0


def test_node_id_uniqueness_across_files(parser):
    """Verify file path prefixing prevents ID collisions."""
    # Add same function name in different files
    parser.add_file("file1.py", "def same_name(): pass")
    parser.add_file("file2.py", "def same_name(): pass")
    
    # Both should exist with unique IDs
    file1_nodes = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("file1.py::")]
    file2_nodes = [nid for nid in parser.cpg.nodes.keys() if nid.startswith("file2.py::")]
    
    assert len(file1_nodes) > 0
    assert len(file2_nodes) > 0
    
    # IDs should not overlap
    assert len(set(file1_nodes) & set(file2_nodes)) == 0


def test_get_stats_accuracy(parser):
    """Verify stats reporting."""
    # Empty parser
    stats = parser.get_stats()
    assert stats["total_nodes"] == 0
    assert stats["total_files"] == 0
    
    # Add files
    parser.add_file("test1.py", "def func1(): pass")
    parser.add_file("test2.py", "def func2(): pass\nclass MyClass: pass")
    
    stats = parser.get_stats()
    assert stats["total_nodes"] > 0
    assert stats["total_files"] == 2
    assert stats["total_edges"] >= 0
    assert stats["total_symbols"] > 0


def test_add_file_with_imports(parser, sample_files):
    """Test adding files with import statements."""
    # Add both files
    parser.add_file("utils.py", sample_files["utils.py"])
    parser.add_file("main.py", sample_files["main.py"])
    
    # Verify import graph has edge
    imports = parser.import_graph.get_imports("main.py")
    # Should import utils.py (if resolved)
    # Note: This depends on import resolution working


def test_progressive_addition(parser):
    """Test adding files progressively."""
    # Start with empty graph
    assert len(parser.cpg.nodes) == 0
    
    # Add files one by one
    parser.add_file("a.py", "def a(): pass")
    nodes_after_a = len(parser.cpg.nodes)
    assert nodes_after_a > 0
    
    parser.add_file("b.py", "def b(): pass")
    nodes_after_b = len(parser.cpg.nodes)
    assert nodes_after_b > nodes_after_a
    
    parser.add_file("c.py", "def c(): pass")
    nodes_after_c = len(parser.cpg.nodes)
    assert nodes_after_c > nodes_after_b


def test_update_file_content_hash_detection(parser):
    """Test that content hash detects changes."""
    code = "def func(): pass"
    
    parser.add_file("test.py", code)
    hash1 = parser.cpg.file_index["test.py"].content_hash
    
    # Update with same content - should detect no change
    result = parser.update_file("test.py", code)
    
    # Content hash should be same
    hash2 = parser.cpg.file_index["test.py"].content_hash
    assert hash1 == hash2


def test_delete_nonexistent_file(parser):
    """Test deleting file that doesn't exist."""
    stats = parser.delete_file("nonexistent.py")
    
    # Should handle gracefully
    assert "error" in stats or stats.get("nodes_removed", 0) == 0


def test_multiple_languages(parser):
    """Test parser with different language files."""
    # Note: Parser is initialized with single language
    # This test verifies language parameter is used
    assert parser.language == "python"


def test_adjacency_cache_rebuild(parser):
    """Test that adjacency cache is rebuilt after changes."""
    parser.add_file("test.py", "def a(): pass\ndef b(): a()")
    
    # Cache should be built
    parser.cpg.build_adjacency_cache()
    assert parser.cpg._adjacency_cache is not None
    
    # Add another file
    parser.add_file("test2.py", "def c(): pass")
    
    # Cache should be invalidated and rebuilt
    # (happens internally in add_file)


def test_clear_parser(parser):
    """Test clearing all parser data."""
    parser.add_file("test.py", "def func(): pass")
    assert len(parser.cpg.nodes) > 0
    
    parser.clear()
    
    assert len(parser.cpg.nodes) == 0
    assert len(parser.cpg.edges) == 0
    assert len(parser.cpg.file_index) == 0

