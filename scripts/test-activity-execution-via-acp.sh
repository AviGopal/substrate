#!/bin/bash
# Test activity execution by delegating task via ACP

set -e

echo "=== Testing Activity Execution via ACP ==="
echo ""

ACP_URL="http://localhost:3004"

echo "1. Checking if ACP server is reachable..."
if curl -s --max-time 5 "$ACP_URL" > /dev/null 2>&1; then
    echo "   ✓ ACP server is reachable"
else
    echo "   ✗ ACP server not reachable at $ACP_URL"
    exit 1
fi

echo ""
echo "2. Delegating activity discovery task..."
echo "   Task: 'Search for all available activities and list them'"
echo ""

# Create a simple task delegation request
TASK_PAYLOAD=$(cat <<PAYLOAD_EOF
{
  "taskDescription": "Search for activities",
  "prompt": "Use search_activities to find all available activity templates. List what you find.",
  "timeout": 60
}
PAYLOAD_EOF
)

echo "   Sending request to ACP..."
RESPONSE=$(curl -s -X POST "$ACP_URL/delegate" \
  -H "Content-Type: application/json" \
  -d "$TASK_PAYLOAD" 2>&1)

echo ""
echo "   Response:"
echo "$RESPONSE" | head -50

echo ""
echo "=== Test Complete ==="

