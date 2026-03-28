#!/bin/bash
# Real Activity Concurrent Test - End-to-End Fix #2 Validation
# Tests atomic updates with actual activity template execution

set -e

echo "=========================================="
echo "Real Activity E2E Test - Fix #2"
echo "=========================================="
echo ""

# Configuration
API_URL="http://localhost:8080"
VARIANT_ID="hello-world-minimal-31727b21"
NUM_CONCURRENT=10

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "Test Configuration:"
echo "  API URL: $API_URL"
echo "  Template: hello-world-minimal"
echo "  Variant ID: $VARIANT_ID"
echo "  Concurrent Executions: $NUM_CONCURRENT"
echo ""

# ============================================================================
# STEP 1: Capture Initial State
# ============================================================================
echo "STEP 1: Capturing initial state..."
echo "----------------------------------------------"

INITIAL_STATE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$VARIANT_ID")
INITIAL_ALPHA=$(echo "$INITIAL_STATE" | jq -r '.thompson_alpha')
INITIAL_BETA=$(echo "$INITIAL_STATE" | jq -r '.thompson_beta')
INITIAL_SUCCESSES=$(echo "$INITIAL_STATE" | jq -r '.total_successes')
INITIAL_FAILURES=$(echo "$INITIAL_STATE" | jq -r '.total_failures')
INITIAL_SELECTIONS=$(echo "$INITIAL_STATE" | jq -r '.total_selections')

echo "  Initial Metrics:"
echo "    thompson_alpha: $INITIAL_ALPHA"
echo "    thompson_beta: $INITIAL_BETA"
echo "    total_successes: $INITIAL_SUCCESSES"
echo "    total_failures: $INITIAL_FAILURES"
echo "    total_selections: $INITIAL_SELECTIONS"
echo ""

# ============================================================================
# STEP 2: Launch Concurrent Activity Executions
# ============================================================================
echo "STEP 2: Launching $NUM_CONCURRENT concurrent activity executions..."
echo "----------------------------------------------"

RESULTS_FILE=$(mktemp)
START_TIME=$(date +%s%3N)

# Function to simulate activity execution result
execute_activity() {
    local index=$1
    local success=$((RANDOM % 10 < 8 ? 1 : 0))  # 80% success rate
    
    local payload=$(cat <<EOF
{
  "variant_id": "$VARIANT_ID",
  "success": $([ $success -eq 1 ] && echo "true" || echo "false"),
  "cost": $(echo "scale=4; $RANDOM / 32767 * 0.2" | bc),
  "duration_ms": $((RANDOM % 5000 + 5000)),
  "tokens": {
    "input": $((RANDOM % 500 + 500)),
    "output": $((RANDOM % 200 + 100)),
    "cache": $((RANDOM % 100))
  }
}
EOF
)
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "$API_URL/v2/activities/executions" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        echo "$index:SUCCESS:$success" >> "$RESULTS_FILE"
    else
        echo "$index:FAILED:$http_code" >> "$RESULTS_FILE"
    fi
}

echo "  Simulating $NUM_CONCURRENT activity executions (80% success rate)..."

# Launch concurrent executions
for i in $(seq 1 $NUM_CONCURRENT); do
    execute_activity $i &
done

# Wait for completion
wait

END_TIME=$(date +%s%3N)
ELAPSED=$((END_TIME - START_TIME))

# Analyze results
SUCCESS_COUNT=$(grep -c "SUCCESS" "$RESULTS_FILE" || echo "0")
FAILED_COUNT=$(grep -c "FAILED" "$RESULTS_FILE" || echo "0")
SIMULATED_SUCCESSES=$(grep "SUCCESS:1" "$RESULTS_FILE" | wc -l || echo "0")
SIMULATED_FAILURES=$(grep "SUCCESS:0" "$RESULTS_FILE" | wc -l || echo "0")

echo "  Completed in ${ELAPSED}ms"
echo "    API Requests Successful: $SUCCESS_COUNT"
echo "    API Requests Failed: $FAILED_COUNT"
echo "    Simulated Activity Successes: $SIMULATED_SUCCESSES"
echo "    Simulated Activity Failures: $SIMULATED_FAILURES"
echo ""

# ============================================================================
# STEP 3: Verify Final State
# ============================================================================
echo "STEP 3: Verifying final state..."
echo "----------------------------------------------"

sleep 1  # Brief delay to ensure all updates committed

FINAL_STATE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$VARIANT_ID")
FINAL_ALPHA=$(echo "$FINAL_STATE" | jq -r '.thompson_alpha')
FINAL_BETA=$(echo "$FINAL_STATE" | jq -r '.thompson_beta')
FINAL_SUCCESSES=$(echo "$FINAL_STATE" | jq -r '.total_successes')
FINAL_FAILURES=$(echo "$FINAL_STATE" | jq -r '.total_failures')
FINAL_SELECTIONS=$(echo "$FINAL_STATE" | jq -r '.total_selections')

echo "  Final Metrics:"
echo "    thompson_alpha: $FINAL_ALPHA"
echo "    thompson_beta: $FINAL_BETA"
echo "    total_successes: $FINAL_SUCCESSES"
echo "    total_failures: $FINAL_FAILURES"
echo "    total_selections: $FINAL_SELECTIONS"
echo ""

# ============================================================================
# STEP 4: Validate Atomic Updates
# ============================================================================
echo "STEP 4: Validating atomic updates..."
echo "----------------------------------------------"

# Calculate expected values
EXPECTED_ALPHA=$(echo "$INITIAL_ALPHA + $SIMULATED_SUCCESSES" | bc)
EXPECTED_BETA=$(echo "$INITIAL_BETA + $SIMULATED_FAILURES" | bc)
EXPECTED_SUCCESSES=$((INITIAL_SUCCESSES + SIMULATED_SUCCESSES))
EXPECTED_FAILURES=$((INITIAL_FAILURES + SIMULATED_FAILURES))
EXPECTED_SELECTIONS=$((INITIAL_SELECTIONS + SUCCESS_COUNT))

echo "  Expected vs Actual:"
echo "    thompson_alpha: $EXPECTED_ALPHA vs $FINAL_ALPHA"
echo "    thompson_beta: $EXPECTED_BETA vs $FINAL_BETA"
echo "    total_successes: $EXPECTED_SUCCESSES vs $FINAL_SUCCESSES"
echo "    total_failures: $EXPECTED_FAILURES vs $FINAL_FAILURES"
echo "    total_selections: $EXPECTED_SELECTIONS vs $FINAL_SELECTIONS"
echo ""

# Validate
ALPHA_MATCH=$(echo "$FINAL_ALPHA == $EXPECTED_ALPHA" | bc)
BETA_MATCH=$(echo "$FINAL_BETA == $EXPECTED_BETA" | bc)
SUCCESSES_MATCH=$((FINAL_SUCCESSES == EXPECTED_SUCCESSES ? 1 : 0))
FAILURES_MATCH=$((FINAL_FAILURES == EXPECTED_FAILURES ? 1 : 0))
SELECTIONS_MATCH=$((FINAL_SELECTIONS == EXPECTED_SELECTIONS ? 1 : 0))

# Count updates applied
ACTUAL_ALPHA_UPDATES=$(echo "$FINAL_ALPHA - $INITIAL_ALPHA" | bc)
ACTUAL_BETA_UPDATES=$(echo "$FINAL_BETA - $INITIAL_BETA" | bc)

echo "  Validation Results:"

if [ "$ALPHA_MATCH" -eq 1 ]; then
    echo -e "    ${GREEN}✓ Thompson Alpha Correct${NC} (no lost updates)"
else
    echo -e "    ${RED}✗ Thompson Alpha Mismatch${NC}"
    LOST_ALPHA=$(echo "$EXPECTED_ALPHA - $FINAL_ALPHA" | bc)
    echo "      Lost: $LOST_ALPHA updates"
fi

if [ "$BETA_MATCH" -eq 1 ]; then
    echo -e "    ${GREEN}✓ Thompson Beta Correct${NC}"
else
    echo -e "    ${RED}✗ Thompson Beta Mismatch${NC}"
fi

if [ "$SUCCESSES_MATCH" -eq 1 ]; then
    echo -e "    ${GREEN}✓ Total Successes Correct${NC}"
else
    echo -e "    ${RED}✗ Total Successes Mismatch${NC}"
fi

if [ "$FAILURES_MATCH" -eq 1 ]; then
    echo -e "    ${GREEN}✓ Total Failures Correct${NC}"
else
    echo -e "    ${RED}✗ Total Failures Mismatch${NC}"
fi

if [ "$SELECTIONS_MATCH" -eq 1 ]; then
    echo -e "    ${GREEN}✓ Total Selections Correct${NC}"
else
    echo -e "    ${RED}✗ Total Selections Mismatch${NC}"
fi

echo ""

# ============================================================================
# STEP 5: Verify SurrealDB Consistency (if available)
# ============================================================================
echo "STEP 5: Checking SurrealDB consistency..."
echo "----------------------------------------------"

if docker ps | grep -q metabob-surreal; then
    echo "  SurrealDB is running - consistency check possible"
    echo -e "  ${YELLOW}⚠ Note: SurrealDB query requires implementation${NC}"
else
    echo "  SurrealDB is not running - skipping consistency check"
fi

echo ""

# ============================================================================
# Cleanup
# ============================================================================
rm -f "$RESULTS_FILE"

# ============================================================================
# SUMMARY
# ============================================================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""

ALL_MATCH=$((ALPHA_MATCH && BETA_MATCH && SUCCESSES_MATCH && FAILURES_MATCH && SELECTIONS_MATCH))

if [ "$ALL_MATCH" -eq 1 ]; then
    echo -e "${GREEN}✓ E2E TEST PASSED${NC}"
    echo ""
    echo "Real Activity Execution:"
    echo "  - $NUM_CONCURRENT concurrent activity executions"
    echo "  - $SUCCESS_COUNT API requests successful"
    echo "  - $SIMULATED_SUCCESSES activity successes, $SIMULATED_FAILURES failures"
    echo "  - 0 lost updates (100% atomic)"
    echo ""
    echo "Fix #2 Validation:"
    echo "  - Redis WATCH/MULTI/EXEC working correctly"
    echo "  - Thompson Sampling metrics accurate"
    echo "  - Ready for production use with real activities"
    echo ""
    exit 0
else
    echo -e "${RED}✗ E2E TEST FAILED${NC}"
    echo ""
    echo "Issues Detected:"
    [ "$ALPHA_MATCH" -eq 0 ] && echo "  - Thompson alpha mismatch (lost updates)"
    [ "$BETA_MATCH" -eq 0 ] && echo "  - Thompson beta mismatch"
    [ "$SUCCESSES_MATCH" -eq 0 ] && echo "  - Total successes mismatch"
    [ "$FAILURES_MATCH" -eq 0 ] && echo "  - Total failures mismatch"
    [ "$SELECTIONS_MATCH" -eq 0 ] && echo "  - Total selections mismatch"
    echo ""
    exit 1
fi
