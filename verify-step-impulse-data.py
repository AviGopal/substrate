#!/usr/bin/env python3
"""
Verify that step-level impulse data was persisted to the database.
"""

import httpx

BACKEND_URL = "http://localhost:8080"

# Get session token from state file
import json

with open(".metabob/state") as f:
    state = json.load(f)
    SESSION_TOKEN = state["session_metadata"]["session_token"]

# Query via backend API (using internal _query endpoint if available)
# Or we can use the SurrealDB Python client directly

from surrealdb import Surreal

# Connect to SurrealDB directly
db = Surreal("ws://localhost:8000")
db.connect()
db.use("metabob", "dev")
db.signin({"user": "root", "pass": "root"})

print("=" * 70)
print("Step-Level Impulse Data Verification")
print("=" * 70)
print()

# Query execution_steps table
print("📊 Querying execution_steps table...")
result = db.query("""
    SELECT * FROM execution_steps 
    WHERE execution_id CONTAINS 'test-exec' 
    ORDER BY meta::tb(id) DESC 
    LIMIT 5
""")

if result and len(result) > 0:
    steps = result[0].get("result", [])
    print(f"✅ Found {len(steps)} step records\n")

    for i, step in enumerate(steps):
        print(f"Step {i + 1}:")
        print(f"  ID: {step.get('id')}")
        print(f"  Execution ID: {step.get('execution_id')}")
        print(f"  Step Index: {step.get('step_index')}")
        print(f"  Success: {step.get('success')}")
        print(f"  Duration: {step.get('duration_ms')}ms")
        print(f"  Tokens: {step.get('tokens')}")
        print(f"  Impulses loaded: {step.get('impulses_loaded', [])}")
        print(f"  Impulses created: {step.get('impulses_created', [])}")
        print(f"  Context summary: {step.get('context_summary', {})}")
        print()
else:
    print("⚠️  No step records found")
    print()

# Query impulse_usage table
print("📈 Querying impulse_usage table...")
result = db.query("""
    SELECT * FROM impulse_usage 
    WHERE execution_id CONTAINS 'test-exec' 
    ORDER BY created_at DESC 
    LIMIT 10
""")

if result and len(result) > 0:
    usages = result[0].get("result", [])
    print(f"✅ Found {len(usages)} impulse usage records\n")

    for usage in usages:
        print(f"Impulse Usage:")
        print(f"  Impulse ID: {usage.get('impulse_id')}")
        print(f"  Execution ID: {usage.get('execution_id')}")
        print(f"  Step ID: {usage.get('step_id')}")
        print(f"  Was useful: {usage.get('was_useful')}")
        print(f"  Tokens: {usage.get('tokens_used')}")
        print()
else:
    print("⚠️  No impulse usage records found")
    print()

# Query impulse_registry table
print("📚 Querying impulse_registry table...")
result = db.query("""
    SELECT * FROM impulse_registry 
    WHERE impulse_id IN ['file:test.ts', 'memo:context', 'memo:result'] 
    LIMIT 10
""")

if result and len(result) > 0:
    registry_entries = result[0].get("result", [])
    print(f"✅ Found {len(registry_entries)} impulse registry entries\n")

    for entry in registry_entries:
        print(f"Registry Entry:")
        print(f"  Impulse ID: {entry.get('impulse_id')}")
        print(f"  Usage count: {entry.get('usage_count')}")
        print(f"  Success count: {entry.get('success_count')}")
        print(f"  Success rate: {entry.get('success_rate', 0):.2%}")
        print()
else:
    print(
        "ℹ️  No registry entries yet (expected - registry is populated after activity completion)"
    )
    print()

print("=" * 70)
print("✅ Verification complete!")
print("=" * 70)
