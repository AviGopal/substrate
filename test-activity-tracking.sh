#!/bin/bash
set -e

echo "🧪 Testing Agent Execution Activity Tracking"
echo "=============================================="
echo ""

# Configuration
OPENCODE_BIN="/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode"
TEST_DIR="/tmp/activity-tracking-test-$$"
BACKEND_URL="http://localhost:8080"
SURREAL_URL="http://localhost:8000"

echo "📁 Creating test directory: $TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Initialize a simple project
echo "📝 Creating test files..."
cat > test.js << 'EOF'
function add(a, b) {
  return a + b;
}

module.exports = { add };
EOF

cat > opencode.json << EOF
{
  "model": "anthropic/claude-sonnet-4",
  "temperature": 0.0,
  "mcp": {
    "metabob": {
      "enabled": true,
      "command": "docker",
      "args": ["exec", "-i", "metabob-cli", "python", "-m", "metabob_cli.mcp.server"],
      "env": {}
    }
  }
}
EOF

# Initialize git
git init
git config user.email "test@example.com"
git config user.name "Test User"
git add .
git commit -m "Initial commit"

echo ""
echo "✅ Test project initialized"
echo ""

# Get session count before
BEFORE_COUNT=$(echo "SELECT count() as count FROM agent_executions;" | docker exec -i metabob-surreal /surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db cli 2>/dev/null | grep -A1 "count" | tail -1 | tr -d ' ' || echo "0")

echo "📊 Sessions in DB before: $BEFORE_COUNT"
echo ""

# Execute a simple activity (if any exist)
echo "🚀 Executing test activity..."
echo "   This will test the recordActivityUsage() call"
echo ""

# Try to execute an activity - we'll use a simple inline prompt
"$OPENCODE_BIN" chat --mode activity <<'PROMPT'
Create a simple test file called hello.txt with the content "Hello World"
PROMPT

echo ""
echo "⏳ Waiting for data to be written to database..."
sleep 3

# Check if session was recorded
echo ""
echo "📊 Querying agent_executions table..."
echo "SELECT session_id, agent_id, goal, array::len(activities_used) as activity_count FROM agent_executions ORDER BY created_at DESC LIMIT 1;" | docker exec -i metabob-surreal /surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db cli --pretty

echo ""
echo "✅ Test complete!"
echo ""
echo "🔍 To inspect full session data, run:"
echo "   echo 'SELECT * FROM agent_executions ORDER BY created_at DESC LIMIT 1;' | docker exec -i metabob-surreal /surreal sql --conn http://localhost:8000 --user root --pass root --ns metabob --db cli --pretty"

# Cleanup
cd /
rm -rf "$TEST_DIR"
