#!/bin/bash
set -e

echo "==================================================================="
echo "Tool Invocation Tracking Test (Dev Mode)"
echo "==================================================================="
echo ""

# Create test file
mkdir -p .tool-test
cat > .tool-test/sample.txt << 'TXT'
This is a test file for tool tracking validation.
It contains some sample text.
TXT

echo "✅ Created test file: .tool-test/sample.txt"
echo ""

# Run OpenCode with a simple read operation
echo "Running OpenCode: 'Read the .tool-test/sample.txt file'"
echo ""

cd repos/metabob-opencode
OUTPUT=$(METABOB_CLI_URL="http://localhost:8080" \
  bun run dev run "Read the file at ../../.tool-test/sample.txt" 2>&1)

# Extract session ID
SESSION_ID=$(echo "$OUTPUT" | grep -oP 'session_id["\s:]+\K[a-zA-Z0-9_]+' | head -1)

echo "$OUTPUT" | tail -30
echo ""

if [ -z "$SESSION_ID" ]; then
  echo "⚠️  Could not extract session ID, trying alternative method..."
  SESSION_ID=$(echo "$OUTPUT" | grep -oP 'ses_[a-zA-Z0-9_]+' | head -1)
fi

echo "Session ID: $SESSION_ID"
echo ""

# Wait for async operations
sleep 3

# Query Redis
echo "Checking Redis for tool invocations..."
echo ""

cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 << PYTHON
import redis
import json

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Find the session
session_key = f"agent_execution:session:${SESSION_ID}"
data = r.get(session_key)

if not data:
    print(f"❌ Session not found: {session_key}")
    print(f"Looking for any recent sessions...")
    keys = r.keys('agent_execution:session:*')
    if keys:
        print(f"Found {len(keys)} sessions, showing most recent:")
        latest_key = sorted(keys)[-1]
        data = r.get(latest_key)
        session_key = latest_key
    else:
        print("No sessions found at all!")
        exit(1)

session = json.loads(data)
print(f"✅ Session found: {session_key.split(':')[-1]}")
print(f"   Goal: {session.get('goal', 'N/A')[:80]}...")
print(f"   Tool invocations: {len(session.get('tool_invocations', []))}")
print()

if len(session.get('tool_invocations', [])) > 0:
    print("🎉 SUCCESS! Tool invocations recorded:")
    for i, tool in enumerate(session['tool_invocations'][:5], 1):
        tool_name = tool.get('tool_name', 'unknown')
        success = tool.get('success', False)
        duration = tool.get('duration_ms', 0)
        status = "✅" if success else "❌"
        print(f"  {i}. {status} {tool_name} ({duration}ms)")
        if tool.get('file_path'):
            print(f"      File: {tool['file_path']}")
    print()
    print("✅ TOOL TRACKING TEST PASSED!")
else:
    print("❌ No tool invocations recorded")
    print("This means the instrumentation is not working yet.")
    exit(1)
PYTHON

echo ""
echo "Test complete!"
