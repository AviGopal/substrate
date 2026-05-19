"""
Test suite for basic system functionality verification.

This test suite verifies:
1. Basic file operations work
2. Environment is properly configured  
3. JSON handling works (common in impulse-activity systems)
4. Basic impulse-like structures can be created and validated
"""

import os
import sys
import json
import tempfile
from pathlib import Path
import pytest


class TestBasicFunctionality:
    """Test basic system functionality."""
    
    def test_file_operations(self):
        """Test that file operations work correctly."""
        # Use temporary file to avoid cluttering workspace
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as tf:
            test_content = "Hello, test!"
            tf.write(test_content)
            tf.flush()
            
            # Read back the content
            with open(tf.name, 'r') as rf:
                read_content = rf.read()
            
            assert read_content == test_content
            
            # Clean up
            os.unlink(tf.name)
    
    def test_environment_check(self):
        """Test that the environment is properly configured."""
        working_dir = os.getcwd()
        assert working_dir is not None
        assert len(working_dir) > 0
        
        # Check if we can access key directories that should exist
        dirs_to_check = ["scripts", "packages", "docs"]
        existing_dirs = []
        for dir_name in dirs_to_check:
            if Path(dir_name).exists():
                existing_dirs.append(dir_name)
        
        # At least one of these directories should exist
        assert len(existing_dirs) > 0, f"None of expected directories found: {dirs_to_check}"
    
    def test_json_operations(self):
        """Test JSON serialization/deserialization."""
        test_data = {
            "type": "test",
            "id": "test-impulse",
            "content": "Testing JSON serialization",
            "metadata": {
                "timestamp": "2024-01-01T00:00:00Z",
                "test": True
            }
        }
        
        # Test serialization
        json_str = json.dumps(test_data, indent=2)
        assert json_str is not None
        assert len(json_str) > 0
        
        # Test deserialization
        parsed_data = json.loads(json_str)
        assert parsed_data["type"] == "test"
        assert parsed_data["id"] == "test-impulse"
        assert parsed_data["metadata"]["test"] is True
    
    def test_system_info(self):
        """Test that system information is accessible."""
        # Test Python version access
        assert sys.version is not None
        assert len(sys.version) > 0
        
        # Test platform access
        assert sys.platform is not None
        assert len(sys.platform) > 0
        
        # Test environment variable access
        user = os.getenv('USER', 'unknown')
        assert user is not None


class TestImpulseStructures:
    """Test impulse-like data structure handling."""
    
    def test_impulse_structure_creation(self):
        """Test creating basic impulse-like structures."""
        mock_impulse = {
            "id": "test-impulse-001",
            "type": "memo",
            "shape": "test_result",
            "content": "This is a test impulse",
            "budget": 1000,
            "metadata": {
                "created_at": "2024-01-01T00:00:00Z",
                "test_mode": True,
                "priority": "low"
            }
        }
        
        # Validate required fields are present
        required_fields = ["id", "type", "content"]
        for field in required_fields:
            assert field in mock_impulse, f"Missing required field: {field}"
        
        # Validate field types
        assert isinstance(mock_impulse["id"], str)
        assert isinstance(mock_impulse["type"], str)
        assert isinstance(mock_impulse["budget"], int)
        assert isinstance(mock_impulse["metadata"], dict)
    
    def test_impulse_validation(self):
        """Test impulse structure validation."""
        valid_impulse = {
            "id": "valid-impulse",
            "type": "memo", 
            "content": "Valid content"
        }
        
        # Should not raise any exceptions
        self._validate_impulse(valid_impulse)
        
        # Test missing required field
        invalid_impulse = {
            "id": "invalid-impulse",
            "type": "memo"
            # Missing content
        }
        
        with pytest.raises(ValueError, match="Missing required field: content"):
            self._validate_impulse(invalid_impulse)
    
    def _validate_impulse(self, impulse):
        """Helper method to validate impulse structure."""
        required_fields = ["id", "type", "content"]
        for field in required_fields:
            if field not in impulse:
                raise ValueError(f"Missing required field: {field}")


class TestSystemIntegration:
    """Test system integration aspects."""
    
    def test_workspace_structure(self):
        """Test that the workspace has expected structure."""
        current_dir = Path.cwd()
        
        # Check for README.md (common in projects)
        readme_path = current_dir / "README.md"
        if readme_path.exists():
            content = readme_path.read_text()
            assert len(content) > 0
            
        # Check for git repository
        git_dir = current_dir / ".git"
        if git_dir.exists():
            assert git_dir.is_dir()
    
    def test_impulse_pointer_structure(self):
        """Test creating impulse pointer structures."""
        # Test file pointer
        file_pointer = {
            "type": "file",
            "path": "/workspace/test.txt"
        }
        assert file_pointer["type"] == "file"
        assert file_pointer["path"].startswith("/")
        
        # Test execution trace pointer
        trace_pointer = {
            "type": "executionTraceList",
            "limit": 10
        }
        assert trace_pointer["type"] == "executionTraceList"
        assert isinstance(trace_pointer["limit"], int)
        
        # Test activity template pointer
        template_pointer = {
            "type": "activityTemplate",
            "templateId": "abc123"
        }
        assert template_pointer["type"] == "activityTemplate"
        assert len(template_pointer["templateId"]) > 0


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])