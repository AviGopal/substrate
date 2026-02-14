#!/bin/bash
# Test OpenCode session tracking integration

set -e

WORKSPACE="/home/avi/documents/work/exp-repo/metabob-devbob/test-workspace"
REDIS_CONTAINER="metabob-redis"

echo "======================================================================"
echo "OpenCode Session Tracking Test"
echo "======================================================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! docker ps | grep -q "$REDIS_CONTAINER"; then
    echo "❌ Redis container not running"
    exit 1
fi
echo "✅ Redis is running"
echo ""

# Clear old test sessions
echo "Clearing old test sessions..."
OLD_COUNT=$(docker exec $REDIS_CONTAINER redis-cli KEYS "agent_execution:session:*" | wc -l)
echo "   Found $OLD_COUNT existing sessions"
echo ""

# Create a simple test file
echo "Setting up test workspace..."
cd "$WORKSPACE"
echo "def hello():\n    print('Hello, World!')" > test_tracking.py
echo "✅ Created test_tracking.py"
echo ""

# Get session count before
SESSIONS_BEFORE=$(docker exec $REDIS_CONTAINER redis-cli KEYS "agent_execution:session:*" | wc -l)
echo "Sessions before OpenCode run: $SESSIONS_BEFORE"
echo ""

# Test with OpenCode
echo "======================================================================"
echo "Running OpenCode with session tracking..."
echo "======================================================================"
echo ""
echo "Command: echo 'Read test_tracking.py and explain what it does' | opencode run"
echo ""

# Run OpenCode with a simple command
cd "$WORKSPACE"
echo "Read test_tracking.py and explain what it does" | timeout 30s opencode run 2>&1 | tee /tmp/opencode-test-output.log || {
    EXIT_CODE=$?
    echo ""
    echo "OpenCode command finished (exit code: $EXIT_CODE)"
}

echo ""
echo "======================================================================"
echo "Checking Results"
echo "======================================================================"
echo ""

# Wait a moment for async operations
sleep 2

# Get session count after
SESSIONS_AFTER=$(docker exec $REDIS_CONTAINER redis-cli KEYS "agent_execution:session:*" | wc -l)
echo "Sessions after OpenCode run: $SESSIONS_AFTER"

NEW_SESSIONS=$((SESSIONS_AFTER - SESSIONS_BEFORE))
echo "New sessions created: $NEW_SESSIONS"
echo ""

if [ $NEW_SESSIONS -gt 0 ]; then
    echo "✅ Session tracking detected!"
    echo ""
    echo "Latest sessions:"
    docker exec $REDIS_CONTAINER redis-cli KEYS "agent_execution:session:*" | tail -5
    echo ""
    
    # Get the latest session
    LATEST_SESSION=$(docker exec $REDIS_CONTAINER redis-cli KEYS "agent_execution:session:*" | tail -1)
    if [ -n "$LATEST_SESSION" ]; then
        echo "Latest session details:"
        echo "----------------------"
        docker exec $REDIS_CONTAINER redis-cli GET "$LATEST_SESSION" | python3 -m json.tool 2>/dev/null || docker exec $REDIS_CONTAINER redis-cli GET "$LATEST_SESSION"
    fi
else
    echo "⚠️  No new sessions created"
    echo ""
    echo "This could mean:"
    echo "1. First message detection didn't trigger (check debug logs)"
    echo "2. OpenCode command failed before session start"
    echo "3. MCP tool call failed silently"
    echo ""
    echo "Check OpenCode output above for debug logs starting with:"
    echo "  - '[SessionPrompt] Checking first message...'"
    echo "  - '[AgentExecutionTracker] Starting session...'"
fi

echo ""
echo "======================================================================"
echo "Test Complete"
echo "======================================================================"
