#!/usr/bin/env python3
"""Simple impulse data check using direct HTTP requests."""

import requests
import json

SURREAL_URL = "http://localhost:8000/sql"
AUTH = ("root", "root")
HEADERS = {"NS": "metabob", "DB": "devbob", "Accept": "application/json"}


def query(sql):
    """Execute SQL query and return results."""
    try:
        response = requests.post(SURREAL_URL, auth=AUTH, headers=HEADERS, data=sql)
        return response.json()
    except Exception as e:
        return {"error": str(e)}


print("=== Checking Impulse Data ===\n")

# 1. Check all tables
print("1. All Tables in DB:")
result = query("INFO FOR DB;")
if result and len(result) > 0 and "result" in result[0]:
    tables = result[0]["result"].get("tb", {})
    print(f"   Total tables: {len(tables)}")
    impulse_tables = [t for t in tables.keys() if "impulse" in t.lower()]
    if impulse_tables:
        print(f"   ✅ Impulse-related tables: {impulse_tables}")
    else:
        print(f"   ❌ No impulse-related tables found")
        print(f"   Available tables: {list(tables.keys())[:10]}")
else:
    print(f"   ❌ Error: {result}")

# 2. Check impulse_effectiveness table
print("\n2. Impulse Effectiveness Records:")
result = query("SELECT * FROM impulse_effectiveness LIMIT 5;")
if result and len(result) > 0:
    if "result" in result[0] and result[0]["result"]:
        records = result[0]["result"]
        print(f"   ✅ Found {len(records)} records")
        for i, record in enumerate(records[:3], 1):
            print(f"   Record {i}: {json.dumps(record, indent=6)[:200]}...")
    else:
        print("   ❌ No records found (table might be empty)")
else:
    print(f"   ❌ Error: {result}")

# 3. Check activity_execution table
print("\n3. Recent Activity Executions:")
result = query(
    "SELECT * FROM activity_execution WHERE project_id = 'exp-repo-dev' LIMIT 5;"
)
if result and len(result) > 0:
    if "result" in result[0] and result[0]["result"]:
        records = result[0]["result"]
        print(f"   ✅ Found {len(records)} executions")
        for i, record in enumerate(records[:3], 1):
            exec_id = record.get("execution_id", "unknown")
            impulses = record.get("impulses_used", [])
            print(f"   Execution {i} ({exec_id}): {len(impulses)} impulses")
            if impulses:
                print(
                    f"      First impulse: {json.dumps(impulses[0], indent=8)[:200]}..."
                )
    else:
        print("   ❌ No executions found")
else:
    print(f"   ❌ Error: {result}")

print("\n=== Done ===")
