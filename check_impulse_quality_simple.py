#!/usr/bin/env python3
"""Quick check of impulse data quality in database."""

import json
import subprocess
import sys

def query_surrealdb(query):
    """Execute SurrealDB query and return results."""
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", "http://localhost:8000/sql",
         "-u", "root:root",
         "-H", "NS: metabob",
         "-H", "DB: devbob",
         "-d", query],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Query failed: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        # SurrealDB returns array of query results
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("result", [])
        return []
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        print(f"Raw output: {result.stdout[:500]}")
        return None

# Query recent impulse effectiveness records
print("Querying impulse_effectiveness table for data quality...")
print("=" * 70)

query = """
SELECT 
    id,
    impulse_id,
    total_tokens,
    activity_executions,
    last_used
FROM impulse_effectiveness 
ORDER BY last_used DESC
LIMIT 20;
"""

records = query_surrealdb(query)

if records is None:
    print("❌ Query failed")
    sys.exit(1)

if not records:
    print("⚠️  No impulse records found in database")
    print("This could mean:")
    print("  1. No activities have been executed yet")
    print("  2. Impulse tracking is not enabled")
    print("  3. Database is empty")
    sys.exit(1)

print(f"Found {len(records)} recent impulse records\n")

# Analyze quality
total = len(records)
unknown_count = sum(1 for r in records if r.get("impulse_id", "").startswith("unknown"))
zero_token_count = sum(1 for r in records if r.get("total_tokens", 0) == 0)

unknown_pct = (unknown_count / total * 100) if total > 0 else 0
zero_token_pct = (zero_token_count / total * 100) if total > 0 else 0

# Display sample records
print("Sample Records:")
for i, record in enumerate(records[:5], 1):
    impulse_id = record.get("impulse_id", "N/A")
    tokens = record.get("total_tokens", 0)
    exec_count = len(record.get("activity_executions", []))
    last_used = record.get("last_used", "N/A")
    print(f"{i}. impulse_id: {impulse_id[:50]} | tokens: {tokens} | executions: {exec_count}")

print("\n" + "=" * 70)
print("Quality Metrics:")
print(f"  Unknown IDs: {unknown_count}/{total} ({unknown_pct:.1f}%)")
print(f"  Zero Tokens: {zero_token_count}/{total} ({zero_token_pct:.1f}%)")
print("=" * 70)

# Success criteria: <10% unknown IDs and <10% zero tokens
if unknown_pct < 10 and zero_token_pct < 10:
    print("✅ PASS - Data quality is good!")
    sys.exit(0)
else:
    print("❌ FAIL - Data quality issues detected")
    print(f"   Target: <10% unknown IDs, <10% zero tokens")
    sys.exit(1)
