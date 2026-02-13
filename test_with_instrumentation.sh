#!/bin/bash

# Start MCP server and capture logs
rm -f .metabob/mcp_test.log

metabob-cli mcp --transport stdio 2>&1 | tee .metabob/mcp_test.log &
MCP_PID=$!

sleep 2

# Send initialize
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' 

sleep 1

# Send search_activities
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_activities","arguments":{"query":"","limit":3}}}'

# Wait for response or timeout
sleep 8

# Kill server
kill $MCP_PID 2>/dev/null

# Show timing logs
echo ""
echo "=== TIMING ANALYSIS ==="
grep -E "TIMING|TOOL_START|TOOL_COMPLETE|TOOL_ERROR|SERVER started|Starting background" .metabob/mcp_test.log | head -30

