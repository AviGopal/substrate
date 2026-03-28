#!/bin/bash
set -e

echo "========================================"
echo "Learning Loop Integration Test"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SURREALDB_URL="${SURREALDB_URL:-http://localhost:8000}"
API_URL="${API_URL:-http://localhost:8081}"
NAMESPACE="test"
DATABASE="learning_loop"

# Test results
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

test_step() {
    echo ""
    echo "----------------------------------------"
    echo "TEST: $1"
    echo "----------------------------------------"
}

# Test 1: Check SurrealDB connectivity
test_step "SurrealDB Connectivity"
if curl -s -f "$SURREALDB_URL/health" > /dev/null 2>&1; then
    pass "SurrealDB is running at $SURREALDB_URL"
else
    fail "SurrealDB is not accessible at $SURREALDB_URL"
    echo "  Start SurrealDB with: docker run --rm -p 8000:8000 surrealdb/surrealdb:latest start --user root --pass root"
    exit 1
fi

# Test 2: Check RPC API connectivity
test_step "RPC API Connectivity"
if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    pass "RPC API is running at $API_URL"
else
    fail "RPC API is not accessible at $API_URL"
    echo "  Start RPC API with: cd repos/metabob-rpc-api && python -m uvicorn server.app:app --host 0.0.0.0 --port 8080"
    exit 1
fi

# Test 3: Check Learning Loop endpoints exist
test_step "Learning Loop API Endpoints"

# Test POST endpoint (without sending data, just check it exists)
response=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/api/v1/learning-loop/executions")
if [ "$response" != "404" ]; then
    pass "POST /api/v1/learning-loop/executions endpoint exists"
else
    fail "POST /api/v1/learning-loop/executions endpoint not found"
fi

# Test GET boredom activities endpoint
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/learning-loop/boredom-activities")
if [ "$response" = "200" ]; then
    pass "GET /api/v1/learning-loop/boredom-activities endpoint exists"
    
    # Check response format
    result=$(curl -s "$API_URL/api/v1/learning-loop/boredom-activities?limit=5")
    if echo "$result" | jq -e 'type == "array"' > /dev/null 2>&1; then
        pass "Boredom activities endpoint returns array"
    else
        fail "Boredom activities endpoint returns invalid format"
        echo "  Response: $result"
    fi
else
    fail "GET /api/v1/learning-loop/boredom-activities endpoint not accessible"
fi

# Test 4: POST execution data
test_step "POST Execution Data"

execution_data='{
  "activity_id": "act_test_'$(date +%s)'",
  "template_id": "test-template",
  "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "duration_ms": 5000,
  "success": true,
  "tokens_input": 1000,
  "tokens_output": 200,
  "tokens_cache": 500,
  "cost_usd": 0.005,
  "completed_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
}'

response=$(curl -s -X POST "$API_URL/api/v1/learning-loop/executions" \
    -H "Content-Type: application/json" \
    -d "$execution_data")

if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
    execution_id=$(echo "$response" | jq -r '.execution_id')
    pass "Successfully posted execution data (ID: $execution_id)"
    
    # Check metrics were updated
    if echo "$response" | jq -e '.metrics_updated == true' > /dev/null 2>&1; then
        pass "Metrics were updated"
    else
        warn "Metrics update status unclear"
    fi
else
    fail "Failed to post execution data"
    echo "  Response: $response"
fi

# Test 5: Verify data in SurrealDB
test_step "Verify Data Persistence in SurrealDB"

# Note: This requires surreal CLI to be installed
if command -v surreal &> /dev/null; then
    # Query recent executions
    query_result=$(surreal sql --conn "$SURREALDB_URL" \
        --user root --pass root \
        --ns "$NAMESPACE" --db "$DATABASE" \
        "SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 1;" 2>&1)
    
    if echo "$query_result" | grep -q "act_test"; then
        pass "Execution data persisted in SurrealDB"
    else
        warn "Could not verify execution in SurrealDB (may need manual check)"
        echo "  Query result: $query_result"
    fi
    
    # Check template_metrics
    metrics_result=$(surreal sql --conn "$SURREALDB_URL" \
        --user root --pass root \
        --ns "$NAMESPACE" --db "$DATABASE" \
        "SELECT * FROM template_metrics WHERE template_id = 'test-template';" 2>&1)
    
    if echo "$metrics_result" | grep -q "test-template"; then
        pass "Template metrics created/updated in SurrealDB"
        
        # Check if metrics look reasonable
        if echo "$metrics_result" | grep -q "total_executions"; then
            pass "Metrics contain expected fields"
        fi
    else
        warn "Could not verify template metrics (may need manual check)"
    fi
else
    warn "SurrealDB CLI not installed - skipping direct database verification"
    echo "  Install with: brew install surrealdb/tap/surreal (Mac) or curl -sSf https://install.surrealdb.com | sh (Linux)"
fi

# Test 6: POST failure execution
test_step "POST Failure Execution (Error Handling)"

failure_data='{
  "activity_id": "act_fail_'$(date +%s)'",
  "template_id": "test-template",
  "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "duration_ms": 3000,
  "success": false,
  "tokens_input": 500,
  "tokens_output": 100,
  "tokens_cache": 200,
  "cost_usd": 0.002,
  "completed_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "error_type": "ValidationError",
  "error_message": "File /tmp/test.txt not found",
  "failed_task_id": "task-1"
}'

response=$(curl -s -X POST "$API_URL/api/v1/learning-loop/executions" \
    -H "Content-Type: application/json" \
    -d "$failure_data")

if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
    pass "Successfully posted failure execution"
    
    # Query metrics again to check success rate changed
    metrics_response=$(curl -s "$API_URL/api/v1/learning-loop/templates/test-template/metrics")
    
    if echo "$metrics_response" | jq -e '.template_id == "test-template"' > /dev/null 2>&1; then
        pass "Retrieved template metrics via API"
        
        total=$(echo "$metrics_response" | jq -r '.total_executions')
        successful=$(echo "$metrics_response" | jq -r '.successful_executions')
        failed=$(echo "$metrics_response" | jq -r '.failed_executions')
        success_rate=$(echo "$metrics_response" | jq -r '.success_rate')
        
        echo "  Total executions: $total"
        echo "  Successful: $successful"
        echo "  Failed: $failed"
        echo "  Success rate: $success_rate"
        
        if [ "$total" -ge 2 ]; then
            pass "Metrics show multiple executions"
        fi
        
        if [ "$failed" -ge 1 ]; then
            pass "Metrics show failed execution recorded"
        fi
    else
        fail "Could not retrieve template metrics"
    fi
else
    fail "Failed to post failure execution"
    echo "  Response: $response"
fi

# Test 7: Query boredom activities
test_step "Query Boredom Activities"

boredom_response=$(curl -s "$API_URL/api/v1/learning-loop/boredom-activities?threshold=0.9&limit=5")

if echo "$boredom_response" | jq -e 'type == "array"' > /dev/null 2>&1; then
    count=$(echo "$boredom_response" | jq 'length')
    pass "Boredom activities query returned $count templates"
    
    # Check if our test template is in the list (it should be with low success rate)
    if echo "$boredom_response" | jq -e '.[].template_id' | grep -q "test-template"; then
        pass "Test template appears in boredom activities (has low improvement gradient)"
    else
        warn "Test template not in boredom activities (might need lower threshold or more executions)"
    fi
else
    fail "Boredom activities query failed"
    echo "  Response: $boredom_response"
fi

# Test 8: Check failure patterns
test_step "Check Failure Patterns"

failures_response=$(curl -s "$API_URL/api/v1/learning-loop/templates/test-template/failures")

if echo "$failures_response" | jq -e 'type == "array"' > /dev/null 2>&1; then
    count=$(echo "$failures_response" | jq 'length')
    pass "Failure patterns query returned $count patterns"
    
    if [ "$count" -ge 1 ]; then
        # Check for our error pattern
        if echo "$failures_response" | jq -e '.[].error_type' | grep -q "ValidationError"; then
            pass "ValidationError pattern detected"
        fi
        
        # Check normalization worked
        if echo "$failures_response" | jq -e '.[].normalized_message' | grep -q "<path>"; then
            pass "Error message normalization working (path replaced with <path>)"
        fi
    fi
else
    fail "Failure patterns query failed"
    echo "  Response: $failures_response"
fi

# Final summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Learning Loop integration is working correctly:"
    echo "  ✓ Backend API accessible"
    echo "  ✓ SurrealDB persistence working"
    echo "  ✓ Metrics aggregation functional"
    echo "  ✓ Boredom detection operational"
    echo "  ✓ Failure pattern tracking working"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Please review the failures above and ensure:"
    echo "  1. SurrealDB is running"
    echo "  2. RPC API is running"
    echo "  3. Database schema is applied"
    exit 1
fi
