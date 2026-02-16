#!/usr/bin/env python3
"""Query database to check impulse data quality for the test execution."""

import json
import subprocess
import sys

EXEC_ID = "exec_9b7c4005e1ff"

def query_db(sql):
    """Execute SurrealDB query."""
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", "http://localhost:8000/sql",
         "-u", "root:root",
         "-H", "NS: metabob",
         "-H", "DB: devbob",
         "-d", sql],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ Query failed: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("result", [])
        return []
    except json.JSONDecodeError as e:
        print(f"❌ JSON error: {e}")
        return None

print("=" * 70)
print("Querying Impulse Effectiveness Records")
print("=" * 70)
print(f"\nExecution ID: {EXEC_ID}\n")

# Query impulse records for this execution
sql = f"""
SELECT 
    id,
    impulse_id,
    total_tokens,
    activity_executions,
    last_used
FROM impulse_effectiveness 
WHERE activity_executions CONTAINS '{EXEC_ID}'
LIMIT 20;
"""

records = query_db(sql)

if records is None:
    print("❌ Query failed")
    sys.exit(1)

if not records:
    print("⚠️  No impulse records found yet")
    print("\nPossible reasons:")
    print("  1. Execution still running (check backend logs)")
    print("  2. Execution completed but hasn't recorded impulses")
    print("  3. Bug still present (impulses lost)")
    print("\nWait a bit longer and try again...")
    sys.exit(1)

print(f"Found {len(records)} impulse records!\n")

# Analyze quality
total = len(records)
unknown_count = 0
zero_token_count = 0

print("Impulse Records:")
print("-" * 70)
for i, rec in enumerate(records, 1):
    impulse_id = rec.get("impulse_id", "N/A")
    tokens = rec.get("total_tokens", 0)
    
    # Check for quality issues
    is_unknown = impulse_id.startswith("unknown")
    is_zero = tokens == 0
    
    if is_unknown:
        unknown_count += 1
    if is_zero:
        zero_token_count += 1
    
    # Display
    status = ""
    if is_unknown:
        status += " ⚠️ UNKNOWN"
    if is_zero:
        status += " ⚠️ ZERO_TOKENS"
    if not is_unknown and not is_zero:
        status = " ✅"
    
    print(f"{i}. impulse_id: {impulse_id[:60]}")
    print(f"   tokens: {tokens}{status}")
    print()

# Calculate percentages
unknown_pct = (unknown_count / total * 100) if total > 0 else 0
zero_token_pct = (zero_token_count / total * 100) if total > 0 else 0

print("=" * 70)
print("Quality Metrics:")
print(f"  Total Records: {total}")
print(f"  Unknown IDs: {unknown_count} ({unknown_pct:.1f}%)")
print(f"  Zero Tokens: {zero_token_count} ({zero_token_pct:.1f}%)")
print("=" * 70)

# Determine success
TARGET_UNKNOWN = 10  # <10% unknown IDs
TARGET_ZERO = 10     # <10% zero tokens

print("\nEvaluation:")
if unknown_pct < TARGET_UNKNOWN and zero_token_pct < TARGET_ZERO:
    print(f"✅ PASS - Data quality is GOOD!")
    print(f"   Unknown IDs: {unknown_pct:.1f}% (target: <{TARGET_UNKNOWN}%)")
    print(f"   Zero Tokens: {zero_token_pct:.1f}% (target: <{TARGET_ZERO}%)")
    print("\n🎉 The impulse data quality fix is working!")
    sys.exit(0)
else:
    print(f"❌ FAIL - Data quality issues remain")
    print(f"   Unknown IDs: {unknown_pct:.1f}% (target: <{TARGET_UNKNOWN}%)")
    print(f"   Zero Tokens: {zero_token_pct:.1f}% (target: <{TARGET_ZERO}%)")
    print("\n   The fix may not be working as expected.")
    sys.exit(1)
