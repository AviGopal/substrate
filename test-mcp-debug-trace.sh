#!/bin/bash
# MCP Debug Trace - Detailed logging of MCP tool calls

set -e

BASE_URL="http://localhost:3004"
CONTAINER="devbob-opencode"

echo "==================================================================="
echo "MCP Debug Trace"
echo "==================================================================="

# Get current log size to know where to start reading from
echo ""
echo "[1] Capturing baseline log position..."
BASELINE_LINES=$(docker logs "$CONTAINER" 2>&1 | wc -l)
echo "✓ Baseline: ${BASELINE_LINES} lines"

# Create a test session
echo ""
echo "[2] Creating OpenCode session..."
SESSION_ID=$(curl -s -X POST "${BASE_URL}/session" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq -r '.id')

echo "✓ Session: ${SESSION_ID}"

# Send a message that will trigger search_activities
echo ""
echo "[3] Sending message to trigger search_activities tool..."
echo "   Message: 'Call search_activities with category=refactor and limit=3'"

MSG_RESPONSE=$(curl -s -X POST "${BASE_URL}/session/${SESSION_ID}/message" \
  -H 'Content-Type: application/json' \
  -d '{
    "parts": [{
      "type": "text", 
      "text": "Use the search_activities tool RIGHT NOW with these exact parameters: category=\"refactor\", limit=3. Show me the raw tool output."
    }]
  }')

MSG_ID=$(echo "$MSG_RESPONSE" | jq -r '.id')
echo "✓ Message ID: ${MSG_ID}"

# Wait for processing
echo ""
echo "[4] Waiting for tool execution (15 seconds)..."
sleep 15

# Capture new logs since baseline
echo ""
echo "[5] Extracting MCP-related logs..."
docker logs "$CONTAINER" 2>&1 | tail -n +$((BASELINE_LINES + 1)) > /tmp/mcp_trace.log

# Analyze the logs
echo ""
echo "==================================================================="
echo "MCP Call Trace Analysis"
echo "==================================================================="

# Check for callMCPTool
echo ""
echo "[A] callMCPTool invocations:"
grep -i "callMCPTool" /tmp/mcp_trace.log || echo "   (none found)"

# Check for metabob tool execution
echo ""
echo "[B] Metabob tool execution:"
grep -i "executing metabob tool\|metabob tool execution" /tmp/mcp_trace.log || echo "   (none found)"

# Check for available tools
echo ""
echo "[C] Available metabob tools:"
grep -i "available metabob tools" /tmp/mcp_trace.log || echo "   (none found)"

# Check for search_activities specifically
echo ""
echo "[D] search_activities calls:"
grep -i "search_activities\|searchActivities" /tmp/mcp_trace.log || echo "   (none found)"

# Check for MCP errors
echo ""
echo "[E] MCP errors:"
grep -i "mcp.*error\|mcp.*fail" /tmp/mcp_trace.log || echo "   (none found)"

# Check for tool results
echo ""
echo "[F] Tool results/content:"
grep -i "tool.*complete\|hasContent\|parsed.*JSON" /tmp/mcp_trace.log || echo "   (none found)"

# Check for metabob client
echo ""
echo "[G] Metabob client status:"
grep -i "metabob.*client\|metabob mcp" /tmp/mcp_trace.log || echo "   (none found)"

echo ""
echo "==================================================================="
echo "Full MCP Trace (last 50 relevant lines):"
echo "==================================================================="
grep -i "metabob\|mcp\|search.*activit\|tool.*call" /tmp/mcp_trace.log | tail -50 || echo "(no relevant logs found)"

echo ""
echo "==================================================================="
echo "Log Analysis Summary"
echo "==================================================================="

# Count occurrences
CALL_COUNT=$(grep -c "callMCPTool starting" /tmp/mcp_trace.log 2>/dev/null || echo "0")
EXEC_COUNT=$(grep -c "executing metabob tool" /tmp/mcp_trace.log 2>/dev/null || echo "0")
COMPLETE_COUNT=$(grep -c "tool execution complete" /tmp/mcp_trace.log 2>/dev/null || echo "0")
ERROR_COUNT=$(grep -c -i "error\|fail" /tmp/mcp_trace.log 2>/dev/null || echo "0")

echo "Call attempts:    ${CALL_COUNT}"
echo "Executions:       ${EXEC_COUNT}"
echo "Completions:      ${COMPLETE_COUNT}"
echo "Errors:           ${ERROR_COUNT}"

if [ "$CALL_COUNT" -eq "0" ]; then
  echo ""
  echo "⚠️  ISSUE: No callMCPTool invocations found!"
  echo "   This means search_activities tool is not calling the MCP layer."
  echo "   Check: Is the tool using MetabobCLI.searchActivities()?"
elif [ "$EXEC_COUNT" -eq "0" ]; then
  echo ""
  echo "⚠️  ISSUE: callMCPTool started but no tool execution!"
  echo "   Possible causes:"
  echo "   - Metabob client not available"
  echo "   - Tool not found in available tools"
  echo "   - listTools() failed"
elif [ "$COMPLETE_COUNT" -eq "0" ]; then
  echo ""
  echo "⚠️  ISSUE: Tool execution started but never completed!"
  echo "   Possible causes:"
  echo "   - Timeout (15 second limit)"
  echo "   - MCP client hung"
  echo "   - Exception thrown"
else
  echo ""
  echo "✓ MCP calls appear to be executing"
  echo "  Check logs above for result content"
fi

echo ""
echo "==================================================================="
echo "Detailed Investigation Commands:"
echo "==================================================================="
echo ""
echo "1. View full trace:"
echo "   cat /tmp/mcp_trace.log"
echo ""
echo "2. Check agent response:"
echo "   curl http://localhost:3004/session/${SESSION_ID}/messages | jq '.'"
echo ""
echo "3. Check metabob-cli process:"
echo "   docker exec ${CONTAINER} ps aux | grep metabob-cli"
echo ""
echo "4. Test backend directly:"
echo "   python3 test-mcp-search-working.py"
echo ""
echo "5. View all logs with service tags:"
echo "   docker logs ${CONTAINER} 2>&1 | grep service=metabob"
echo ""
echo "==================================================================="

# Save full log for inspection
cp /tmp/mcp_trace.log /tmp/mcp_trace_$(date +%s).log
echo "Full trace saved to: /tmp/mcp_trace_$(date +%s).log"
