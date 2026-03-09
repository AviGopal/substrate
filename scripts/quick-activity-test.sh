#!/bin/bash
# Quick Activity Test - Run inside DevBob container
# Usage: kubectl exec -it -n metabob devbob-84466fdfff-dd87l -- bash -c "$(cat scripts/quick-activity-test.sh)"

echo "=== Quick Activity Execution Test ==="
echo ""

# Test 1: MCP Connectivity
echo "1. Testing MCP connectivity..."
if command -v opencode &> /dev/null; then
    opencode mcp test metabob_search_activities --args '{"verbose": false}' 2>&1 | head -20
    if [ $? -eq 0 ]; then
        echo "✅ MCP connectivity OK"
    else
        echo "❌ MCP connectivity failed"
    fi
else
    echo "❌ opencode command not found"
    exit 1
fi
echo ""

# Test 2: Check Configuration
echo "2. Checking configuration..."
echo "METABOB_API_URL: $METABOB_API_URL"
echo "METABOB_API_KEY: ${METABOB_API_KEY:0:20}..."
echo ""

# Test 3: List Available Templates
echo "3. Listing available activity templates..."
opencode activity search 2>&1 | head -30
echo ""

# Test 4: Check RPC API connectivity
echo "4. Testing RPC API connectivity..."
if [ -n "$METABOB_API_URL" ]; then
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" $METABOB_API_URL/ || echo "Connection failed"
else
    echo "METABOB_API_URL not set"
fi
echo ""

echo "=== Test Complete ==="
echo ""
echo "To execute an activity, run:"
echo "  opencode activity run <template-id> --var key=value --reason \"test\""
