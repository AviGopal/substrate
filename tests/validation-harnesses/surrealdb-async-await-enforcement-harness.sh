#!/bin/bash
# Validation Harness: surrealdb-async-await-enforcement
#
# Validates that async/await patterns are correctly enforced in metabob-rpc-api,
# ensuring templates persist to SurrealDB (primary storage) and not just Redis cache.
#
# Test Strategy:
# 1. Create template via POST /v2/activities/templates
# 2. Verify template returned in GET response (from Redis cache)
# 3. Check pod logs for zero "coroutine was never awaited" warnings
# 4. Query SurrealDB directly via kubectl exec to confirm record persisted
# 5. Flush Redis cache
# 6. Query API again - template should still exist (loaded from SurrealDB)
# 7. Verify Redis and SurrealDB are synchronized

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RPC_API_URL="${RPC_API_URL:-http://localhost:8081}"
NAMESPACE="${NAMESPACE:-default}"
REDIS_POD="${REDIS_POD:-redis-0}"
SURREALDB_POD="${SURREALDB_POD:-surrealdb-0}"
RPC_API_POD=""  # Will be detected

# Test data
TEST_TEMPLATE_NAME="validation-test-template-$(date +%s)"
TEST_ACTIVITY_ID=""
TEST_VARIANT_ID=""

# Results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "============================================"
echo "  SurrealDB Async/Await Enforcement Validation"
echo "============================================"
echo ""
echo "Configuration:"
echo "  RPC API URL: $RPC_API_URL"
echo "  Namespace: $NAMESPACE"
echo ""

# Function to log test results
log_test() {
    local test_name=$1
    local result=$2
    local message=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        [ -n "$message" ] && echo "  $message"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        [ -n "$message" ] && echo "  $message"
    fi
}

# Function to detect RPC API pod
detect_rpc_api_pod() {
    echo "Detecting metabob-rpc-api pod..."
    RPC_API_POD=$(kubectl get pods -n "$NAMESPACE" -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$RPC_API_POD" ]; then
        echo -e "${YELLOW}⚠ Warning${NC}: metabob-rpc-api pod not found in cluster"
        echo "  Log checking will be skipped"
    else
        echo "  Found pod: $RPC_API_POD"
    fi
}

# Function to check if RPC API is accessible
check_api_health() {
    echo ""
    echo "Test 1: API Health Check"
    
    if curl -s -f "$RPC_API_URL/health" > /dev/null 2>&1; then
        log_test "API Health Check" "PASS" "RPC API is accessible at $RPC_API_URL"
    else
        log_test "API Health Check" "FAIL" "RPC API not accessible at $RPC_API_URL"
        echo ""
        echo "Error: Cannot proceed without accessible API"
        echo "Please ensure metabob-rpc-api is running at $RPC_API_URL"
        exit 1
    fi
}

# Function to create test template
create_test_template() {
    echo ""
    echo "Test 2: Create Template via POST"
    
    local template_json=$(cat <<EOF
{
  "name": "$TEST_TEMPLATE_NAME",
  "description": "Validation test template for surrealdb-async-await-enforcement",
  "category": "validation",
  "task_steps": [
    {
      "id": "task-1",
      "subagent": "general",
      "description": "Test task",
      "dependencies": [],
      "prompt": {
        "template": "This is a test task for validation",
        "max_tokens": 1000,
        "compression_strategy": "filter",
        "variables": []
      },
      "validation": {
        "required_files": [],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 3,
        "strategy": "simple"
      }
    }
  ],
  "scope": "global"
}
EOF
    )
    
    local response=$(curl -s -X POST "$RPC_API_URL/v2/activities/templates" \
        -H "Content-Type: application/json" \
        -d "$template_json")
    
    # Extract variant_id and activity_id from response
    TEST_VARIANT_ID=$(echo "$response" | jq -r '.variant_id // empty')
    TEST_ACTIVITY_ID=$(echo "$response" | jq -r '.activity_id // empty')
    
    if [ -n "$TEST_VARIANT_ID" ] && [ -n "$TEST_ACTIVITY_ID" ]; then
        log_test "Create Template" "PASS" "Created template: $TEST_VARIANT_ID"
        echo "  Activity ID: $TEST_ACTIVITY_ID"
        echo "  Variant ID: $TEST_VARIANT_ID"
    else
        log_test "Create Template" "FAIL" "Failed to create template or extract IDs"
        echo "  Response: $response"
        exit 1
    fi
}

# Function to verify template in GET response
verify_template_in_api() {
    echo ""
    echo "Test 3: Verify Template in GET Response (Redis Cache)"
    
    local response=$(curl -s "$RPC_API_URL/v2/activities/templates/$TEST_VARIANT_ID")
    local returned_variant_id=$(echo "$response" | jq -r '.variant_id // empty')
    
    if [ "$returned_variant_id" = "$TEST_VARIANT_ID" ]; then
        log_test "GET Template (Cache Hit)" "PASS" "Template found in Redis cache"
    else
        log_test "GET Template (Cache Hit)" "FAIL" "Template not returned by API"
        echo "  Response: $response"
    fi
}

# Function to check pod logs for coroutine warnings
check_pod_logs_for_warnings() {
    echo ""
    echo "Test 4: Check Pod Logs for Coroutine Warnings"
    
    if [ -z "$RPC_API_POD" ]; then
        log_test "Pod Log Check" "SKIP" "RPC API pod not detected"
        return
    fi
    
    # Get recent logs (last 100 lines)
    local logs=$(kubectl logs -n "$NAMESPACE" "$RPC_API_POD" --tail=100 2>/dev/null || echo "")
    
    if [ -z "$logs" ]; then
        log_test "Pod Log Check" "SKIP" "Could not retrieve pod logs"
        return
    fi
    
    # Check for coroutine warnings
    local warning_count=$(echo "$logs" | grep -c "coroutine.*was never awaited" || true)
    
    if [ "$warning_count" -eq 0 ]; then
        log_test "Pod Log Check" "PASS" "No coroutine warnings found in logs"
    else
        log_test "Pod Log Check" "FAIL" "Found $warning_count coroutine warning(s) in logs"
        echo "  Sample warning:"
        echo "$logs" | grep "coroutine.*was never awaited" | head -1 | sed 's/^/  /'
    fi
}

# Function to query SurrealDB directly
query_surrealdb_direct() {
    echo ""
    echo "Test 5: Query SurrealDB Directly for Template Persistence"
    
    if ! kubectl get pod -n "$NAMESPACE" "$SURREALDB_POD" > /dev/null 2>&1; then
        log_test "SurrealDB Direct Query" "SKIP" "SurrealDB pod not found: $SURREALDB_POD"
        return
    fi
    
    # Query SurrealDB for the template record
    # Note: This assumes SurrealDB is accessible via kubectl exec
    local query="SELECT * FROM activity_template WHERE variant_id = '$TEST_VARIANT_ID';"
    local result=$(kubectl exec -n "$NAMESPACE" "$SURREALDB_POD" -- \
        surreal sql --endpoint http://localhost:8000 \
        --namespace test --database test \
        --user root --pass root \
        "$query" 2>/dev/null | jq -r '.[] | length' 2>/dev/null || echo "0")
    
    if [ "$result" -gt 0 ]; then
        log_test "SurrealDB Direct Query" "PASS" "Template found in SurrealDB (primary storage)"
    else
        log_test "SurrealDB Direct Query" "FAIL" "Template NOT found in SurrealDB"
        echo "  This indicates templates are only in Redis (volatile cache)"
        echo "  The async/await fix may not be applied correctly"
    fi
}

# Function to flush Redis cache
flush_redis_cache() {
    echo ""
    echo "Test 6: Flush Redis Cache"
    
    if ! kubectl get pod -n "$NAMESPACE" "$REDIS_POD" > /dev/null 2>&1; then
        log_test "Flush Redis Cache" "SKIP" "Redis pod not found: $REDIS_POD"
        return
    fi
    
    kubectl exec -n "$NAMESPACE" "$REDIS_POD" -- redis-cli FLUSHALL > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        log_test "Flush Redis Cache" "PASS" "Redis cache flushed successfully"
        sleep 2  # Give system time to detect cache miss
    else
        log_test "Flush Redis Cache" "FAIL" "Failed to flush Redis cache"
    fi
}

# Function to verify template still accessible after cache flush
verify_template_after_cache_flush() {
    echo ""
    echo "Test 7: Verify Template Accessible After Cache Flush (SurrealDB Fallback)"
    
    local response=$(curl -s "$RPC_API_URL/v2/activities/templates/$TEST_VARIANT_ID")
    local returned_variant_id=$(echo "$response" | jq -r '.variant_id // empty')
    
    if [ "$returned_variant_id" = "$TEST_VARIANT_ID" ]; then
        log_test "GET Template (Cache Miss)" "PASS" "Template loaded from SurrealDB after cache flush"
        echo "  This confirms the cache-aside pattern is working correctly"
    else
        log_test "GET Template (Cache Miss)" "FAIL" "Template not found after cache flush"
        echo "  This indicates templates are NOT persisting to SurrealDB"
        echo "  Response: $response"
    fi
}

# Function to verify Redis and SurrealDB synchronization
verify_storage_sync() {
    echo ""
    echo "Test 8: Verify Redis and SurrealDB Synchronization"
    
    # Get template from API (should repopulate Redis cache)
    local api_response=$(curl -s "$RPC_API_URL/v2/activities/templates/$TEST_VARIANT_ID")
    local api_variant_id=$(echo "$api_response" | jq -r '.variant_id // empty')
    
    if [ "$api_variant_id" != "$TEST_VARIANT_ID" ]; then
        log_test "Storage Synchronization" "FAIL" "Template not accessible via API"
        return
    fi
    
    # Check if template is now back in Redis
    if ! kubectl get pod -n "$NAMESPACE" "$REDIS_POD" > /dev/null 2>&1; then
        log_test "Storage Synchronization" "SKIP" "Redis pod not found"
        return
    fi
    
    local redis_check=$(kubectl exec -n "$NAMESPACE" "$REDIS_POD" -- \
        redis-cli EXISTS "activity:template:$TEST_VARIANT_ID" 2>/dev/null || echo "0")
    
    if [ "$redis_check" = "1" ]; then
        log_test "Storage Synchronization" "PASS" "Template repopulated in Redis from SurrealDB"
        echo "  Both storage layers are synchronized"
    else
        log_test "Storage Synchronization" "FAIL" "Template not repopulated in Redis"
    fi
}

# Function to cleanup test data
cleanup_test_data() {
    echo ""
    echo "Cleanup: Removing test template"
    
    if [ -n "$TEST_VARIANT_ID" ]; then
        # Note: DELETE endpoint may not exist yet, this is optional
        curl -s -X DELETE "$RPC_API_URL/v2/activities/templates/$TEST_VARIANT_ID" > /dev/null 2>&1 || true
        echo "  Test template cleanup attempted"
    fi
}

# Function to print summary
print_summary() {
    echo ""
    echo "============================================"
    echo "  Validation Summary"
    echo "============================================"
    echo "  Total Tests: $TOTAL_TESTS"
    echo -e "  ${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "  ${RED}Failed: $FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
        echo ""
        echo "Conclusion:"
        echo "  The surrealdb-async-await-enforcement specification is correctly implemented."
        echo "  Templates persist to SurrealDB (primary storage) and survive cache expiry."
        echo "  No coroutine warnings detected in logs."
        echo "  The cache-aside pattern is working as expected."
        return 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        echo ""
        echo "Conclusion:"
        echo "  The async/await patterns may not be correctly enforced."
        echo "  Please review the failed tests and check:"
        echo "  1. Are create_template() and record_execution_result() async?"
        echo "  2. Do they use 'await' before SurrealDB operations?"
        echo "  3. Are route handlers awaiting these functions?"
        return 1
    fi
}

# Main execution
main() {
    detect_rpc_api_pod
    check_api_health
    create_test_template
    verify_template_in_api
    check_pod_logs_for_warnings
    query_surrealdb_direct
    flush_redis_cache
    verify_template_after_cache_flush
    verify_storage_sync
    cleanup_test_data
    print_summary
}

# Run main function
main
exit $?
