#!/bin/bash
# Test activity execution by calling MCP tools directly
set -e

echo "=== Testing Activity Execution Trace ==="
echo ""

# Check if we can query activities from the database via API
echo "1. Checking database for registered activities..."
curl -s http://localhost:8080/activity/search \
  -H "Content-Type: application/json" \
  -d '{"query": "", "limit": 10}' | jq -r '.activities[] | "\(.variant_id) - \(.name // "unnamed")"' || echo "API call failed"

echo ""
echo "2. Checking what MCP tools are available in devbob-opencode..."
docker exec devbob-opencode sh -c 'command -v metabob-cli && metabob-cli mcp-tools list 2>&1 | head -30' || echo "Tool listing failed"

echo ""
echo "=== Test Complete ==="

