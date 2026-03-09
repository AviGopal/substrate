#!/bin/bash
# Test Activity Execution and Observe Logs
# Usage: ./scripts/test-activity-execution-with-logs.sh

set -e

echo "=========================================="
echo "Activity Execution Flow Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DEVBOB_POD="devbob-84466fdfff-dd87l"
NAMESPACE="metabob"
RPC_API_DEPLOYMENT="metabob-rpc-api"

echo -e "${BLUE}Step 1: Verify DevBob Pod Status${NC}"
if kubectl get pod -n $NAMESPACE $DEVBOB_POD &>/dev/null; then
    echo -e "${GREEN}✅ DevBob pod is running${NC}"
    kubectl get pod -n $NAMESPACE $DEVBOB_POD
else
    echo -e "${RED}❌ DevBob pod not found${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}Step 2: Verify RPC API Status${NC}"
if kubectl get deployment -n $NAMESPACE $RPC_API_DEPLOYMENT &>/dev/null; then
    echo -e "${GREEN}✅ RPC API deployment exists${NC}"
    kubectl get deployment -n $NAMESPACE $RPC_API_DEPLOYMENT
else
    echo -e "${RED}❌ RPC API deployment not found${NC}"
    exit 1
fi
echo ""

echo -e "${BLUE}Step 3: Check MCP Configuration${NC}"
kubectl exec -n $NAMESPACE $DEVBOB_POD -- env | grep METABOB || echo "No METABOB env vars"
echo ""

echo -e "${YELLOW}Ready to execute activity. Starting log collection...${NC}"
echo ""
echo -e "${BLUE}Instructions:${NC}"
echo "1. This script will tail RPC API logs in the background"
echo "2. You will be dropped into the DevBob container"
echo "3. Run an activity command (see examples below)"
echo "4. Exit the container when done to see collected logs"
echo ""
echo -e "${GREEN}Example commands to run inside DevBob:${NC}"
echo ""
echo "  # Test MCP connectivity"
echo "  opencode mcp test metabob_search_activities --args '{\"verbose\": false}'"
echo ""
echo "  # Simple activity execution (if search_activities works)"
echo "  opencode activity search"
echo ""
echo "  # Check opencode config"
echo "  cat ~/.opencode/opencode.json | jq '.mcp'"
echo ""
echo "Press Enter to continue..."
read

# Create temp file for logs
LOGFILE="/tmp/rpc-api-logs-$(date +%s).txt"
echo -e "${BLUE}Collecting RPC API logs to: $LOGFILE${NC}"

# Start log collection in background
kubectl logs -n $NAMESPACE -f deployment/$RPC_API_DEPLOYMENT > "$LOGFILE" 2>&1 &
LOG_PID=$!

echo -e "${GREEN}Log collection started (PID: $LOG_PID)${NC}"
echo ""

# Give logs a moment to start
sleep 2

echo -e "${BLUE}Entering DevBob container...${NC}"
echo -e "${YELLOW}(Run your test commands, then type 'exit' when done)${NC}"
echo ""

# Enter the pod interactively
kubectl exec -it -n $NAMESPACE $DEVBOB_POD -- /bin/bash || true

# After exiting
echo ""
echo -e "${BLUE}Stopping log collection...${NC}"
kill $LOG_PID 2>/dev/null || true
sleep 1

echo ""
echo -e "${BLUE}Step 4: Analyzing Collected Logs${NC}"
echo "=========================================="
echo ""

if [ -f "$LOGFILE" ]; then
    echo -e "${GREEN}Recent RPC API activity:${NC}"
    tail -50 "$LOGFILE" | grep -E "POST|activity|variant" || echo "No relevant activity found"
    echo ""
    echo -e "${BLUE}Full log file saved at: $LOGFILE${NC}"
    echo ""
    
    # Count requests
    POST_COUNT=$(grep -c "POST" "$LOGFILE" 2>/dev/null || echo "0")
    GET_COUNT=$(grep -c "GET" "$LOGFILE" 2>/dev/null || echo "0")
    
    echo -e "${GREEN}Request Summary:${NC}"
    echo "  POST requests: $POST_COUNT"
    echo "  GET requests: $GET_COUNT"
    echo ""
    
    if [ "$POST_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Activity execution detected!${NC}"
        echo ""
        echo -e "${BLUE}POST request details:${NC}"
        grep "POST" "$LOGFILE" | tail -10
    else
        echo -e "${YELLOW}⚠️  No POST requests detected${NC}"
        echo "This might mean:"
        echo "  - No activity was executed"
        echo "  - MCP connection issue"
        echo "  - Activity used cache and didn't hit backend"
    fi
else
    echo -e "${RED}❌ Log file not found${NC}"
fi

echo ""
echo -e "${BLUE}Step 5: Verification Queries${NC}"
echo "=========================================="
echo ""

echo -e "${YELLOW}To verify data in SurrealDB, run:${NC}"
echo ""
echo "kubectl exec -it -n $NAMESPACE deployment/metabob-surrealdb -- \\"
echo "  surreal sql --endpoint http://localhost:8000 \\"
echo "  --namespace metabob --database metabob \\"
echo "  \"SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 5;\""
echo ""

echo -e "${BLUE}Test Complete${NC}"
echo "=========================================="
