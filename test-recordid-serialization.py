#!/usr/bin/env python3
"""
Test RecordID serialization fix for rpc-api endpoints.

This test validates that the sanitize_record() function correctly
converts SurrealDB RecordID objects to JSON-serializable strings.
"""

import sys
import json
from pathlib import Path

# Add server to path
sys.path.insert(0, str(Path(__file__).parent / 'repos' / 'metabob-rpc-api' / 'server'))

from db.surrealdb_client import sanitize_record

def test_sanitize_record():
    """Test sanitize_record with various data types."""
    
    # Import the real RecordID class
    try:
        from surrealdb.data.types.record_id import RecordID
    except ImportError:
        from surrealdb import RecordID
    
    print("Testing sanitize_record() RecordID conversion...")
    
    # Test 1: Basic RecordID
    record_id = RecordID("activity_template", "test-123")
    sanitized = sanitize_record(record_id)
    print(f"✓ RecordID conversion: {record_id} → {sanitized}")
    assert isinstance(sanitized, str), f"Expected str, got {type(sanitized)}"
    
    # Test 2: Dict with RecordID
    data = {
        "id": RecordID("activity_template", "abc"),
        "name": "Test Template",
        "variant_id": "test-variant"
    }
    sanitized = sanitize_record(data)
    print(f"✓ Dict with RecordID: id field converted to string")
    assert isinstance(sanitized["id"], str), "RecordID in dict not converted"
    
    # Test 3: JSON serialization (the critical test)
    try:
        json_str = json.dumps(sanitized)
        print(f"✓ JSON serialization successful: {len(json_str)} bytes")
    except TypeError as e:
        print(f"✗ JSON serialization FAILED: {e}")
        sys.exit(1)
    
    # Test 4: Nested structures
    nested = {
        "templates": [
            {"id": RecordID("template", "1"), "name": "T1"},
            {"id": RecordID("template", "2"), "name": "T2"}
        ],
        "metadata": {
            "created_by": RecordID("user", "admin")
        }
    }
    sanitized_nested = sanitize_record(nested)
    json_nested = json.dumps(sanitized_nested)
    print(f"✓ Nested RecordID conversion: {len(json_nested)} bytes")
    
    # Test 5: List of RecordIDs
    record_list = [
        RecordID("template", "1"),
        RecordID("template", "2"),
        RecordID("template", "3")
    ]
    sanitized_list = sanitize_record(record_list)
    assert all(isinstance(item, str) for item in sanitized_list), "List items not converted"
    print(f"✓ List of RecordIDs: {sanitized_list}")
    
    print("\n✅ All tests passed! RecordID serialization fix is working.")
    return True

if __name__ == "__main__":
    try:
        test_sanitize_record()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
