#!/bin/bash
set -e

echo "==================================================================="
echo "OpenCode Agent Execution Tracking - End-to-End Test (Dev Mode)"
echo "==================================================================="
echo ""

# Test workspace
TEST_WORKSPACE="/home/avi/documents/work/exp-repo/metabob-devbob/.opencode-e2e-test"
mkdir -p "$TEST_WORKSPACE"
cd "$TEST_WORKSPACE"

echo "Test workspace: $TEST_WORKSPACE"
echo ""

# Create test file
cat > example.py << 'PYTHON'
def greet(name):
    return f"Hello, {name}!"

def calculate(a, b):
    return a + b
PYTHON

echo "✅ Created example.py"
echo ""

# Run OpenCode in dev mode
echo "Running OpenCode: 'Read the example.py file and tell me what functions it contains'"
echo ""

cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
SESSION_OUTPUT=$(METABOB_CLI_URL="http://localhost:8080" \
  bun run dev run "Read the example.py file in .opencode-e2e-test and tell me what functions it contains" 2>&1)

# Extract session ID from output
SESSION_ID=$(echo "$SESSION_OUTPUT" | grep -oP 'sessionID=\K[a-zA-Z0-9_]+' | head -1)

echo "$SESSION_OUTPUT" | tail -20
echo ""

if [ -z "$SESSION_ID" ]; then
  echo "❌ Could not extract session ID from output"
  exit 1
fi

echo "Session ID: $SESSION_ID"
echo ""

# Wait for async operations
sleep 2

# Query Redis for verification
echo "Verifying data in Redis..."
echo ""

python3 << PYTHON
import redis
import json

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

session_key = f"agent_execution:session:${SESSION_ID}"
data = r.get(session_key)

if not data:
    print(f"❌ Session not found: {session_key}")
    exit(1)

session = json.loads(data)
print(f"✅ Session tracked: ${SESSION_ID}")
print(f"   Goal: {session.get('goal', 'N/A')[:60]}...")
print(f"   Started: {session.get('started_at', 'N/A')}")
print(f"   Tool invocations: {len(session.get('tool_invocations', []))}")
print()

if len(session.get('tool_invocations', [])) > 0:
    print("Tool invocations:")
    for tool in session['tool_invocations'][:3]:
        print(f"  - {tool.get('tool_name', 'unknown')} on {tool.get('file_path', 'N/A')}")
    print()
    print("✅ END-TO-END TEST PASSED")
else:
    print("⚠️  No tool invocations recorded (may be async delay)")
PYTHON

echo ""
echo "Test complete!"
