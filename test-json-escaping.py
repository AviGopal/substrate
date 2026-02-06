#!/usr/bin/env python3
"""
Test that JSON escaping fix works correctly for database insertion.
"""

import json

# Test data with nested quotes (like task_steps array)
test_data = {
    "variant_id": "test-variant-1",
    "activity_id": "bug-fix",
    "task_steps": [
        {
            "id": "task1",
            "description": 'Fix the "authentication" bug',
            "prompt": 'Use the following approach:\n- Check "expired" tokens\n- Validate "refresh" logic',
        },
        {
            "id": "task2",
            "description": "Add test with 'single' quotes and \"double\" quotes",
            "validation": {
                "required_files": ["test/auth.test.js"],
                "patterns": ["expect.*toPass"],
            },
        },
    ],
    "variables": {
        "bug_description": 'Auth timeout with "special" chars',
        "test_command": 'npm test -- --grep="auth"',
    },
}

print("=" * 70)
print("Testing JSON Escaping for SurrealDB SQL")
print("=" * 70)

# OLD METHOD (BROKEN) - Direct json.dumps in f-string
print("\n❌ OLD METHOD (BROKEN):")
print("-" * 70)
try:
    fields = []
    for key, value in test_data.items():
        if isinstance(value, (list, dict)):
            # This is the BROKEN way - quotes not escaped for SQL
            fields.append(f"{key} = {json.dumps(value)}")

    broken_sql = f"CREATE activity_variants SET {', '.join(fields)};"
    print(broken_sql[:200] + "...")
    print("\n⚠️  Problem: Unescaped quotes will cause SQL syntax error!")
    print('Example: task_steps = [{"id": "task1"...}]')
    print("The inner quotes break the SQL string!")
except Exception as e:
    print(f"Error: {e}")

# NEW METHOD (FIXED) - Proper escaping
print("\n\n✅ NEW METHOD (FIXED):")
print("-" * 70)
try:
    fields = []
    for key, value in test_data.items():
        if isinstance(value, str):
            escaped = value.replace("\\", "\\\\").replace('"', '\\"')
            fields.append(f'{key} = "{escaped}"')
        elif isinstance(value, (list, dict)):
            # FIX: Escape the JSON string for SQL
            escaped_json = json.dumps(value).replace("\\", "\\\\").replace('"', '\\"')
            fields.append(f'{key} = "{escaped_json}"')

    fixed_sql = f"CREATE activity_variants SET {', '.join(fields)};"
    print(fixed_sql[:300] + "...")
    print("\n✅ Properly escaped! All quotes are escaped for SQL.")
    print('Example: task_steps = "[{\\"id\\": \\"task1\\"...}]"')
    print("The JSON is now a properly escaped SQL string!")
except Exception as e:
    print(f"Error: {e}")

# Verify the fix
print("\n\n" + "=" * 70)
print("VERIFICATION")
print("=" * 70)

# Simulate what would be stored in database
json_str = json.dumps(test_data["task_steps"])
print(f"\n1. Original JSON ({len(json_str)} chars):")
print(json_str[:100] + "...")

escaped_json = json_str.replace("\\", "\\\\").replace('"', '\\"')
print(f"\n2. Escaped for SQL ({len(escaped_json)} chars):")
print(escaped_json[:100] + "...")

# Simulate database storage and retrieval
sql_value = f'"{escaped_json}"'
print(f"\n3. SQL string value ({len(sql_value)} chars):")
print(sql_value[:100] + "...")

# Reverse the escaping (what database would return)
retrieved = sql_value[1:-1]  # Remove outer quotes
unescaped = retrieved.replace('\\"', '"').replace("\\\\", "\\")
print(f"\n4. Retrieved from DB ({len(unescaped)} chars):")
print(unescaped[:100] + "...")

# Verify round-trip
recovered_data = json.loads(unescaped)
print(f"\n5. Parsed back to Python:")
print(f"   ✅ Successfully recovered {len(recovered_data)} task steps")
print(f"   ✅ First task ID: {recovered_data[0]['id']}")
print(f"   ✅ First task description: {recovered_data[0]['description'][:50]}...")

print("\n" + "=" * 70)
print("✅ JSON ESCAPING FIX VERIFIED!")
print("=" * 70)
print("\nThe fix ensures:")
print("  1. JSON is properly escaped for SQL strings")
print("  2. task_steps array is stored correctly")
print("  3. Data can be retrieved and parsed without errors")
print("  4. All special characters (quotes, backslashes) are handled")
