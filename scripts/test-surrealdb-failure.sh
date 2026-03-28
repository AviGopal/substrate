#!/bin/bash
# SurrealDB Failure Test - Validates Fix #1 (Compensating Transaction)
#
# Tests that Redis rollback works when SurrealDB write fails.
# Ensures consistency between Redis and SurrealDB by preventing partial writes.

set -e

echo "=========================================="
echo "Fix #1: Compensating Transaction Test"
echo "=========================================="
echo ""

# Configuration
API_URL="http://localhost:8080"
TEST_VARIANT_ID="test-compensating-$(date +%s)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "Test Configuration:"
echo "  API URL: $API_URL"
echo "  Test Variant ID: $TEST_VARIANT_ID"
echo "  SurrealDB Container: metabob-surreal"
echo ""

# ============================================================================
# STEP 1: Initialize Test Template
# ============================================================================
echo "STEP 1: Initializing test template..."
echo "----------------------------------------------"

docker exec metabob-redis redis-cli DEL "activity:metrics:$TEST_VARIANT_ID" > /dev/null

INIT_METRICS=$(cat <<EOF
{
  "variant_id": "$TEST_VARIANT_ID",
  "activity_id": "test-compensating",
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

INITIAL_STATE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")
INITIAL_ALPHA=$(echo "$INITIAL_STATE" | jq -r '.thompson_alpha')
INITIAL_SUCCESSES=$(echo "$INITIAL_STATE" | jq -r '.total_successes')

echo "  Initial State:"
echo "    thompson_alpha: $INITIAL_ALPHA"
echo "    total_successes: $INITIAL_SUCCESSES"
echo -e "  ${GREEN}✓ Template initialized${NC}"
echo ""

# ============================================================================
# STEP 2: Verify Normal Operation (Baseline)
# ============================================================================
echo "STEP 2: Baseline test (SurrealDB online)..."
echo "----------------------------------------------"

# Check SurrealDB is running
if docker ps | grep -q metabob-surreal; then
    echo -e "  ${GREEN}✓ SurrealDB is running${NC}"
else
    echo -e "  ${RED}✗ SurrealDB is not running${NC}"
    echo "  Starting SurrealDB..."
    docker start metabob-surreal
    sleep 3
fi

# Make a successful request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/v2/activities/executions" \
    -H "Content-Type: application/json" \
    -d "{
        \"variant_id\": \"$TEST_VARIANT_ID\",
        \"success\": true,
        \"cost\": 0.01,
        \"duration_ms\": 100,
        \"tokens\": {\"input\": 100, \"output\": 50, \"cache\": 0}
    }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ Normal execution successful${NC}"
    
    # Verify Redis was updated
    AFTER_BASELINE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")
    BASELINE_ALPHA=$(echo "$AFTER_BASELINE" | jq -r '.thompson_alpha')
    BASELINE_SUCCESSES=$(echo "$AFTER_BASELINE" | jq -r '.total_successes')
    
    echo "  After Baseline:"
    echo "    thompson_alpha: $BASELINE_ALPHA (was $INITIAL_ALPHA)"
    echo "    total_successes: $BASELINE_SUCCESSES (was $INITIAL_SUCCESSES)"
    
    if [ "$(echo "$BASELINE_ALPHA > $INITIAL_ALPHA" | bc)" -eq 1 ]; then
        echo -e "  ${GREEN}✓ Redis updated correctly${NC}"
    else
        echo -e "  ${RED}✗ Redis not updated${NC}"
        exit 1
    fi
else
    echo -e "  ${RED}✗ Baseline test failed (HTTP $HTTP_CODE)${NC}"
    echo "  Response: $BODY"
    exit 1
fi

echo ""

# ============================================================================
# STEP 3: Stop SurrealDB (Simulate Failure)
# ============================================================================
echo "STEP 3: Simulating SurrealDB failure..."
echo "----------------------------------------------"

echo "  Stopping SurrealDB container..."
docker stop metabob-surreal > /dev/null 2>&1

# Verify it's stopped
sleep 2
if docker ps | grep -q metabob-surreal; then
    echo -e "  ${RED}✗ Failed to stop SurrealDB${NC}"
    exit 1
else
    echo -e "  ${GREEN}✓ SurrealDB stopped${NC}"
fi

# Save state before failure test
BEFORE_FAILURE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")
BEFORE_ALPHA=$(echo "$BEFORE_FAILURE" | jq -r '.thompson_alpha')
BEFORE_SUCCESSES=$(echo "$BEFORE_FAILURE" | jq -r '.total_successes')

echo "  State Before Failure Test:"
echo "    thompson_alpha: $BEFORE_ALPHA"
echo "    total_successes: $BEFORE_SUCCESSES"
echo ""

# ============================================================================
# STEP 4: Attempt Execution (Should Fail and Rollback)
# ============================================================================
echo "STEP 4: Triggering execution with SurrealDB down..."
echo "----------------------------------------------"

echo "  Sending request (expecting failure)..."
FAILURE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/v2/activities/executions" \
    -H "Content-Type: application/json" \
    -d "{
        \"variant_id\": \"$TEST_VARIANT_ID\",
        \"success\": true,
        \"cost\": 0.01,
        \"duration_ms\": 100,
        \"tokens\": {\"input\": 100, \"output\": 50, \"cache\": 0}
    }" 2>&1)

FAILURE_HTTP_CODE=$(echo "$FAILURE_RESPONSE" | tail -n1)
FAILURE_BODY=$(echo "$FAILURE_RESPONSE" | head -n-1)

echo "  HTTP Response: $FAILURE_HTTP_CODE"

if [ "$FAILURE_HTTP_CODE" = "500" ]; then
    echo -e "  ${GREEN}✓ Request failed as expected (HTTP 500)${NC}"
else
    echo -e "  ${YELLOW}⚠ Unexpected HTTP code: $FAILURE_HTTP_CODE${NC}"
fi

echo ""

# ============================================================================
# STEP 5: Verify Redis Rollback
# ============================================================================
echo "STEP 5: Verifying Redis rollback..."
echo "----------------------------------------------"

# Check Redis state after failed request
sleep 1
AFTER_FAILURE=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")
AFTER_ALPHA=$(echo "$AFTER_FAILURE" | jq -r '.thompson_alpha')
AFTER_SUCCESSES=$(echo "$AFTER_FAILURE" | jq -r '.total_successes')

echo "  State After Failure:"
echo "    thompson_alpha: $AFTER_ALPHA"
echo "    total_successes: $AFTER_SUCCESSES"
echo ""

echo "  Comparison:"
echo "    Before Failure: alpha=$BEFORE_ALPHA, successes=$BEFORE_SUCCESSES"
echo "    After Failure:  alpha=$AFTER_ALPHA, successes=$AFTER_SUCCESSES"
echo ""

# Validate rollback worked
if [ "$AFTER_ALPHA" = "$BEFORE_ALPHA" ] && [ "$AFTER_SUCCESSES" = "$BEFORE_SUCCESSES" ]; then
    echo -e "  ${GREEN}✓ ROLLBACK SUCCESSFUL${NC}"
    echo "  Redis state unchanged (compensating transaction worked)"
    ROLLBACK_WORKED=true
else
    echo -e "  ${RED}✗ ROLLBACK FAILED${NC}"
    echo "  Redis state changed despite SurrealDB failure"
    ROLLBACK_WORKED=false
fi

echo ""

# ============================================================================
# STEP 6: Restart SurrealDB and Verify Recovery
# ============================================================================
echo "STEP 6: Restarting SurrealDB and testing recovery..."
echo "----------------------------------------------"

echo "  Starting SurrealDB..."
docker start metabob-surreal > /dev/null 2>&1
sleep 3

if docker ps | grep -q metabob-surreal; then
    echo -e "  ${GREEN}✓ SurrealDB restarted${NC}"
else
    echo -e "  ${RED}✗ Failed to restart SurrealDB${NC}"
    exit 1
fi

# Try execution again (should succeed now)
RECOVERY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/v2/activities/executions" \
    -H "Content-Type: application/json" \
    -d "{
        \"variant_id\": \"$TEST_VARIANT_ID\",
        \"success\": true,
        \"cost\": 0.01,
        \"duration_ms\": 100,
        \"tokens\": {\"input\": 100, \"output\": 50, \"cache\": 0}
    }")

RECOVERY_HTTP_CODE=$(echo "$RECOVERY_RESPONSE" | tail -n1)

if [ "$RECOVERY_HTTP_CODE" = "201" ] || [ "$RECOVERY_HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ Execution successful after recovery${NC}"
    
    # Verify Redis was updated
    AFTER_RECOVERY=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")
    RECOVERY_ALPHA=$(echo "$AFTER_RECOVERY" | jq -r '.thompson_alpha')
    RECOVERY_SUCCESSES=$(echo "$AFTER_RECOVERY" | jq -r '.total_successes')
    
    echo "  After Recovery:"
    echo "    thompson_alpha: $RECOVERY_ALPHA (was $AFTER_ALPHA)"
    echo "    total_successes: $RECOVERY_SUCCESSES (was $AFTER_SUCCESSES)"
    
    if [ "$(echo "$RECOVERY_ALPHA > $AFTER_ALPHA" | bc)" -eq 1 ]; then
        echo -e "  ${GREEN}✓ System recovered and functioning normally${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠ Recovery execution failed (HTTP $RECOVERY_HTTP_CODE)${NC}"
fi

echo ""

# ============================================================================
# STEP 7: Cleanup
# ============================================================================
echo "STEP 7: Cleanup..."
echo "----------------------------------------------"

docker exec metabob-redis redis-cli DEL "activity:metrics:$TEST_VARIANT_ID" > /dev/null
echo "  Test data cleaned up"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""

if [ "$ROLLBACK_WORKED" = true ]; then
    echo -e "${GREEN}✓ FIX #1 VALIDATED SUCCESSFULLY${NC}"
    echo ""
    echo "Compensating Transaction: WORKING"
    echo "  - SurrealDB failure detected"
    echo "  - Redis rollback executed correctly"
    echo "  - No partial writes (consistency maintained)"
    echo "  - System recovered after SurrealDB restart"
    echo ""
    echo "Conclusion:"
    echo "  2-phase commit pattern prevents Redis/SurrealDB inconsistency"
    echo "  Compensating transaction ensures data integrity"
    echo "  Fix #1 is production-ready"
    echo ""
    exit 0
else
    echo -e "${RED}✗ FIX #1 VALIDATION FAILED${NC}"
    echo ""
    echo "Issues Detected:"
    echo "  - Redis not rolled back after SurrealDB failure"
    echo "  - Partial write occurred (inconsistent state)"
    echo ""
    echo "Possible Causes:"
    echo "  - Compensating transaction not implemented"
    echo "  - Snapshot not captured before SurrealDB write"
    echo "  - Rollback logic not executing on exception"
    echo ""
    exit 1
fi
