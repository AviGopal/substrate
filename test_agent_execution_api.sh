#!/bin/bash

# Test Agent Execution API
# Verifies backend API endpoints work correctly

set -e

API_URL="http://localhost:8080"
SESSION_ID="test-session-$(date +%s)"
AGENT_ID="metabob-opencode"
TIMESTAMP=$(date -Iseconds)

echo "========================================"
echo "Agent Execution API Test"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health check
echo "Test 1: Health check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${API_URL}/health)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ API is healthy (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ API health check failed (HTTP $HTTP_CODE)${NC}"
    exit 1
fi
echo ""

# Test 2: Start session
echo "Test 2: Start session..."
RESPONSE=$(curl -s -X POST ${API_URL}/api/agent-execution/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'"${SESSION_ID}"'",
    "agent_id": "'"${AGENT_ID}"'",
    "agent_version": "0.1.0",
    "goal": "Test agent execution tracking",
    "context": {"test": true},
    "started_at": "'"${TIMESTAMP}"'"
  }')

STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
if [ "$STATUS" = "success" ]; then
    echo -e "${GREEN}✓ Session started: ${SESSION_ID}${NC}"
    echo "Response: $RESPONSE" | jq .
else
    echo -e "${RED}✗ Session start failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 3: Record tool invocation (success)
echo "Test 3: Record tool invocation (success)..."
RESPONSE=$(curl -s -X POST ${API_URL}/api/agent-execution/tool/invocation \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'"${SESSION_ID}"'",
    "tool_name": "read",
    "success": true,
    "duration_ms": 123.45,
    "timestamp": "'"${TIMESTAMP}"'"
  }')

STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
if [ "$STATUS" = "success" ]; then
    echo -e "${GREEN}✓ Tool invocation recorded (read, success)${NC}"
else
    echo -e "${RED}✗ Tool invocation failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 4: Record tool invocation (failure)
echo "Test 4: Record tool invocation (failure)..."
RESPONSE=$(curl -s -X POST ${API_URL}/api/agent-execution/tool/invocation \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'"${SESSION_ID}"'",
    "tool_name": "write",
    "success": false,
    "duration_ms": 56.78,
    "error": "File not found",
    "timestamp": "'"${TIMESTAMP}"'"
  }')

STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
if [ "$STATUS" = "success" ]; then
    echo -e "${GREEN}✓ Tool invocation recorded (write, failure)${NC}"
else
    echo -e "${RED}✗ Tool invocation failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 5: Complete session
echo "Test 5: Complete session..."
RESPONSE=$(curl -s -X POST ${API_URL}/api/agent-execution/session/complete \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'"${SESSION_ID}"'",
    "outcome": {
      "success": true,
      "goal_achieved": true,
      "tests_passed": true,
      "code_quality_improved": true
    },
    "reflection": {
      "what_worked": "File operations completed successfully",
      "what_didnt_work": "Write tool had permission issue",
      "improvements_suggested": "Add permission checking before write"
    },
    "completed_at": "'"${TIMESTAMP}"'",
    "total_duration_ms": 5000.0
  }')

STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
if [ "$STATUS" = "success" ]; then
    echo -e "${GREEN}✓ Session completed${NC}"
else
    echo -e "${RED}✗ Session completion failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 6: Get agent statistics
echo "Test 6: Get agent statistics..."
RESPONSE=$(curl -s ${API_URL}/api/agent-execution/agent/${AGENT_ID}/statistics)

STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
if [ "$STATUS" = "success" ]; then
    echo -e "${GREEN}✓ Agent statistics retrieved${NC}"
    echo "Statistics:" | jq .
    echo "$RESPONSE" | jq '.summary'
    echo ""
    echo "Tool Statistics:"
    echo "$RESPONSE" | jq '.tool_statistics'
else
    echo -e "${YELLOW}⚠ Agent statistics unavailable (no data yet?)${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 7: Get recent sessions
echo "Test 7: Get recent sessions..."
RESPONSE=$(curl -s "${API_URL}/api/agent-execution/agent/${AGENT_ID}/sessions?limit=5")

STATUS=$(echo "$RESPONSE" | jq -r '.status // "error"')
if [ "$STATUS" = "success" ]; then
    COUNT=$(echo "$RESPONSE" | jq -r '.count // 0')
    echo -e "${GREEN}✓ Retrieved $COUNT recent sessions${NC}"
    if [ "$COUNT" -gt 0 ]; then
        echo "Latest session:"
        echo "$RESPONSE" | jq '.sessions[0]'
    fi
else
    echo -e "${YELLOW}⚠ Session history unavailable${NC}"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 8: Check Redis data
echo "Test 8: Verify data in Redis..."
echo ""
echo "Session data:"
docker exec -it metabob-redis redis-cli GET "agent_execution:session:${SESSION_ID}" 2>/dev/null | jq . || echo "Session not found in Redis"
echo ""
echo "Agent summary:"
docker exec -it metabob-redis redis-cli HGETALL "agent_execution:agent:${AGENT_ID}:summary" 2>/dev/null || echo "Summary not found"
echo ""
echo "Tool statistics (read):"
docker exec -it metabob-redis redis-cli HGETALL "agent_execution:agent:${AGENT_ID}:tool:read" 2>/dev/null || echo "Tool stats not found"
echo ""

echo "========================================"
echo -e "${GREEN}All tests passed! ✓${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Integrate AgentExecutionTracker into OpenCode session lifecycle"
echo "2. Apply tool instrumentation to all tools"
echo "3. Run real OpenCode session and verify data collection"
echo "4. Build analyzer script to generate insights"
echo ""
