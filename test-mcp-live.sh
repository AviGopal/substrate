#!/bin/bash
set -e

echo "🔍 Testing MCP Communication - Live Runtime Validation"
echo "========================================================="
echo ""

# Check RPC API status
echo "1. Checking RPC API Status..."
kubectl get pods -l app=metabob-rpc-api --no-headers | awk '{print "   Pod:", $1, "Status:", $3}'
echo ""

# Check for running MCP processes
echo "2. Checking for MCP Processes..."
MCP_COUNT=$(ps aux | grep "metabob-cli mcp" | grep -v grep | wc -l)
if [ $MCP_COUNT -eq 0 ]; then
    echo "   ⚠️  No metabob-cli MCP processes running"
else
    echo "   ✅ Found $MCP_COUNT metabob-cli MCP process(es)"
    ps aux | grep "metabob-cli mcp" | grep -v grep | awk '{print "      PID:", $2, "CPU:", $3"%", "Started:", $9}'
fi
echo ""

# Check for OpenCode processes
echo "3. Checking for OpenCode Processes..."
OPENCODE_COUNT=$(ps aux | grep "opencode" | grep -v grep | wc -l)
if [ $OPENCODE_COUNT -eq 0 ]; then
    echo "   ⚠️  No OpenCode processes running"
else
    echo "   ✅ Found $OPENCODE_COUNT OpenCode process(es)"
    ps aux | grep "opencode" | grep -v grep | head -3 | awk '{print "      PID:", $2, "CPU:", $3"%", "MEM:", $4"%"}'
fi
echo ""

# Test API connectivity
echo "4. Testing API Connectivity..."
API_RESPONSE=$(timeout 2 curl -s -o /dev/null -w "%{http_code}" http://api.metabob.local/ 2>&1 || echo "timeout")
if [ "$API_RESPONSE" = "timeout" ]; then
    echo "   ⚠️  API connection timed out"
elif [ "$API_RESPONSE" = "200" ]; then
    echo "   ✅ API responding (HTTP 200)"
else
    echo "   ⚠️  API returned HTTP $API_RESPONSE"
fi
echo ""

# Check MCP logs
echo "5. Recent MCP Activity (last 10 lines)..."
if [ -f /tmp/live-mcp-logs.txt ]; then
    tail -10 /tmp/live-mcp-logs.txt | sed 's/^/   /'
else
    echo "   ⚠️  No MCP logs found at /tmp/live-mcp-logs.txt"
fi
echo ""

# Start a fresh MCP server for testing
echo "6. Starting Fresh MCP Server for Testing..."
echo "   Starting metabob-cli MCP in background..."

# Kill any existing MCP processes first
pkill -f "metabob-cli mcp" 2>/dev/null || true
sleep 1

# Start MCP server with stdio transport
cd repos/metabob-cli
export METABOB_API_KEY="mb_devbob_test_simple_2026_v2"
export METABOB_API_URL="http://api.metabob.local"

# Start in background and capture startup
timeout 15 python -m metabob_cli.mcp.server --transport stdio 2>&1 | tee /tmp/mcp-test-startup.log &
MCP_PID=$!

echo "   MCP Server PID: $MCP_PID"
echo "   Waiting 5 seconds for initialization..."
sleep 5

# Check if process is still running
if ps -p $MCP_PID > /dev/null; then
    echo "   ✅ MCP Server is running"
    
    # Check CPU usage
    CPU=$(ps -p $MCP_PID -o %cpu --no-headers | tr -d ' ')
    echo "   CPU Usage: ${CPU}%"
    
    if (( $(echo "$CPU > 50" | bc -l) )); then
        echo "   ⚠️  HIGH CPU USAGE - possible hang detected"
    else
        echo "   ✅ Normal CPU usage"
    fi
else
    echo "   ❌ MCP Server exited unexpectedly"
    echo ""
    echo "   Startup logs:"
    cat /tmp/mcp-test-startup.log | tail -20 | sed 's/^/      /'
fi

echo ""
echo "7. Summary"
echo "========================================================="
echo ""

# Count issues
ISSUES=0

if [ $MCP_COUNT -eq 0 ]; then
    echo "   ⚠️  Issue: No MCP processes were running"
    ISSUES=$((ISSUES + 1))
fi

if [ "$API_RESPONSE" != "200" ] && [ "$API_RESPONSE" != "404" ]; then
    echo "   ⚠️  Issue: API connectivity problem"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo "   ✅ All systems operational"
else
    echo "   Found $ISSUES issue(s) - see details above"
fi

echo ""
echo "To test MCP timeout behavior manually:"
echo "   1. Ensure OpenCode is running in this project"
echo "   2. Try using a Metabob MCP tool"
echo "   3. Monitor CPU usage: watch -n 1 'ps aux | grep metabob-cli'"
echo "   4. Check for timeout messages in logs"
echo ""
