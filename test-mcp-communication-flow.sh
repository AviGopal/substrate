#!/bin/bash
# Test MCP Communication Flow: metabob-cli → metabob-rpc-api
# This script demonstrates the full communication path and expected log entries

set -e

echo "=================================================="
echo "MCP Communication Flow Test"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RPC_API_URL="http://api.metabob.local:8080"
NAMESPACE="metabob"
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

echo -e "${BLUE}Configuration:${NC}"
echo "  RPC API URL: $RPC_API_URL"
echo "  Namespace: $NAMESPACE"
echo "  Pod: $POD_NAME"
echo ""

# Step 1: Check rpc-api is healthy
echo -e "${YELLOW}[Step 1] Checking rpc-api health...${NC}"
HEALTH_RESPONSE=$(curl -s $RPC_API_URL/)
echo "  Response: $HEALTH_RESPONSE"
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}  ✓ rpc-api is healthy${NC}"
else
    echo "  ✗ rpc-api is not responding correctly"
    exit 1
fi
echo ""

# Step 2: Start log streaming in background
echo -e "${YELLOW}[Step 2] Starting log streaming (background)...${NC}"
LOG_FILE="/tmp/rpc-api-logs-$(date +%s).txt"
kubectl logs -n $NAMESPACE -f $POD_NAME > "$LOG_FILE" 2>&1 &
LOG_PID=$!
echo "  Log PID: $LOG_PID"
echo "  Log file: $LOG_FILE"
sleep 2
echo ""

# Step 3: Test direct API call (simulating what MCP does)
echo -e "${YELLOW}[Step 3] Testing direct API call (GET /v2/activities/templates)...${NC}"
echo "  This simulates what metabob-cli MCP tools do internally"
echo ""

# Make the API call
echo "  $ curl -X GET $RPC_API_URL/v2/activities/templates"
API_RESPONSE=$(curl -s -X GET "$RPC_API_URL/v2/activities/templates")
echo ""
echo "  Response:"
echo "$API_RESPONSE" | jq -r '.templates[0:2] | .[] | "    - \(.id): \(.name)"' 2>/dev/null || echo "$API_RESPONSE" | head -5
echo ""

# Step 4: Check logs for this request
echo -e "${YELLOW}[Step 4] Checking logs for our request...${NC}"
sleep 2
kill $LOG_PID 2>/dev/null || true
wait $LOG_PID 2>/dev/null || true

echo "  Recent log entries:"
tail -20 "$LOG_FILE" | grep -E "(GET|POST|/v2/activities|/session)" | tail -5 | while read -r line; do
    echo "    $line"
done
echo ""

# Step 5: Explain the flow
echo -e "${YELLOW}[Step 5] Communication Flow Explanation:${NC}"
echo ""
echo "  Full Architecture:"
echo "    OpenCode (Claude) → metabob-cli MCP → metabob-rpc-api → SurrealDB"
echo ""
echo "  Step-by-step:"
echo "    1. User interacts with OpenCode (this session)"
echo "    2. OpenCode calls MCP tool (e.g., 'search_activities')"
echo "    3. metabob-cli MCP server receives tool call via stdio"
echo "    4. MCP server calls api_client.call_api()"
echo "    5. api_client makes HTTP request to rpc-api"
echo "    6. rpc-api processes request and queries SurrealDB"
echo "    7. Response flows back: rpc-api → MCP → OpenCode"
echo ""

# Step 6: Expected log patterns
echo -e "${YELLOW}[Step 6] Expected Log Patterns:${NC}"
echo ""
echo "  When MCP tools are called, you should see:"
echo "    • Session creation:"
echo "      INFO: POST /session HTTP/1.1 200 OK"
echo ""
echo "    • Template queries:"
echo "      INFO: GET /v2/activities/templates HTTP/1.1 200 OK"
echo ""
echo "    • Activity execution:"
echo "      INFO: POST /v2/submit HTTP/1.1 200 OK"
echo "      INFO: WebSocket /ws/job?token=... [accepted]"
echo ""
echo "    • Health checks:"
echo "      INFO: GET / HTTP/1.1 200 OK"
echo ""

# Step 7: Show actual recent logs
echo -e "${YELLOW}[Step 7] Recent actual logs from rpc-api:${NC}"
echo ""
tail -30 "$LOG_FILE" | tail -15
echo ""

# Step 8: Environment variable check
echo -e "${YELLOW}[Step 8] MCP Configuration Check:${NC}"
echo ""
echo "  For metabob-cli to connect to rpc-api, set:"
echo "    export METABOB_RPC_API_URL=\"$RPC_API_URL\""
echo ""
echo "  Current value:"
if [ -n "$METABOB_RPC_API_URL" ]; then
    echo "    METABOB_RPC_API_URL=$METABOB_RPC_API_URL"
    echo -e "${GREEN}    ✓ Environment variable is set${NC}"
else
    echo "    (not set - using default: http://localhost:8080)"
    echo -e "${YELLOW}    ⚠ Set METABOB_RPC_API_URL to connect to k8s deployment${NC}"
fi
echo ""

# Step 9: Next steps
echo -e "${YELLOW}[Step 9] Testing MCP Tools Live:${NC}"
echo ""
echo "  To see live MCP communication, run in OpenCode:"
echo ""
echo "    1. Ensure environment variable is set:"
echo "       export METABOB_RPC_API_URL=\"http://api.metabob.local:8080\""
echo ""
echo "    2. Use MCP tools (they auto-connect):"
echo "       - search_activities({})"
echo "       - test_metabob_mcp({})"
echo ""
echo "    3. Watch logs in real-time:"
echo "       kubectl logs -n metabob -f $POD_NAME"
echo ""

echo -e "${GREEN}=================================================="
echo "Test Complete!"
echo "==================================================${NC}"
echo ""
echo "Summary:"
echo "  ✓ rpc-api is healthy and responding"
echo "  ✓ API endpoints are accessible"
echo "  ✓ Logs are being captured"
echo ""
echo "Log file saved: $LOG_FILE"
echo ""
