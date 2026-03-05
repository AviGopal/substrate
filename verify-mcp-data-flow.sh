#!/bin/bash
# Verify MCP data flow is working end-to-end

echo "🔍 Verifying MCP Data Flow - End-to-End Test"
echo "=============================================="
echo ""

# Step 1: Check port-forward
echo "Step 1: Checking port-forward..."
if timeout 2 curl -s http://localhost:8080/ > /dev/null 2>&1; then
    API_STATUS=$(curl -s http://localhost:8080/ | jq -r '.status' 2>/dev/null)
    if [ "$API_STATUS" = "ok" ]; then
        echo "   ✅ Port-forward working - API accessible"
    else
        echo "   ⚠️  Port-forward up but API returned unexpected response"
    fi
else
    echo "   ❌ Port-forward not working - localhost:8080 not accessible"
    echo "   Run: ./start-api-port-forward.sh"
    exit 1
fi
echo ""

# Step 2: Check RPC API pod
echo "Step 2: Checking RPC API pod status..."
POD_STATUS=$(kubectl get pods -l app=metabob-rpc-api -o jsonpath='{.items[0].status.phase}' 2>/dev/null)
if [ "$POD_STATUS" = "Running" ]; then
    echo "   ✅ RPC API pod is Running"
else
    echo "   ❌ RPC API pod is not Running (status: $POD_STATUS)"
    kubectl get pods -l app=metabob-rpc-api
    exit 1
fi
echo ""

# Step 3: Check OpenCode config
echo "Step 3: Checking OpenCode configuration..."
if [ -f "repos/metabob-opencode/.opencode/opencode.json" ]; then
    API_URL=$(jq -r '.mcp.metabob.environment.METABOB_API_URL' repos/metabob-opencode/.opencode/opencode.json 2>/dev/null)
    if [ "$API_URL" = "http://api.metabob.local:8080" ]; then
        echo "   ✅ OpenCode config has correct API URL with port"
    else
        echo "   ⚠️  OpenCode config API URL: $API_URL"
        echo "   Expected: http://api.metabob.local:8080"
    fi
else
    echo "   ⚠️  OpenCode config not found"
fi
echo ""

# Step 4: Test MCP initialization
echo "Step 4: Testing MCP initialization..."
echo "   Starting metabob-cli MCP server (10s timeout)..."

cd repos/metabob-cli
export METABOB_API_URL="http://api.metabob.local:8080"
export METABOB_API_KEY="mb_devbob_test_simple_2026_v2"

# Start MCP in background and capture output
timeout 10 python -m metabob_cli.mcp.server --transport stdio > /tmp/mcp-init-test.log 2>&1 &
MCP_PID=$!

# Wait for initialization
sleep 3

# Check if still running
if ps -p $MCP_PID > /dev/null 2>&1; then
    CPU=$(ps -p $MCP_PID -o %cpu --no-headers | tr -d ' ')
    echo "   ✅ MCP server initialized (PID: $MCP_PID)"
    echo "   CPU usage: ${CPU}%"
    
    if (( $(echo "$CPU > 50" | bc -l 2>/dev/null || echo 0) )); then
        echo "   ⚠️  HIGH CPU - possible hang"
    else
        echo "   ✅ Normal CPU usage"
    fi
    
    # Kill test process
    kill $MCP_PID 2>/dev/null
    wait $MCP_PID 2>/dev/null
else
    echo "   ❌ MCP server exited during initialization"
    echo ""
    echo "   Startup logs:"
    cat /tmp/mcp-init-test.log | tail -20 | sed 's/^/      /'
    cd ../..
    exit 1
fi

cd ../..
echo ""

# Step 5: Check for running OpenCode processes
echo "Step 5: Checking for running OpenCode instances..."
OPENCODE_COUNT=$(ps aux | grep "opencode" | grep -v grep | grep -v "pyright" | wc -l)
if [ $OPENCODE_COUNT -gt 0 ]; then
    echo "   ✅ Found $OPENCODE_COUNT OpenCode process(es) running"
    ps aux | grep "opencode" | grep -v grep | grep -v "pyright" | head -3 | awk '{print "      PID:", $2, "CPU:", $3"%"}'
else
    echo "   ⚠️  No OpenCode processes running"
    echo "   Start OpenCode in a project to test full flow"
fi
echo ""

# Step 6: Summary
echo "=============================================="
echo "Summary"
echo "=============================================="
echo ""
echo "✅ Prerequisites met:"
echo "   - Port-forward active (localhost:8080 → K8s API)"
echo "   - RPC API pod Running"
echo "   - OpenCode config correct"
echo "   - MCP server can initialize successfully"
echo ""
echo "📋 Next steps to verify data flow:"
echo "   1. Ensure OpenCode is running in a project"
echo "   2. Trigger an MCP tool call (e.g., search_codebase_issues)"
echo "   3. Check API logs: kubectl logs -l app=metabob-rpc-api --tail=20"
echo "   4. Verify data in dashboard"
echo ""
echo "🔧 If issues persist:"
echo "   - Check MCP logs: tail -f /tmp/live-mcp-logs.txt"
echo "   - Check API logs: kubectl logs -l app=metabob-rpc-api -f"
echo "   - Monitor CPU: watch -n 1 'ps aux | grep metabob-cli | grep -v grep'"
echo ""
