"""Tests for ImportGraph."""

import pytest

from cpg_inference.cpg.import_graph import ImportGraph, ImportInfo


@pytest.fixture
def import_graph():
    """Empty import graph."""
    return ImportGraph()


@pytest.fixture
def graph_with_dependencies():
    """Import graph with dependencies."""
    graph = ImportGraph()
    graph.add_import("a.py", "b.py", ["func"])
    graph.add_import("b.py", "c.py", ["helper"])
    graph.add_import("d.py", "b.py", ["func"])
    return graph


def test_import_graph_initialization(import_graph):
    """Test empty graph initialization."""
    assert len(import_graph) == 0
    assert len(import_graph.graph) == 0
    assert len(import_graph.reverse) == 0


def test_add_import_creates_edges(import_graph):
    """Forward and reverse edges."""
    import_graph.add_import("main.py", "utils.py", ["helper"])
    
    # Forward edge exists
    assert "main.py" in import_graph.graph
    assert "utils.py" in import_graph.graph["main.py"]
    
    # Reverse edge exists
    assert "utils.py" in import_graph.reverse
    assert "main.py" in import_graph.reverse["utils.py"]
    
    # Import details stored
    info = import_graph.get_import_info("main.py", "utils.py")
    assert info is not None
    assert info.from_file == "main.py"
    assert info.to_file == "utils.py"
    assert "helper" in info.imported_symbols


def test_remove_file_cleans_edges(graph_with_dependencies):
    """Bidirectional cleanup."""
    # Remove b.py which has both forward and reverse edges
    graph_with_dependencies.remove_file("b.py")
    
    # b.py should be gone from graph
    assert "b.py" not in graph_with_dependencies.graph
    assert "b.py" not in graph_with_dependencies.reverse
    
    # References to b.py should be removed
    assert "b.py" not in graph_with_dependencies.graph.get("a.py", set())
    assert "b.py" not in graph_with_dependencies.graph.get("d.py", set())


def test_get_imports(graph_with_dependencies):
    """Direct imports."""
    imports = graph_with_dependencies.get_imports("a.py")
    
    assert "b.py" in imports
    assert len(imports) == 1


def test_get_importers(graph_with_dependencies):
    """Direct importers."""
    importers = graph_with_dependencies.get_importers("b.py")
    
    # Both a.py and d.py import b.py
    assert "a.py" in importers
    assert "d.py" in importers
    assert len(importers) == 2


def test_get_dependents_transitive(graph_with_dependencies):
    """BFS traversal."""
    # c.py is imported by b.py, which is imported by a.py and d.py
    dependents = graph_with_dependencies.get_dependents("c.py")
    
    # Should include both b.py's importers
    assert "b.py" in dependents
    assert "a.py" in dependents
    assert "d.py" in dependents


def test_get_dependencies_transitive(graph_with_dependencies):
    """Reverse traversal."""
    # a.py imports b.py imports c.py
    dependencies = graph_with_dependencies.get_dependencies("a.py")
    
    assert "b.py" in dependencies
    assert "c.py" in dependencies


def test_topological_sort_valid():
    """Dependency order."""
    graph = ImportGraph()
    graph.add_import("a.py", "b.py")
    graph.add_import("b.py", "c.py")
    graph.add_import("d.py", "c.py")
    
    order = graph.topological_sort()
    
    # c.py should come before b.py and d.py
    # b.py should come before a.py
    c_idx = order.index("c.py")
    b_idx = order.index("b.py")
    a_idx = order.index("a.py")
    d_idx = order.index("d.py")
    
    assert c_idx < b_idx
    assert b_idx < a_idx
    assert c_idx < d_idx


def test_topological_sort_with_cycles():
    """Cycle handling."""
    graph = ImportGraph()
    graph.add_import("a.py", "b.py")
    graph.add_import("b.py", "c.py")
    graph.add_import("c.py", "a.py")  # Cycle
    
    order = graph.topological_sort()
    
    # Should still return all files (in some order)
    assert len(order) == 3
    assert set(order) == {"a.py", "b.py", "c.py"}


def test_detect_cycles():
    """Tarjan's algorithm."""
    graph = ImportGraph()
    graph.add_import("a.py", "b.py")
    graph.add_import("b.py", "c.py")
    graph.add_import("c.py", "a.py")  # Cycle: a -> b -> c -> a
    
    cycles = graph.detect_cycles()
    
    # Should detect one cycle
    assert len(cycles) > 0
    
    # Cycle should contain a, b, c
    cycle_files = set(cycles[0])
    assert {"a.py", "b.py", "c.py"}.issubset(cycle_files)


def test_detect_no_cycles():
    """Test graph without cycles."""
    graph = ImportGraph()
    graph.add_import("a.py", "b.py")
    graph.add_import("b.py", "c.py")
    
    cycles = graph.detect_cycles()
    
    assert len(cycles) == 0


def test_has_path(graph_with_dependencies):
    """Path existence."""
    # a.py -> b.py -> c.py
    assert graph_with_dependencies.has_path("a.py", "c.py")
    assert graph_with_dependencies.has_path("a.py", "b.py")
    
    # No path from c.py to a.py
    assert not graph_with_dependencies.has_path("c.py", "a.py")
    
    # Path to self
    assert graph_with_dependencies.has_path("a.py", "a.py")


def test_add_wildcard_import(import_graph):
    """Test wildcard import flag."""
    import_graph.add_import("main.py", "lib.py", is_wildcard=True)
    
    info = import_graph.get_import_info("main.py", "lib.py")
    assert info.is_wildcard


def test_multiple_imports_same_files(import_graph):
    """Test multiple imports between same files."""
    import_graph.add_import("a.py", "b.py", ["func1"])
    import_graph.add_import("a.py", "b.py", ["func2"])
    
    # Second add should replace first
    info = import_graph.get_import_info("a.py", "b.py")
    assert info is not None
    # Latest import details stored


def test_clear_graph(graph_with_dependencies):
    """Test clearing graph."""
    assert len(graph_with_dependencies) > 0
    
    graph_with_dependencies.clear()
    
    assert len(graph_with_dependencies) == 0
    assert len(graph_with_dependencies.graph) == 0
    assert len(graph_with_dependencies.reverse) == 0
    assert len(graph_with_dependencies.import_details) == 0


def test_graph_repr(graph_with_dependencies):
    """Test string representation."""
    repr_str = repr(graph_with_dependencies)
    
    assert "ImportGraph" in repr_str
    assert "files" in repr_str
    assert "edges" in repr_str


def test_import_info_hash():
    """Test ImportInfo is hashable."""
    info1 = ImportInfo("a.py", "b.py")
    info2 = ImportInfo("a.py", "b.py")
    
    # Should be hashable
    assert hash(info1) == hash(info2)
    
    # Can be added to set
    info_set = {info1, info2}
    assert len(info_set) == 1


def test_complex_dependency_graph():
    """Test complex graph with multiple relationships."""
    graph = ImportGraph()
    
    # Create complex graph
    graph.add_import("app.py", "auth.py")
    graph.add_import("app.py", "database.py")
    graph.add_import("auth.py", "database.py")
    graph.add_import("auth.py", "utils.py")
    graph.add_import("database.py", "utils.py")
    
    # Test various queries
    assert len(graph.get_imports("app.py")) == 2
    assert len(graph.get_importers("utils.py")) == 2
    
    # Transitive dependencies of app.py
    deps = graph.get_dependencies("app.py")
    assert "auth.py" in deps
    assert "database.py" in deps
    assert "utils.py" in deps


def test_get_imports_nonexistent_file(import_graph):
    """Test getting imports for file not in graph."""
    imports = import_graph.get_imports("nonexistent.py")
    
    assert len(imports) == 0


def test_get_importers_nonexistent_file(import_graph):
    """Test getting importers for file not in graph."""
    importers = import_graph.get_importers("nonexistent.py")
    
    assert len(importers) == 0

