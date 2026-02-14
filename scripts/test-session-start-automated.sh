#!/bin/bash
#
# Automated test for agent execution tracking session start
# 
# This script:
# 1. Checks baseline (zero sessions)
# 2. Starts an OpenCode session with a simple prompt
# 3. Verifies session was recorded in backend
#

set -e

echo "============================================================"
echo "Automated Agent Execution Tracking Test"
echo "============================================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check backend
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ ERROR: Backend not accessible"
    exit 1
fi
echo "✅ Backend is running"

# Check Redis
if ! docker exec metabob-redis redis-cli PING > /dev/null 2>&1; then
    echo "❌ ERROR: Redis not accessible"
    exit 1
fi
echo "✅ Redis is accessible"

# Check OpenCode
if ! which opencode > /dev/null 2>&1; then
    echo "❌ ERROR: OpenCode CLI not found"
    exit 1
fi
echo "✅ OpenCode CLI found"
echo ""

# Check baseline
echo "Checking baseline sessions in Redis..."
BASELINE_COUNT=$(docker exec metabob-redis redis-cli KEYS "agent_execution:session:*" | wc -l)
echo "Baseline sessions: $BASELINE_COUNT"
echo ""

# Create test workspace
TEST_DIR="/tmp/opencode-test-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Test workspace: $TEST_DIR"
echo ""

# Create a simple test file to interact with
echo "def hello():" > test.py
echo "    return 'world'" >> test.py

echo "Starting OpenCode session..."
echo "Sending prompt: 'Read test.py and create a summary.txt file'"
echo ""

# Start OpenCode with a simple prompt that will:
# 1. Trigger session start (first message)
# 2. Execute read tool (test.py)
# 3. Execute write tool (summary.txt)
# 4. Exit cleanly

# Use echo to pipe the prompt to OpenCode, then Ctrl+D to exit
echo "Read test.py and create a summary.txt file with one line describing what the function does." | timeout 30 opencode agent --session-id "test-session-$(date +%s)" 2>&1 | head -50 &
OPENCODE_PID=$!

echo "OpenCode started (PID: $OPENCODE_PID)"
echo "Waiting 10 seconds for session to initialize..."
sleep 10

# Check if session was created
echo ""
echo "Checking for new sessions..."
CURRENT_COUNT=$(docker exec metabob-redis redis-cli KEYS "agent_execution:session:*" | wc -l)
echo "Current sessions: $CURRENT_COUNT"

if [ "$CURRENT_COUNT" -gt "$BASELINE_COUNT" ]; then
    echo "✅ SUCCESS: New session detected!"
    echo ""
    
    # Get session data
    echo "Session details:"
    SESSION_KEY=$(docker exec metabob-redis redis-cli KEYS "agent_execution:session:*" | head -1)
    docker exec metabob-redis redis-cli GET "$SESSION_KEY" | jq '.' 2>/dev/null || docker exec metabob-redis redis-cli GET "$SESSION_KEY"
    
    echo ""
    echo "✅ TEST PASSED: Session start tracking is working!"
    
    # Kill OpenCode if still running
    kill $OPENCODE_PID 2>/dev/null || true
    
    exit 0
else
    echo "❌ FAIL: No new sessions detected"
    echo ""
    echo "Debugging information:"
    echo "  - OpenCode PID: $OPENCODE_PID (running: $(ps -p $OPENCODE_PID > /dev/null && echo 'yes' || echo 'no'))"
    echo "  - Test directory: $TEST_DIR"
    echo "  - Expected: session should be created on first message"
    
    # Kill OpenCode if still running
    kill $OPENCODE_PID 2>/dev/null || true
    
    exit 1
fi
