#!/usr/bin/env python3
"""
Simple test script to verify basic system functionality.

This test verifies:
1. Basic file operations work
2. System can execute Python scripts
3. Environment is properly configured
"""

import os
import sys
import json
from pathlib import Path

def test_basic_functionality():
    """Test basic system functionality."""
    print("🧪 Running basic functionality tests...")
    
    # Test 1: File operations
    test_file = Path("test_output.txt")
    try:
        test_file.write_text("Hello, test!")
        content = test_file.read_text()
        assert content == "Hello, test!", f"File content mismatch: {content}"
        test_file.unlink()  # Clean up
        print("✅ File operations: PASS")
    except Exception as e:
        print(f"❌ File operations: FAIL - {e}")
        return False
    
    # Test 2: Environment check
    try:
        working_dir = os.getcwd()
        print(f"✅ Working directory: {working_dir}")
        
        # Check if we can access key directories
        dirs_to_check = ["scripts", "packages", "docs"]
        for dir_name in dirs_to_check:
            if Path(dir_name).exists():
                print(f"✅ Directory exists: {dir_name}")
            else:
                print(f"⚠️  Directory missing: {dir_name}")
    except Exception as e:
        print(f"❌ Environment check: FAIL - {e}")
        return False
    
    # Test 3: JSON handling (common in impulse-activity systems)
    try:
        test_data = {
            "type": "test",
            "id": "test-impulse",
            "content": "Testing JSON serialization",
            "metadata": {
                "timestamp": "2024-01-01T00:00:00Z",
                "test": True
            }
        }
        json_str = json.dumps(test_data, indent=2)
        parsed_data = json.loads(json_str)
        assert parsed_data["type"] == "test", "JSON parsing failed"
        print("✅ JSON operations: PASS")
    except Exception as e:
        print(f"❌ JSON operations: FAIL - {e}")
        return False
    
    # Test 4: System information
    try:
        print(f"✅ Python version: {sys.version}")
        print(f"✅ Platform: {sys.platform}")
        print(f"✅ Current user: {os.getenv('USER', 'unknown')}")
    except Exception as e:
        print(f"❌ System info: FAIL - {e}")
        return False
    
    return True

def test_impulse_structure():
    """Test basic impulse-like data structure handling."""
    print("\n🔬 Testing impulse-like structures...")
    
    try:
        # Create a mock impulse structure
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
        
        # Validate structure
        required_fields = ["id", "type", "content"]
        for field in required_fields:
            if field not in mock_impulse:
                raise ValueError(f"Missing required field: {field}")
        
        print("✅ Impulse structure: PASS")
        print(f"   - ID: {mock_impulse['id']}")
        print(f"   - Type: {mock_impulse['type']}")
        print(f"   - Shape: {mock_impulse['shape']}")
        
        return True
    except Exception as e:
        print(f"❌ Impulse structure: FAIL - {e}")
        return False

def main():
    """Run all tests and report results."""
    print("🚀 Starting test suite...\n")
    
    tests_passed = 0
    total_tests = 2
    
    # Run tests
    if test_basic_functionality():
        tests_passed += 1
    
    if test_impulse_structure():
        tests_passed += 1
    
    # Report results
    print(f"\n📊 Test Results: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed!")
        return 0
    else:
        print("💥 Some tests failed!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)