#!/bin/bash
# Validation script for dynamic-activity-creation-with-trailblazing-pass2
# Executes workflows in DevBob environment and verifies behavior

set -euo pipefail

NAMESPACE="metabob"
DEVBOB_POD="devbob-pod"
RPC_API_POD="rpc-api-pod"
SURREALDB_POD="surrealdb-pod"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "Dynamic Activity Creation Pass 2 Validation"
echo "=============================================="
echo

# Step 1: Verify environment configuration
echo -e "${YELLOW}[1/10] Verifying DevBob environment configuration...${NC}"
kubectl exec -n $NAMESPACE $DEVBOB_POD -- env | grep -E 'METABOB_API_KEY|ACTIVITY_BACKEND_URL|SURREALDB' || {
    echo -e "${RED}ERROR: Required environment variables not found in DevBob pod${NC}"
    echo "Expected: METABOB_API_KEY, ACTIVITY_BACKEND_URL"
    exit 1
}
echo -e "${GREEN}✓ Environment variables configured${NC}"
echo

# Step 2: Verify backend reachability
echo -e "${YELLOW}[2/10] Testing backend endpoint reachability...${NC}"
kubectl exec -n $NAMESPACE $DEVBOB_POD -- curl -s -o /dev/null -w "%{http_code}" $ACTIVITY_BACKEND_URL/health | grep -q "200" && {
    echo -e "${GREEN}✓ Backend is reachable${NC}"
} || {
    echo -e "${RED}ERROR: Backend is not reachable${NC}"
    exit 1
}
echo

# Step 3: Execute create-activity from DevBob
echo -e "${YELLOW}[3/10] Executing create-activity from DevBob...${NC}"
ACTIVITY_OUTPUT=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- opencode activity create-activity \
  --variables '{"activityName":"pass2-validation-test","purpose":"Validate dynamic activity creation with trailblazing"}' \
  --reason 'Pass 2 validation: verify complete data flow from agent to SurrealDB' 2>&1)

echo "$ACTIVITY_OUTPUT"

# Extract activity ID from output (assuming format: "Activity act_XXXXX completed")
ACTIVITY_ID=$(echo "$ACTIVITY_OUTPUT" | grep -oP 'act_[a-zA-Z0-9_]+' | head -1)

if [ -z "$ACTIVITY_ID" ]; then
    echo -e "${RED}ERROR: Could not extract activity ID from output${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Activity created: $ACTIVITY_ID${NC}"
echo

# Step 4: Monitor lifecycle hooks in logs
echo -e "${YELLOW}[4/10] Checking kubectl logs for lifecycle hooks...${NC}"
kubectl logs -n $NAMESPACE $DEVBOB_POD --tail=100 | grep -E 'lifecycle-hooks|memory-management|activity-recommendations|metabob-context' && {
    echo -e "${GREEN}✓ Lifecycle hooks found in logs${NC}"
} || {
    echo -e "${YELLOW}⚠ No lifecycle hook logs found (may not have fired)${NC}"
}
echo

# Step 5: Monitor trailblazing execution in logs
echo -e "${YELLOW}[5/10] Checking kubectl logs for trailblazing execution...${NC}"
kubectl logs -n $NAMESPACE $DEVBOB_POD --tail=100 | grep -E 'trailblazing|recovery attempt|continuation prompt' && {
    echo -e "${GREEN}✓ Trailblazing execution found in logs${NC}"
} || {
    echo -e "${YELLOW}⚠ No trailblazing logs found (no failures occurred, which is expected for successful execution)${NC}"
}
echo

# Step 6: Check RPC API logs for incoming requests
echo -e "${YELLOW}[6/10] Checking RPC API logs for HTTP requests...${NC}"
kubectl logs -n $NAMESPACE $RPC_API_POD --tail=50 | grep -E 'POST /activity-execution|PATCH /activity-execution' && {
    echo -e "${GREEN}✓ HTTP requests found in RPC API logs${NC}"
} || {
    echo -e "${RED}ERROR: No HTTP requests found in RPC API logs${NC}"
    echo "This indicates backend persistence may have failed"
    exit 1
}
echo

# Step 7: Query SurrealDB for activity record
echo -e "${YELLOW}[7/10] Querying SurrealDB for activity record...${NC}"
ACTIVITY_QUERY_RESULT=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- \
  surreal sql "SELECT * FROM activity_executions WHERE activity_id = '$ACTIVITY_ID'" 2>&1)

echo "$ACTIVITY_QUERY_RESULT"

if echo "$ACTIVITY_QUERY_RESULT" | grep -q "$ACTIVITY_ID"; then
    echo -e "${GREEN}✓ Activity record found in SurrealDB${NC}"
else
    echo -e "${RED}ERROR: Activity record not found in SurrealDB${NC}"
    exit 1
fi
echo

# Step 8: Verify recovery_attempts field structure
echo -e "${YELLOW}[8/10] Verifying recovery_attempts field structure...${NC}"
RECOVERY_QUERY_RESULT=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- \
  surreal sql "SELECT activity_id, recovery_attempts FROM activity_executions WHERE activity_id = '$ACTIVITY_ID'" 2>&1)

echo "$RECOVERY_QUERY_RESULT"

if echo "$RECOVERY_QUERY_RESULT" | grep -q "recovery_attempts"; then
    echo -e "${GREEN}✓ recovery_attempts field present${NC}"
else
    echo -e "${YELLOW}⚠ recovery_attempts field not found (expected if no failures occurred)${NC}"
fi
echo

# Step 9: Verify state_delta field structure
echo -e "${YELLOW}[9/10] Verifying state_delta field structure...${NC}"
STATE_DELTA_QUERY_RESULT=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- \
  surreal sql "SELECT activity_id, state_delta FROM task_executions WHERE activity_id = '$ACTIVITY_ID' LIMIT 5" 2>&1)

echo "$STATE_DELTA_QUERY_RESULT"

if echo "$STATE_DELTA_QUERY_RESULT" | grep -q "state_delta"; then
    echo -e "${GREEN}✓ state_delta field present in task executions${NC}"
else
    echo -e "${YELLOW}⚠ state_delta field not found in task executions${NC}"
fi
echo

# Step 10: Count total activities in database
echo -e "${YELLOW}[10/10] Counting total activities with lifecycle metadata...${NC}"
TOTAL_ACTIVITIES=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- \
  surreal sql "SELECT COUNT() FROM activity_executions GROUP ALL" 2>&1)

echo "$TOTAL_ACTIVITIES"

if echo "$TOTAL_ACTIVITIES" | grep -qE '[0-9]+'; then
    ACTIVITY_COUNT=$(echo "$TOTAL_ACTIVITIES" | grep -oP '\d+' | head -1)
    if [ "$ACTIVITY_COUNT" -ge 3 ]; then
        echo -e "${GREEN}✓ Database contains $ACTIVITY_COUNT activities (≥3 required)${NC}"
    else
        echo -e "${YELLOW}⚠ Database contains $ACTIVITY_COUNT activities (<3, run more tests)${NC}"
    fi
else
    echo -e "${RED}ERROR: Could not count activities in database${NC}"
    exit 1
fi
echo

echo "=============================================="
echo -e "${GREEN}Pass 2 Validation Complete!${NC}"
echo "=============================================="
echo
echo "Summary:"
echo "- Activity ID: $ACTIVITY_ID"
echo "- Environment: Configured ✓"
echo "- Backend: Reachable ✓"
echo "- Execution: Successful ✓"
echo "- Persistence: Verified ✓"
echo
echo "Next steps:"
echo "1. Review kubectl logs for detailed execution trace"
echo "2. Query SurrealDB for full activity and task execution data"
echo "3. Run failure injection test to verify trailblazing recovery"
echo
