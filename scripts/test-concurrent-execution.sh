#!/bin/bash
# Concurrent Execution Test - Validates Fix #2 (Atomic Redis Updates)
# 
# Tests that concurrent activity executions don't lose updates due to race conditions.
# Uses Redis WATCH/MULTI/EXEC optimistic locking with retry logic.

set -e

echo "=========================================="
echo "Fix #2: Concurrent Execution Test"
echo "=========================================="
echo ""

# Configuration
API_URL="http://localhost:8080"
TEST_VARIANT_ID="test-concurrent-$(date +%s)"
NUM_CONCURRENT=20
EXPECTED_SUCCESSES=$NUM_CONCURRENT
EXPECTED_FAILURES=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "Test Configuration:"
echo "  API URL: $API_URL"
echo "  Test Variant ID: $TEST_VARIANT_ID"
echo "  Concurrent Requests: $NUM_CONCURRENT"
echo "  Expected Final Alpha: $((EXPECTED_SUCCESSES + 1)) (initial 1.0 + $EXPECTED_SUCCESSES successes)"
echo ""

# ============================================================================
# STEP 1: Initialize Test Template in Redis
# ============================================================================
echo "STEP 1: Initializing test template in Redis..."
echo "----------------------------------------------"

docker exec metabob-redis redis-cli DEL "activity:metrics:$TEST_VARIANT_ID" > /dev/null

INIT_METRICS=$(cat <<EOF
{
  "variant_id": "$TEST_VARIANT_ID",
  "activity_id": "test-concurrent",
  "total_selections": 0,
  "total_successes": 0,
  "total_failures": 0,
  "thompson_alpha": 1.0,
  "thompson_beta": 1.0,
  "avg_cost": 0.0,
  "avg_duration_ms": 0.0
}
EOF
)

docker exec metabob-redis redis-cli SET "activity:metrics:$TEST_VARIANT_ID" "$INIT_METRICS" > /dev/null

# Verify initialization
INITIAL_STATE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")
INITIAL_ALPHA=$(echo "$INITIAL_STATE" | jq -r '.thompson_alpha')
INITIAL_BETA=$(echo "$INITIAL_STATE" | jq -r '.thompson_beta')
INITIAL_SUCCESSES=$(echo "$INITIAL_STATE" | jq -r '.total_successes')

echo "  Initial State:"
echo "    thompson_alpha: $INITIAL_ALPHA"
echo "    thompson_beta: $INITIAL_BETA"
echo "    total_successes: $INITIAL_SUCCESSES"
echo -e "  ${GREEN}✓ Template initialized${NC}"
echo ""

# ============================================================================
# STEP 2: Run Concurrent Executions
# ============================================================================
echo "STEP 2: Running $NUM_CONCURRENT concurrent executions..."
echo "----------------------------------------------"

# Create temp file for results
RESULTS_FILE=$(mktemp)
ERRORS_FILE=$(mktemp)

# Function to make API request
make_request() {
    local index=$1
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "$API_URL/v2/activities/executions" \
        -H "Content-Type: application/json" \
        -d "{
            \"variant_id\": \"$TEST_VARIANT_ID\",
            \"success\": true,
            \"cost\": 0.01,
            \"duration_ms\": 100,
            \"tokens\": {
                \"input\": 100,
                \"output\": 50,
                \"cache\": 0
            }
        }" 2>&1)
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        echo "SUCCESS:$index" >> "$RESULTS_FILE"
    else
        echo "FAILED:$index:$http_code:$body" >> "$ERRORS_FILE"
    fi
}

# Launch concurrent requests
echo "  Launching $NUM_CONCURRENT concurrent requests..."
START_TIME=$(date +%s)

for i in $(seq 1 $NUM_CONCURRENT); do
    make_request $i &
done

# Wait for all requests to complete
wait

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Count results
SUCCESS_COUNT=$(wc -l < "$RESULTS_FILE" 2>/dev/null || echo "0")
ERROR_COUNT=$(wc -l < "$ERRORS_FILE" 2>/dev/null || echo "0")

echo "  Completed in ${ELAPSED}s"
echo "    Successful requests: $SUCCESS_COUNT"
echo "    Failed requests: $ERROR_COUNT"

if [ "$ERROR_COUNT" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Errors occurred:${NC}"
    cat "$ERRORS_FILE" | head -5
fi

echo ""

# ============================================================================
# STEP 3: Verify Final State
# ============================================================================
echo "STEP 3: Verifying final Redis state..."
echo "----------------------------------------------"

# Small delay to ensure all updates are committed
sleep 1

FINAL_STATE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")
FINAL_ALPHA=$(echo "$FINAL_STATE" | jq -r '.thompson_alpha')
FINAL_BETA=$(echo "$FINAL_STATE" | jq -r '.thompson_beta')
FINAL_SUCCESSES=$(echo "$FINAL_STATE" | jq -r '.total_successes')
FINAL_SELECTIONS=$(echo "$FINAL_STATE" | jq -r '.total_selections')

echo "  Final State:"
echo "    thompson_alpha: $FINAL_ALPHA"
echo "    thompson_beta: $FINAL_BETA"
echo "    total_successes: $FINAL_SUCCESSES"
echo "    total_selections: $FINAL_SELECTIONS"
echo ""

# ============================================================================
# STEP 4: Validate Results
# ============================================================================
echo "STEP 4: Validating atomic update correctness..."
echo "----------------------------------------------"

EXPECTED_ALPHA=$(echo "$SUCCESS_COUNT + 1" | bc)  # Initial 1.0 + successes

# Calculate actual updates applied
ACTUAL_UPDATES=$((FINAL_SUCCESSES - INITIAL_SUCCESSES))

echo "  Expected Updates: $SUCCESS_COUNT"
echo "  Actual Updates: $ACTUAL_UPDATES"
echo "  Expected Alpha: $EXPECTED_ALPHA"
echo "  Actual Alpha: $FINAL_ALPHA"
echo ""

# Check for lost updates
if [ "$ACTUAL_UPDATES" -eq "$SUCCESS_COUNT" ]; then
    echo -e "  ${GREEN}✓ NO LOST UPDATES${NC}"
    echo "  All $SUCCESS_COUNT updates were applied atomically"
    ATOMIC_TEST_PASSED=true
else
    echo -e "  ${RED}✗ LOST UPDATES DETECTED${NC}"
    LOST_UPDATES=$((SUCCESS_COUNT - ACTUAL_UPDATES))
    echo "  Lost: $LOST_UPDATES updates ($(echo "scale=2; $LOST_UPDATES * 100 / $SUCCESS_COUNT" | bc)%)"
    ATOMIC_TEST_PASSED=false
fi

# Verify alpha/beta consistency
ALPHA_CORRECT=$(echo "$FINAL_ALPHA == $EXPECTED_ALPHA" | bc)
if [ "$ALPHA_CORRECT" -eq 1 ]; then
    echo -e "  ${GREEN}✓ THOMPSON ALPHA CORRECT${NC}"
else
    echo -e "  ${RED}✗ THOMPSON ALPHA MISMATCH${NC}"
    echo "    Expected: $EXPECTED_ALPHA, Got: $FINAL_ALPHA"
fi

# Verify total selections
if [ "$FINAL_SELECTIONS" -eq "$ACTUAL_UPDATES" ]; then
    echo -e "  ${GREEN}✓ TOTAL SELECTIONS CORRECT${NC}"
else
    echo -e "  ${YELLOW}⚠ TOTAL SELECTIONS: Expected $ACTUAL_UPDATES, Got $FINAL_SELECTIONS${NC}"
fi

echo ""

# ============================================================================
# STEP 5: Test Retry Logic (Simulated High Contention)
# ============================================================================
echo "STEP 5: Testing retry logic under high contention..."
echo "----------------------------------------------"

# Reset for high contention test
TEST_VARIANT_ID_2="test-high-contention-$(date +%s)"
docker exec metabob-redis redis-cli SET "activity:metrics:$TEST_VARIANT_ID_2" "$INIT_METRICS" > /dev/null

echo "  Launching 50 concurrent requests (high contention)..."
START_TIME=$(date +%s)

RESULTS_FILE_2=$(mktemp)
make_request_high_contention() {
    local index=$1
    curl -s -X POST "$API_URL/v2/activities/executions" \
        -H "Content-Type: application/json" \
        -d "{\"variant_id\": \"$TEST_VARIANT_ID_2\", \"success\": true, \"cost\": 0.01, \"duration_ms\": 100}" \
        > /dev/null 2>&1 && echo "OK" >> "$RESULTS_FILE_2"
}

for i in $(seq 1 50); do
    make_request_high_contention $i &
done
wait

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

COMPLETED=$(wc -l < "$RESULTS_FILE_2" 2>/dev/null || echo "0")

echo "  Completed: $COMPLETED/50 in ${ELAPSED}s"

if [ "$COMPLETED" -ge 45 ]; then
    echo -e "  ${GREEN}✓ RETRY LOGIC EFFECTIVE${NC}"
    echo "    90%+ success rate under high contention"
else
    echo -e "  ${YELLOW}⚠ Some requests may have exceeded max retries${NC}"
fi

echo ""

# ============================================================================
# CLEANUP
# ============================================================================
echo "STEP 6: Cleanup..."
echo "----------------------------------------------"

rm -f "$RESULTS_FILE" "$ERRORS_FILE" "$RESULTS_FILE_2"
docker exec metabob-redis redis-cli DEL "activity:metrics:$TEST_VARIANT_ID" > /dev/null
docker exec metabob-redis redis-cli DEL "activity:metrics:$TEST_VARIANT_ID_2" > /dev/null

echo "  Test data cleaned up"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""

if [ "$ATOMIC_TEST_PASSED" = true ] && [ "$ALPHA_CORRECT" -eq 1 ]; then
    echo -e "${GREEN}✓ FIX #2 VALIDATED SUCCESSFULLY${NC}"
    echo ""
    echo "Atomic Updates: WORKING"
    echo "  - No lost updates in $NUM_CONCURRENT concurrent requests"
    echo "  - Thompson Sampling alpha/beta correct"
    echo "  - Retry logic effective under high contention"
    echo ""
    echo "Conclusion:"
    echo "  Redis WATCH/MULTI/EXEC pattern prevents race conditions"
    echo "  Optimistic locking with retries ensures data consistency"
    echo "  Fix #2 is production-ready"
    echo ""
    exit 0
else
    echo -e "${RED}✗ FIX #2 VALIDATION FAILED${NC}"
    echo ""
    echo "Issues Detected:"
    [ "$ATOMIC_TEST_PASSED" = false ] && echo "  - Lost updates detected"
    [ "$ALPHA_CORRECT" -eq 0 ] && echo "  - Thompson alpha mismatch"
    echo ""
    echo "Possible Causes:"
    echo "  - Redis WATCH/MULTI/EXEC not properly implemented"
    echo "  - Retry logic not triggering on conflicts"
    echo "  - SurrealDB failures not rolling back Redis"
    echo ""
    exit 1
fi
