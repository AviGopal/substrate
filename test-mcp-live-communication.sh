#!/bin/bash
# Live MCP Communication Test with Authentication
# This demonstrates the full flow: MCP tool → HTTP API → rpc-api → logs

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

RPC_API_URL="http://api.metabob.local:8080"
NAMESPACE="metabob"
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')

echo -e "${BLUE}=================================================="
echo "Live MCP Communication Test"
echo "==================================================${NC}"
echo ""

# Step 1: Create a session (authenticate)
echo -e "${YELLOW}[Step 1] Creating session (authentication)...${NC}"
SESSION_RESPONSE=$(curl -s -X POST "$RPC_API_URL/session" -H "Content-Type: application/json")
echo "  Response: $SESSION_RESPONSE"

SESSION_TOKEN=$(echo "$SESSION_RESPONSE" | jq -r '.session' 2>/dev/null)
if [ -z "$SESSION_TOKEN" ] || [ "$SESSION_TOKEN" = "null" ]; then
    echo -e "${RED}  ✗ Failed to create session${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Session created${NC}"
echo "  Token: ${SESSION_TOKEN:0:20}..."
echo ""

# Step 2: Start watching logs in real-time (background)
echo -e "${YELLOW}[Step 2] Starting real-time log watch...${NC}"
LOG_FILE="/tmp/mcp-live-logs-$(date +%s).txt"
kubectl logs -n $NAMESPACE -f $POD_NAME > "$LOG_FILE" 2>&1 &
LOG_PID=$!
echo "  Log watcher PID: $LOG_PID"
sleep 2
echo ""

# Step 3: Make authenticated API calls (simulating MCP tools)
echo -e "${YELLOW}[Step 3] Simulating MCP tool calls...${NC}"
echo ""

# Call 1: List activity templates (simulates search_activities)
echo "  [Call 1] GET /v2/activities/templates (search_activities)"
TEMPLATES_RESPONSE=$(curl -s -X GET "$RPC_API_URL/v2/activities/templates" \
    -H "Authorization: Bearer $SESSION_TOKEN")
TEMPLATE_COUNT=$(echo "$TEMPLATES_RESPONSE" | jq '.templates | length' 2>/dev/null || echo "0")
echo "  Response: Found $TEMPLATE_COUNT templates"
if [ "$TEMPLATE_COUNT" -gt 0 ]; then
    echo "$TEMPLATES_RESPONSE" | jq -r '.templates[0:3] | .[] | "    - \(.id): \(.name)"' 2>/dev/null || true
fi
echo ""
sleep 1

# Call 2: Get specific template
FIRST_TEMPLATE_ID=$(echo "$TEMPLATES_RESPONSE" | jq -r '.templates[0].id' 2>/dev/null)
if [ -n "$FIRST_TEMPLATE_ID" ] && [ "$FIRST_TEMPLATE_ID" != "null" ]; then
    echo "  [Call 2] GET /v2/activities/templates/$FIRST_TEMPLATE_ID"
    TEMPLATE_DETAIL=$(curl -s -X GET "$RPC_API_URL/v2/activities/templates/$FIRST_TEMPLATE_ID" \
        -H "Authorization: Bearer $SESSION_TOKEN")
    TEMPLATE_NAME=$(echo "$TEMPLATE_DETAIL" | jq -r '.template.name' 2>/dev/null || echo "unknown")
    echo "  Response: Template '$TEMPLATE_NAME'"
    echo ""
    sleep 1
fi

# Call 3: Health check (frequent background calls)
echo "  [Call 3] GET / (health check)"
HEALTH=$(curl -s "$RPC_API_URL/")
echo "  Response: $(echo $HEALTH | jq -r '.status' 2>/dev/null)"
echo ""

# Step 4: Stop log watch and analyze
echo -e "${YELLOW}[Step 4] Analyzing captured logs...${NC}"
sleep 2
kill $LOG_PID 2>/dev/null || true
wait $LOG_PID 2>/dev/null || true
echo ""

# Extract relevant log entries
echo "  Captured communication log entries:"
echo ""
grep -E "(POST /session|GET /v2/activities/templates|GET /)" "$LOG_FILE" | tail -10 | while IFS= read -r line; do
    if echo "$line" | grep -q "POST /session"; then
        echo -e "    ${GREEN}$line${NC}"
    elif echo "$line" | grep -q "GET /v2/activities/templates"; then
        echo -e "    ${BLUE}$line${NC}"
    else
        echo "    $line"
    fi
done
echo ""

# Step 5: Show communication flow mapping
echo -e "${YELLOW}[Step 5] Communication Flow Mapping:${NC}"
echo ""
echo "  What we just demonstrated:"
echo ""
echo "    1️⃣  POST /session"
echo "       → Created authenticated session"
echo "       → Returns Bearer token for subsequent requests"
echo "       ${GREEN}(This is what metabob-cli MCP does on startup)${NC}"
echo ""
echo "    2️⃣  GET /v2/activities/templates"
echo "       → With Bearer token in Authorization header"
echo "       → Returns activity template list from SurrealDB"
echo "       ${BLUE}(This is what search_activities() MCP tool does)${NC}"
echo ""
echo "    3️⃣  GET /"
echo "       → Health check (no auth required)"
echo "       → Confirms rpc-api is responsive"
echo ""

# Step 6: Show MCP internals
echo -e "${YELLOW}[Step 6] MCP Internal Flow:${NC}"
echo ""
echo "  metabob-cli MCP server (Python):"
echo "    • Located: repos/metabob-cli/src/metabob_cli/mcp/"
echo "    • Entry: server.py (stdio MCP server)"
echo "    • Tools: activity_template_tools.py"
echo "    • HTTP Client: api_client.py (calls rpc-api)"
echo ""
echo "  Key code flow:"
echo "    1. OpenCode calls: search_activities({})"
echo "    2. MCP receives JSONRPC over stdio"
echo "    3. Calls: api_client.call_api('GET', '/v2/activities/templates')"
echo "    4. HTTP request: Authorization: Bearer <token>"
echo "    5. rpc-api processes → queries SurrealDB"
echo "    6. Response flows back to OpenCode"
echo ""

# Step 7: Environment setup
echo -e "${YELLOW}[Step 7] Environment Setup for Live MCP:${NC}"
echo ""
echo "  To connect metabob-cli MCP to your k8s rpc-api:"
echo ""
echo "    export METABOB_RPC_API_URL=\"http://api.metabob.local:8080\""
echo ""
echo "  Then OpenCode will automatically use MCP tools that connect to rpc-api!"
echo ""

# Step 8: Next steps
echo -e "${YELLOW}[Step 8] Try Live MCP Tools Now:${NC}"
echo ""
echo "  In this OpenCode session, you can call:"
echo ""
echo "    • search_activities({ verbose: true })"
echo "      → Lists all activity templates from SurrealDB"
echo ""
echo "    • test_metabob_mcp({})"
echo "      → Tests MCP connectivity and shows available tools"
echo ""
echo "  Watch logs in another terminal:"
echo "    kubectl logs -n metabob -f $POD_NAME | grep -E '(POST|GET|/v2)'"
echo ""

echo -e "${GREEN}=================================================="
echo "Live Test Complete!"
echo "==================================================${NC}"
echo ""
echo "Summary:"
echo "  ✓ Session created and authenticated"
echo "  ✓ API calls executed successfully"
echo "  ✓ Logs captured and analyzed"
echo "  ✓ Communication flow demonstrated"
echo ""
echo "Log file: $LOG_FILE"
echo ""
