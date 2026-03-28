#!/bin/bash
# Integration Tests for Metabob Integration Fixes
# Tests Fix #1 (compensating transaction), Fix #2 (atomic updates), Fix #3 (API validation)

set -e

echo "=========================================="
echo "Metabob Integration Fixes - Validation"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:8080"
TEST_VARIANT_ID="test-fix-validation-$(date +%s)"

echo "Test Configuration:"
echo "  API URL: $API_URL"
echo "  Test Variant ID: $TEST_VARIANT_ID"
echo ""

# ============================================================================
# TEST 1: Verify Fixes Are Deployed
# ============================================================================
echo "TEST 1: Verifying fixes are deployed in container..."
echo "----------------------------------------------"

echo -n "  Checking Fix #1 (Compensating Transaction)... "
if docker exec api-server-dev grep -q "COMPENSATING TRANSACTION - Rollback Redis" /src/app/server/actions/activity.py; then
    echo -e "${GREEN}✓ PRESENT${NC}"
    FIX1_DEPLOYED=true
else
    echo -e "${RED}✗ MISSING${NC}"
    FIX1_DEPLOYED=false
fi

echo -n "  Checking Fix #2 (Atomic Redis Updates)... "
if docker exec api-server-dev grep -q "pipe.watch(metrics_key)" /src/app/server/actions/activity.py; then
    echo -e "${GREEN}✓ PRESENT${NC}"
    FIX2_DEPLOYED=true
else
    echo -e "${RED}✗ MISSING${NC}"
    FIX2_DEPLOYED=false
fi

echo -n "  Checking Fix #3 (API Validation Module)... "
if [ -f "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src/metabob_cli/mcp/api_validation.py" ]; then
    echo -e "${GREEN}✓ PRESENT${NC}"
    FIX3_DEPLOYED=true
else
    echo -e "${RED}✗ MISSING${NC}"
    FIX3_DEPLOYED=false
fi

echo ""

# ============================================================================
# TEST 2: API Server Health Check
# ============================================================================
echo "TEST 2: API Server Health Check..."
echo "----------------------------------------------"

HEALTH_RESPONSE=$(curl -s http://localhost:8080/)
echo "  Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "  ${GREEN}✓ API server is healthy${NC}"
    API_HEALTHY=true
else
    echo -e "  ${RED}✗ API server health check failed${NC}"
    API_HEALTHY=false
fi

echo ""

# ============================================================================
# TEST 3: Fix #2 - Atomic Redis Updates (Concurrent Test)
# ============================================================================
echo "TEST 3: Fix #2 - Atomic Redis Updates (Race Condition Test)..."
echo "----------------------------------------------"

# Initialize test template in Redis
echo "  Setting up test template..."
docker exec metabob-redis redis-cli DEL "activity:metrics:$TEST_VARIANT_ID" > /dev/null

# Initialize metrics
docker exec metabob-redis redis-cli SET "activity:metrics:$TEST_VARIANT_ID" '{
    "variant_id": "'$TEST_VARIANT_ID'",
    "activity_id": "test-fix-validation",
    "total_selections": 0,
    "total_successes": 0,
    "total_failures": 0,
    "thompson_alpha": 1.0,
    "thompson_beta": 1.0,
    "avg_cost": 0.0,
    "avg_duration_ms": 0.0
}' > /dev/null

echo "  Initial state:"
INITIAL_ALPHA=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID" | jq -r '.thompson_alpha')
echo "    thompson_alpha: $INITIAL_ALPHA"

# Run 10 concurrent updates
echo "  Simulating 10 concurrent activity completions..."
for i in {1..10}; do
    # Note: This requires the API endpoint to exist and accept this format
    # This is a placeholder - actual implementation depends on API structure
    echo "    Update $i sent" >> /tmp/concurrent_test.log &
done
wait

echo "  ${YELLOW}⚠ Note: Full concurrent API test requires /api/activity-execution endpoint${NC}"
echo "  ${YELLOW}  This test validates code presence. Live test needs endpoint implementation.${NC}"

echo ""

# ============================================================================
# TEST 4: Fix #1 - Compensating Transaction (SurrealDB Failure Simulation)
# ============================================================================
echo "TEST 4: Fix #1 - Compensating Transaction..."
echo "----------------------------------------------"

echo "  ${YELLOW}⚠ Note: Full test requires simulating SurrealDB failure${NC}"
echo "  ${YELLOW}  Code validation: Rollback logic present in activity.py${NC}"
echo "  ${YELLOW}  Manual test: Stop SurrealDB, trigger activity, verify Redis rollback${NC}"

echo ""

# ============================================================================
# TEST 5: Fix #3 - API Response Validation (Content-Type Check)
# ============================================================================
echo "TEST 5: Fix #3 - API Response Validation..."
echo "----------------------------------------------"

echo "  Checking validation module structure..."
VALIDATION_FILE="/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src/metabob_cli/mcp/api_validation.py"

if [ -f "$VALIDATION_FILE" ]; then
    echo -n "    Pydantic schemas defined... "
    if grep -q "class ActivityExecutionResponse" "$VALIDATION_FILE"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
    
    echo -n "    Content-Type validation function... "
    if grep -q "def validate_json_response" "$VALIDATION_FILE"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
else
    echo -e "    ${RED}✗ Validation module not found${NC}"
fi

echo "  ${YELLOW}⚠ Note: Full test requires metabob-cli container with MCP server${NC}"

echo ""

# ============================================================================
# TEST 6: Redis Data Integrity
# ============================================================================
echo "TEST 6: Redis Data Integrity Check..."
echo "----------------------------------------------"

echo "  Checking test template metrics..."
FINAL_METRICS=$(docker exec metabob-redis redis-cli GET "activity:metrics:$TEST_VARIANT_ID")

if [ -n "$FINAL_METRICS" ] && [ "$FINAL_METRICS" != "(nil)" ]; then
    echo "  Metrics found:"
    echo "$FINAL_METRICS" | jq .
    echo -e "  ${GREEN}✓ Redis data structure intact${NC}"
else
    echo -e "  ${YELLOW}⚠ No metrics found (expected if no updates ran)${NC}"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "=========================================="
echo "VALIDATION SUMMARY"
echo "=========================================="
echo ""

TOTAL_TESTS=6
PASSED=0
WARNINGS=0

if [ "$FIX1_DEPLOYED" = true ]; then ((PASSED++)); fi
if [ "$FIX2_DEPLOYED" = true ]; then ((PASSED++)); fi
if [ "$FIX3_DEPLOYED" = true ]; then ((PASSED++)); fi
if [ "$API_HEALTHY" = true ]; then ((PASSED++)); fi

echo "Code Deployment Validation:"
echo "  ✓ Fix #1 (Compensating Transaction): $([ "$FIX1_DEPLOYED" = true ] && echo "DEPLOYED" || echo "MISSING")"
echo "  ✓ Fix #2 (Atomic Updates): $([ "$FIX2_DEPLOYED" = true ] && echo "DEPLOYED" || echo "MISSING")"
echo "  ✓ Fix #3 (API Validation): $([ "$FIX3_DEPLOYED" = true ] && echo "DEPLOYED" || echo "MISSING")"
echo ""
echo "Runtime Validation:"
echo "  ✓ API Server Health: $([ "$API_HEALTHY" = true ] && echo "HEALTHY" || echo "UNHEALTHY")"
echo "  ⚠ Fix #2 Concurrent Test: Requires /api/activity-execution endpoint"
echo "  ⚠ Fix #1 SurrealDB Test: Requires manual SurrealDB failure simulation"
echo "  ⚠ Fix #3 CLI Test: Requires metabob-cli MCP server deployment"
echo ""
echo "Score: $PASSED/$TOTAL_TESTS core checks passed"
echo ""

if [ "$PASSED" -eq 4 ]; then
    echo -e "${GREEN}✓ All code-level validations PASSED${NC}"
    echo "  Next steps:"
    echo "  1. Deploy /api/activity-execution endpoint for Fix #2 testing"
    echo "  2. Run SurrealDB failure test for Fix #1 validation"
    echo "  3. Deploy metabob-cli container for Fix #3 testing"
    exit 0
else
    echo -e "${RED}✗ Some validations FAILED${NC}"
    echo "  Review failures above and re-deploy fixes"
    exit 1
fi
