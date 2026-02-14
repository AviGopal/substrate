#!/bin/bash

# Simple test: List files (should trigger 'list' tool)
# This is a tool that completes quickly and we can verify execution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=================================="
echo "Testing Tool Tracking (Simple)"
echo "=================================="
echo ""

# Clean up any previous test data
echo "Step 1: Cleaning Redis test data..."
python3 scripts/cleanup-redis-test-sessions.py 2>/dev/null || true
echo ""

# Run OpenCode with a simple command that uses the 'list' tool
echo "Step 2: Running OpenCode with 'List files in current directory'..."
echo "This should trigger the 'list' tool"
echo ""

cd repos/metabob-opencode
timeout 60s bun run dev run "List all files in the current directory" 2>&1 | tee /tmp/opencode-test-output.log || true
cd "$REPO_ROOT"

echo ""
echo "Step 3: Checking Redis for session data..."
echo ""

# Give it a moment for async operations to complete
sleep 2

# Check Redis for session and tool invocations
python3 - <<'PYTHON_SCRIPT'
import redis
import json

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Find all agent_execution:session:* keys
keys = r.keys('agent_execution:session:*')

print(f"Found {len(keys)} session(s) in Redis\n")

if not keys:
    print("❌ NO SESSIONS FOUND - Session tracking may not be working")
    exit(1)

# Check the most recent session
for key in sorted(keys, reverse=True)[:1]:
    session_data = r.get(key)
    if session_data:
        data = json.loads(session_data)
        session_id = key.split(':')[-1]
        goal = data.get('goal', 'N/A')
        tool_count = len(data.get('tool_invocations', []))
        
        print(f"Session: {session_id}")
        print(f"  Goal: {goal}")
        print(f"  Tool invocations: {tool_count}")
        
        if tool_count > 0:
            print("  ✅ TOOL INVOCATIONS FOUND!")
            print("\n  Tools used:")
            for inv in data.get('tool_invocations', []):
                print(f"    - {inv['tool_name']}: {'✅ success' if inv['success'] else '❌ failed'} ({inv['duration_ms']}ms)")
        else:
            print("  ❌ NO TOOL INVOCATIONS RECORDED")
            print("\n  This might mean:")
            print("    1. Tools didn't execute (command may have failed)")
            print("    2. Tool tracking code isn't being called")
            print("    3. recordToolCall() is failing silently")
            print("\n  Check /tmp/opencode-test-output.log for debug output")

PYTHON_SCRIPT

echo ""
echo "=================================="
echo "Check /tmp/opencode-test-output.log for detailed debug output"
echo "Look for lines starting with [TOOL-EXEC] and [TRACKER]"
echo "=================================="
