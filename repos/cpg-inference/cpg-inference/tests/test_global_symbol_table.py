"""Tests for GlobalSymbolTable."""

import pytest

from cpg_inference.cpg.progressive_parser import ProgressiveCPGParser
from cpg_inference.cpg.models import NodeType


@pytest.fixture
def cpg_with_symbols():
    """CPG with multiple files and symbols."""
    parser = ProgressiveCPGParser()
    parser.add_file("a.py", "def func_a(): pass\nclass ClassA: pass")
    parser.add_file("b.py", "def func_a(): pass\ndef func_b(): pass")
    return parser.cpg


@pytest.fixture
def symbol_table(cpg_with_symbols):
    """Symbol table from multi-file CPG."""
    return cpg_with_symbols.symbol_table


def test_add_file_symbols(symbol_table):
    """Verify symbols indexed."""
    # Should have symbols from both files
    assert len(symbol_table) > 0
    
    # Check specific symbols exist
    func_a_symbols = symbol_table.by_name.get("func_a", [])
    assert len(func_a_symbols) == 2  # One from each file
    
    class_a_symbols = symbol_table.by_name.get("ClassA", [])
    assert len(class_a_symbols) == 1


def test_remove_file_symbols():
    """Verify cleanup."""
    parser = ProgressiveCPGParser()
    parser.add_file("test.py", "def test_func(): pass\nclass TestClass: pass")
    
    symbols_before = len(parser.symbol_table)
    assert symbols_before > 0
    
    # Remove file
    removed_count = parser.symbol_table.remove_file_symbols("test.py")
    
    assert removed_count > 0
    symbols_after = len(parser.symbol_table)
    assert symbols_after < symbols_before


def test_resolve_without_context(symbol_table):
    """Global resolution."""
    # Resolve without context - should return all matches
    func_a_symbols = symbol_table.resolve("func_a", context_file=None)
    
    # Should find both func_a definitions
    assert len(func_a_symbols) == 2
    
    files = {s.file_path for s in func_a_symbols}
    assert "a.py" in files
    assert "b.py" in files


def test_resolve_with_local_priority():
    """Local symbols first."""
    parser = ProgressiveCPGParser()
    parser.add_file("local.py", "def my_func(): pass")
    parser.add_file("other.py", "def my_func(): pass")
    
    # Resolve from local.py context
    symbols = parser.symbol_table.resolve("my_func", context_file="local.py")
    
    # Should prioritize local file
    assert len(symbols) > 0
    # First result should be from local.py
    assert symbols[0].file_path == "local.py"


def test_resolve_with_import_context():
    """Imported symbols."""
    parser = ProgressiveCPGParser()
    parser.add_file("utils.py", "def helper(): pass")
    parser.add_file("main.py", "from utils import helper\ndef main(): pass")
    
    # Get import context for main.py
    import_ctx = parser.symbol_table.get_import_context("main.py")
    
    # Add import manually (would be done by parser in real scenario)
    import_ctx.add_import("helper", "utils.py", "helper")
    
    # Resolve helper from main.py context
    symbols = parser.symbol_table.resolve("helper", context_file="main.py")
    
    # Should find helper from utils.py
    assert len(symbols) > 0
    helper_files = {s.file_path for s in symbols}
    assert "utils.py" in helper_files


def test_resolve_wildcard_imports():
    """Wildcard handling."""
    parser = ProgressiveCPGParser()
    parser.add_file("lib.py", "def func1(): pass\ndef func2(): pass")
    parser.add_file("user.py", "from lib import *")
    
    # Setup wildcard import
    import_ctx = parser.symbol_table.get_import_context("user.py")
    import_ctx.add_wildcard_import("lib.py")
    
    # Resolve func1 from user.py context
    symbols = parser.symbol_table.resolve("func1", context_file="user.py")
    
    # Should find func1 from lib.py via wildcard
    assert len(symbols) > 0


def test_multiple_symbols_same_name():
    """Disambiguation."""
    parser = ProgressiveCPGParser()
    parser.add_file("a.py", "def shared(): pass")
    parser.add_file("b.py", "def shared(): pass")
    parser.add_file("c.py", "def shared(): pass")
    
    # Get all symbols named 'shared'
    symbols = parser.symbol_table.by_name.get("shared", [])
    
    # Should have 3 different symbols
    assert len(symbols) == 3
    
    # Each should have unique file path
    files = {s.file_path for s in symbols}
    assert len(files) == 3


def test_get_file_symbols(symbol_table):
    """File-specific lookup."""
    # Get symbols from a.py
    a_symbols = symbol_table.get_file_symbols("a.py")
    
    assert len(a_symbols) > 0
    
    # All should be from a.py
    for symbol in a_symbols:
        assert symbol.file_path == "a.py"
    
    # Should have both func_a and ClassA
    names = {s.name for s in a_symbols}
    assert "func_a" in names
    assert "ClassA" in names


def test_get_symbol_by_node_id(symbol_table):
    """Get symbol by node ID."""
    # Get any symbol
    if len(symbol_table.by_node_id) > 0:
        node_id = list(symbol_table.by_node_id.keys())[0]
        symbol = symbol_table.get_symbol(node_id)
        
        assert symbol is not None
        assert symbol.node_id == node_id


def test_find_function(symbol_table):
    """Find functions by name."""
    functions = symbol_table.find_function("func_a")
    
    # Should find functions, not classes
    assert len(functions) > 0
    for func in functions:
        assert func.node_type in [NodeType.FUNCTION, NodeType.METHOD]


def test_find_class(symbol_table):
    """Find classes by name."""
    classes = symbol_table.find_class("ClassA")
    
    # Should find classes
    assert len(classes) > 0
    for cls in classes:
        assert cls.node_type == NodeType.CLASS


def test_qualified_name_uniqueness():
    """Verify qualified names are unique per file."""
    parser = ProgressiveCPGParser()
    parser.add_file("file1.py", "def func(): pass")
    parser.add_file("file2.py", "def func(): pass")
    
    # Get both func symbols
    func_symbols = parser.symbol_table.by_name.get("func", [])
    assert len(func_symbols) == 2
    
    # Qualified names should be different
    qualified_names = {s.qualified_name for s in func_symbols}
    assert len(qualified_names) == 2


def test_import_context_creation():
    """Test import context creation and retrieval."""
    parser = ProgressiveCPGParser()
    parser.add_file("test.py", "def func(): pass")
    
    # Get import context
    ctx = parser.symbol_table.get_import_context("test.py")
    
    assert ctx is not None
    assert ctx.file_path == "test.py"
    assert isinstance(ctx.imports, dict)
    assert isinstance(ctx.wildcard_imports, set)


def test_symbol_table_repr():
    """Test string representation."""
    parser = ProgressiveCPGParser()
    parser.add_file("test.py", "def func(): pass")
    
    repr_str = repr(parser.symbol_table)
    
    assert "GlobalSymbolTable" in repr_str
    assert "symbols" in repr_str
    assert "files" in repr_str


def test_empty_symbol_table():
    """Test empty symbol table."""
    parser = ProgressiveCPGParser()
    
    assert len(parser.symbol_table) == 0
    assert len(parser.symbol_table.by_name) == 0
    assert len(parser.symbol_table.by_file) == 0


def test_resolve_nonexistent_symbol(symbol_table):
    """Test resolving symbol that doesn't exist."""
    symbols = symbol_table.resolve("nonexistent_func")
    
    assert len(symbols) == 0


def test_import_context_add_import():
    """Test adding imports to context."""
    parser = ProgressiveCPGParser()
    ctx = parser.symbol_table.get_import_context("test.py")
    
    ctx.add_import("func", "source.py", "original_func")
    
    assert "func" in ctx.imports
    assert ctx.imports["func"] == ("source.py", "original_func")


def test_import_context_resolve_import():
    """Test resolving imports in context."""
    parser = ProgressiveCPGParser()
    ctx = parser.symbol_table.get_import_context("test.py")
    
    ctx.add_import("alias", "module.py", "original")
    
    result = ctx.resolve_import("alias")
    assert result == ("module.py", "original")
    
    # Non-existent import
    result = ctx.resolve_import("nonexistent")
    assert result is None

