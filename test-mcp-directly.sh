#!/bin/bash
# Test metabob-cli MCP server directly

# Start MCP server in background
METABOB_API_KEY=test-api-key \
METABOB_API_URL=http://localhost:8080 \
METABOB_PROJECT_ID=metabob-devbob \
METABOB_ORG_ID=test-org \
metabob-cli mcp --transport stdio > /tmp/mcp-server.log 2>&1 &

MCP_PID=$!
echo "Started MCP server (PID: $MCP_PID)"
sleep 3

# Test 1: List tools
echo ""
echo "=== Test 1: List Tools ==="
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | nc localhost 3100 2>/dev/null || echo "Connection failed"

# Clean up
kill $MCP_PID 2>/dev/null
