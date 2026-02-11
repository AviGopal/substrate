#!/bin/bash
# Test MCP Tool Calls Directly via metabob-cli

echo "==================================================================="
echo "Direct MCP Tool Call Test"
echo "==================================================================="

# The metabob-cli MCP server is running in the container on stdio
# We need to send JSON-RPC messages to it

# Create a test to call search_activities via metabob-cli directly
echo ""
echo "[1] Testing metabob-cli search_activities via backend API..."

# Get session token
SESSION_TOKEN=$(curl -s -X POST "http://localhost:8080/v2/session" \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test-mcp-direct"}' | jq -r '.metadata.session_token')

echo "✓ Backend session: ${SESSION_TOKEN:0:30}..."

# Search activities via backend
ACTIVITIES=$(curl -s "http://localhost:8080/v2/activities/templates?category=refactor&limit=3" \
  -H "Authorization: Bearer ${SESSION_TOKEN}")

ACTIVITY_COUNT=$(echo "$ACTIVITIES" | jq '.total')
echo "✓ Backend has ${ACTIVITY_COUNT} activities"

if [ "$ACTIVITY_COUNT" -gt 0 ]; then
  echo ""
  echo "Sample activity from backend:"
  echo "$ACTIVITIES" | jq '.templates[0] | {variant_id, variant_name, task_count: (.task_steps | length)}'
fi

echo ""
echo "[2] Testing OpenCode's search_activities tool..."

# Create OpenCode session
OC_SESSION=$(curl -s -X POST "http://localhost:3004/session" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq -r '.id')

echo "✓ OpenCode session: ${OC_SESSION}"

# Send message to trigger search_activities
echo "   Sending message: 'Use search_activities tool to find refactor activities'"

curl -s -X POST "http://localhost:3004/session/${OC_SESSION}/message" \
  -H 'Content-Type: application/json' \
  -d '{
    "parts": [{
      "type": "text",
      "text": "Use the search_activities tool with category=\"refactor\" and limit=3. Show me the exact tool output."
    }]
  }' > /tmp/message_response.json

MSG_ID=$(jq -r '.id' /tmp/message_response.json)
echo "✓ Message sent: ${MSG_ID}"

echo ""
echo "[3] Waiting for agent response (20 seconds)..."
sleep 20

# Get messages
MESSAGES=$(curl -s "http://localhost:3004/session/${OC_SESSION}/messages")
LAST_MSG=$(echo "$MESSAGES" | jq -r 'if type=="array" then .[0].content // "no content" else "error: \(.)\"  end' | head -40)

echo "Agent response:"
echo "$LAST_MSG"

echo ""
echo "==================================================================="
echo "Analysis:"
echo "==================================================================="
if echo "$LAST_MSG" | grep -q "activities.*count\|Found.*activities"; then
  echo "✓ search_activities tool appears to be working!"
else
  echo "⚠ search_activities tool may not be returning results"
  echo "   Check if agent saw tool output or if it's empty"
fi

echo ""
echo "Manual verification:"
echo "  curl http://localhost:3004/session/${OC_SESSION}/messages | jq '.'"
