#!/bin/bash

echo "=== Testing MCP Timeout Fix ==="
echo ""

# Clean up any existing processes
echo "1. Cleaning up existing metabob-cli processes..."
pkill -9 -f "metabob-cli mcp" 2>/dev/null || true
sleep 2

# Clear log file
echo "" > .metabob/logs/server.log

# Start metabob-cli MCP directly to test timeout behavior
echo "2. Starting metabob-cli MCP with timeout fix..."
timeout 30 metabob-cli mcp --transport stdio > /dev/null 2>&1 &
MCP_PID=$!

echo "   Started MCP process: $MCP_PID"
sleep 10

# Check if process is still running and CPU usage
echo ""
echo "3. Checking process status..."
ps aux | grep $MCP_PID | grep -v grep | awk '{printf "   PID: %s, CPU: %s%%, MEM: %s%%\n", $2, $3, $4}'

# Check logs for timeout messages
echo ""
echo "4. Checking for timeout handling in logs..."
if grep -q "Timeout/connection error listing session jobs" .metabob/logs/server.log; then
    echo "   ✓ Timeout handled gracefully"
else
    echo "   ✗ No timeout handling found (may still be connecting)"
fi

# Check if process is hung (high CPU)
CPU=$(ps aux | grep $MCP_PID | grep -v grep | awk '{print $3}' | cut -d. -f1)
if [ -n "$CPU" ] && [ "$CPU" -gt 50 ]; then
    echo "   ✗ Process using high CPU ($CPU%) - may be hung"
    RESULT="FAILED"
else
    echo "   ✓ Process using normal CPU"
    RESULT="PASSED"
fi

# Clean up
echo ""
echo "5. Cleaning up..."
kill -9 $MCP_PID 2>/dev/null || true

echo ""
echo "=== Test Result: $RESULT ==="
