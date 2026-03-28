#!/bin/bash
# Simple MCP server test via stdio

set -e

cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-mcp

export ANALYSIS_API_URL=http://localhost:8081
export SESSION_ID=simple-test
export LOG_LEVEL=info
export HEALTH_PORT=8082

echo "Starting MCP server test..."
echo ""

# Test 1: List tools
echo "=== Test 1: List Tools ==="
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | bun run src/index.ts 2>&1 | grep -v '^\[' | head -1 | jq '.result.tools | length'
echo ""

# Test 2: Call get_priority_issues
echo "=== Test 2: Get Priority Issues ==="
(
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_priority_issues","arguments":{"limit":5}}}'
) | timeout 10s bun run src/index.ts 2>&1 | grep -v '^\[' | grep '"id":2' | jq '.result.content[0].text | fromjson | .issues | length'
echo ""

echo "Tests completed!"
