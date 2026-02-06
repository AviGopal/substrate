"""Tests for CPG component extractor."""

import pytest

from cpg_inference.cpg.models import NodeType
from cpg_inference.cpg_extractor import CPGComponentExtractor


def test_extract_from_file_python():
    """Test extracting components from Python file."""
    extractor = CPGComponentExtractor()
    
    code = """
def hello(name):
    return f"Hello {name}"

class User:
    def __init__(self, name):
        self.name = name
    
    def greet(self):
        return hello(self.name)
"""
    
    components, cpg = extractor.extract_from_file("test.py", code)
    
    # Should extract: hello function, User class, __init__ method, greet method
    assert len(components) >= 2  # At least function and class
    
    # Check component IDs are generated correctly
    for component in components:
        assert "::" in component.id
        assert component.file_path == "test.py"
        assert component.component_type in [NodeType.FUNCTION, NodeType.CLASS, NodeType.METHOD]


def test_extract_from_files_multiple():
    """Test extracting from multiple files."""
    extractor = CPGComponentExtractor()
    
    files = {
        "auth.py": "def login(user): pass",
        "user.py": "class User: pass",
    }
    
    file_components, file_cpgs = extractor.extract_from_files(files)
    
    assert "auth.py" in file_components
    assert "user.py" in file_components
    assert len(file_components["auth.py"]) >= 1
    assert len(file_components["user.py"]) >= 1


def test_component_types_filter():
    """Test filtering by component types."""
    # Only extract functions
    extractor = CPGComponentExtractor(component_types=["function"])
    
    code = """
def foo(): pass
class Bar: pass
"""
    
    components, _ = extractor.extract_from_file("test.py", code)
    
    # Should only get function, not class
    assert all(c.component_type == NodeType.FUNCTION for c in components)


def test_extract_from_invalid_code():
    """Test handling of invalid code."""
    extractor = CPGComponentExtractor()
    
    files = {
        "invalid.py": "def foo(: invalid syntax",
    }
    
    file_components, file_cpgs = extractor.extract_from_files(files)
    
    # Should return empty list for invalid file
    assert file_components["invalid.py"] == []


def test_component_id_generation():
    """Test component ID generation."""
    from cpg_inference.models import CPGComponent
    
    component_id = CPGComponent.generate_id(
        file_path="src/auth.py",
        component_type=NodeType.FUNCTION,
        name="login",
        start_line=10,
    )
    
    assert component_id == "src/auth.py::function::login::10"
    
    # Parse it back
    parts = component_id.split("::")
    assert parts[0] == "src/auth.py"
    assert parts[1] == "function"
    assert parts[2] == "login"
    assert parts[3] == "10"


def test_get_component_by_id():
    """Test retrieving component by ID."""
    extractor = CPGComponentExtractor()
    
    files = {
        "test.py": "def hello(): pass",
    }
    
    # Extract components
    file_components, _ = extractor.extract_from_files(files)
    components = file_components["test.py"]
    
    if components:
        component_id = components[0].id
        
        # Retrieve by ID
        component = extractor.get_component_by_id(component_id, files)
        
        assert component is not None
        assert component.id == component_id


def test_empty_file():
    """Test handling empty file."""
    extractor = CPGComponentExtractor()
    
    components, cpg = extractor.extract_from_file("empty.py", "")
    
    # Empty file should have no components
    assert len(components) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

