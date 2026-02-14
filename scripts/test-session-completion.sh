#!/bin/bash

# Test session completion and tool stats aggregation
# Verifies that endSession/completeSession correctly aggregates tool usage

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=========================================="
echo "Testing Session Completion & Tool Stats"
echo "=========================================="
echo ""

# Clean up any previous test data
echo "Step 1: Cleaning Redis test data..."
python3 scripts/cleanup-redis-test-sessions.py 2>/dev/null || true
echo ""

# Run OpenCode with multiple tools to generate diverse tool usage
echo "Step 2: Running OpenCode with multi-tool task..."
echo "Task: 'List files, then read package.json, then check git status'"
echo ""

cd repos/metabob-opencode
timeout 60s bun run dev run "List the files in the current directory, then read the package.json file" 2>&1 | tee /tmp/opencode-session-test.log || true
cd "$REPO_ROOT"

echo ""
echo "Step 3: Waiting for async operations to complete..."
sleep 3

echo ""
echo "Step 4: Checking session data in Redis..."
echo ""

# Check Redis for session completion data
python3 - <<'PYTHON_SCRIPT'
import redis
import json
from typing import Dict, List, Any

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Find all session keys
keys = r.keys('agent_execution:session:*')

print(f"Found {len(keys)} session(s) in Redis\n")

if not keys:
    print("❌ NO SESSIONS FOUND - Session tracking may not be working")
    exit(1)

# Analyze the most recent session
session_key = sorted(keys, reverse=True)[0]
session_data = r.get(session_key)

if not session_data:
    print(f"❌ Session key exists but data is empty: {session_key}")
    exit(1)

data = json.loads(session_data)
session_id = session_key.split(':')[-1]

print("=" * 60)
print("SESSION SUMMARY")
print("=" * 60)
print(f"Session ID: {session_id}")
print(f"Agent: {data.get('agent_id', 'UNKNOWN')}")
print(f"Version: {data.get('agent_version', 'UNKNOWN')}")
print(f"Goal: {data.get('goal', 'UNKNOWN')}")
print()

# Tool invocations
tool_invocations = data.get('tool_invocations', [])
print(f"Total Tool Invocations: {len(tool_invocations)}")
print()

if len(tool_invocations) == 0:
    print("⚠️  NO TOOL INVOCATIONS - Task may have failed or not used tools")
    print()
else:
    print("Tool Invocations (Raw):")
    print("-" * 60)
    
    tool_counts: Dict[str, Dict[str, Any]] = {}
    
    for inv in tool_invocations:
        tool_name = inv['tool_name']
        success = inv['success']
        duration = inv['duration_ms']
        
        if tool_name not in tool_counts:
            tool_counts[tool_name] = {
                'total': 0,
                'success': 0,
                'failed': 0,
                'durations': []
            }
        
        tool_counts[tool_name]['total'] += 1
        if success:
            tool_counts[tool_name]['success'] += 1
        else:
            tool_counts[tool_name]['failed'] += 1
        tool_counts[tool_name]['durations'].append(duration)
    
    for tool_name, stats in tool_counts.items():
        avg_duration = sum(stats['durations']) / len(stats['durations'])
        print(f"  {tool_name}:")
        print(f"    - Total calls: {stats['total']}")
        print(f"    - Success: {stats['success']}")
        print(f"    - Failed: {stats['failed']}")
        print(f"    - Avg duration: {avg_duration:.1f}ms")
        print()

# Check for completion data
print("=" * 60)
print("SESSION COMPLETION DATA")
print("=" * 60)

outcome = data.get('outcome')
completed_at = data.get('completed_at')
total_duration = data.get('total_duration_ms')
tool_usage_stats = data.get('tool_usage_stats')

if outcome:
    print(f"✅ Outcome recorded:")
    print(f"   - Success: {outcome.get('success', 'UNKNOWN')}")
    print(f"   - Goal achieved: {outcome.get('goal_achieved', 'UNKNOWN')}")
    if outcome.get('error'):
        print(f"   - Error: {outcome['error']}")
else:
    print("⚠️  No outcome data - session may not have completed")

print()

if completed_at:
    print(f"✅ Completion time: {completed_at}")
else:
    print("⚠️  No completion time - session may still be running")

print()

if total_duration is not None:
    print(f"✅ Total duration: {total_duration}ms ({total_duration/1000:.2f}s)")
else:
    print("⚠️  No total duration recorded")

print()

# This is the KEY TEST: tool_usage_stats aggregation
if tool_usage_stats:
    print("✅ TOOL USAGE STATS AGGREGATED:")
    print("-" * 60)
    print(json.dumps(tool_usage_stats, indent=2))
    print()
    print("✅ SUCCESS: Tool stats aggregation is working!")
else:
    print("❌ MISSING: tool_usage_stats not found in session data")
    print()
    print("This means:")
    print("  1. completeSession() was not called, OR")
    print("  2. getToolUsageStats() returned empty, OR")
    print("  3. recordSessionComplete() didn't include stats in payload")
    print()
    print("Session may not have completed properly.")

# Check reflection
print()
print("=" * 60)
print("REFLECTION DATA")
print("=" * 60)

reflection = data.get('reflection')
if reflection:
    print("✅ Reflection recorded:")
    print(f"   - What worked: {reflection.get('what_worked', 'N/A')}")
    print(f"   - What didn't work: {reflection.get('what_didnt_work', 'N/A')}")
    print(f"   - Improvements: {reflection.get('improvements_suggested', 'N/A')}")
else:
    print("ℹ️  No reflection data (expected for auto-exit sessions)")

print()
print("=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)

# Final verdict
if outcome and completed_at and tool_usage_stats:
    print()
    print("✅✅✅ SESSION COMPLETION VERIFICATION: PASSING ✅✅✅")
    print()
    print("All expected data present:")
    print("  ✅ Tool invocations recorded")
    print("  ✅ Outcome recorded")
    print("  ✅ Completion time recorded")
    print("  ✅ Tool usage stats aggregated")
    exit(0)
elif not outcome or not completed_at:
    print()
    print("⚠️⚠️⚠️ SESSION COMPLETION VERIFICATION: INCOMPLETE ⚠️⚠️⚠️")
    print()
    print("Session data exists but completion may not have been called.")
    print("This could mean:")
    print("  - Process was interrupted before completion")
    print("  - completeSession() was not called on exit")
    print("  - Error occurred during completion")
    exit(1)
else:
    print()
    print("❌❌❌ SESSION COMPLETION VERIFICATION: FAILED ❌❌❌")
    print()
    print("Session completed but tool_usage_stats missing.")
    print("Check getToolUsageStats() implementation.")
    exit(1)

PYTHON_SCRIPT

echo ""
echo "=========================================="
echo "Check /tmp/opencode-session-test.log for detailed execution logs"
echo "=========================================="
