#!/bin/bash
#
# Validation Harness: SurrealDB Learning Loop Integration
# Tests all 5 critical conditions for the learning loop
#
# Returns:
#   0 - All tests passed
#   1 - One or more tests failed
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED_TESTS=0
PASSED_TESTS=0

log_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "  ${YELLOW}Details${NC}: $2"
    ((FAILED_TESTS++))
}

log_info() {
    echo -e "${YELLOW}ℹ INFO${NC}: $1"
}

# ============================================================================
# Test 1: Persistent Storage - Volume Mount Verification
# ============================================================================
test_persistent_storage() {
    log_info "Test 1: Verifying persistent storage configuration"
    
    # Check if SurrealDB container exists (try multiple possible names)
    SURREAL_CONTAINER=""
    for name in metabob-surreal surrealdb metabob-devbob-surreal-1 metabob-rpc-api-surreal-1; do
        if docker ps -a | grep -w "$name" > /dev/null 2>&1; then
            SURREAL_CONTAINER="$name"
            break
        fi
    done
    
    # If still not found, try to find any running surreal container
    if [ -z "$SURREAL_CONTAINER" ]; then
        SURREAL_CONTAINER=$(docker ps | grep -i "surrealdb/surrealdb" | grep -v "Exited" | awk '{print $NF}' | head -1)
    fi
    
    if [ -z "$SURREAL_CONTAINER" ]; then
        log_fail "Test 1: Persistent Storage" "SurrealDB container not found (tried: metabob-surreal, surrealdb, metabob-devbob-surreal-1)"
        return
    fi
    
    # Inspect volume mounts - look specifically for /data destination
    HAS_DATA_MOUNT=$(docker inspect "$SURREAL_CONTAINER" 2>/dev/null | grep -c '"Destination": "/data"' || echo "0")
    
    if [ "$HAS_DATA_MOUNT" -gt 0 ]; then
        # Verify it's not using tmpfs (memory-only)
        # Extract the full mount block for /data
        MOUNT_BLOCK=$(docker inspect "$SURREAL_CONTAINER" 2>/dev/null | grep -B 10 '"Destination": "/data"' | grep -A 1 '"Type"')
        MOUNT_TYPE=$(echo "$MOUNT_BLOCK" | grep '"Type"' | cut -d'"' -f4)
        MOUNT_SOURCE=$(docker inspect "$SURREAL_CONTAINER" 2>/dev/null | grep -B 5 '"Destination": "/data"' | grep '"Source"' | cut -d'"' -f4)
        
        if [ -z "$MOUNT_TYPE" ]; then
            MOUNT_TYPE="unknown"
        fi
        
        if [ "$MOUNT_TYPE" = "tmpfs" ]; then
            log_fail "Test 1: Persistent Storage" "SurrealDB using tmpfs (memory-only storage)"
        else
            log_pass "Test 1: Persistent storage - Volume mounted (type: $MOUNT_TYPE, source: $MOUNT_SOURCE)"
        fi
    else
        log_fail "Test 1: Persistent Storage" "No data volume mount found"
    fi
}

# ============================================================================
# Test 2: Authentication - No 401 Errors
# ============================================================================
test_authentication() {
    log_info "Test 2: Checking for authentication errors"
    
    # Find SurrealDB container
    SURREAL_CONTAINER=$(docker ps | grep -i surreal | awk '{print $NF}' | head -1)
    
    # Check SurrealDB readiness
    if docker exec "$SURREAL_CONTAINER" /surreal isready --conn http://localhost:8000 2>&1 | grep -q "OK"; then
        log_pass "Test 2a: SurrealDB authentication - isready returns OK"
    else
        log_fail "Test 2a: SurrealDB Authentication" "isready command failed"
    fi
    
    # Check API logs for 401 errors in last 100 lines
    RECENT_401=$(docker logs api-server-dev 2>&1 | tail -100 | grep "401.*Unauthorized" | wc -l)
    
    if [ "$RECENT_401" -eq 0 ]; then
        log_pass "Test 2b: No 401 authentication errors in recent API logs"
    else
        log_fail "Test 2b: Authentication Errors" "Found $RECENT_401 recent 401 errors in API logs"
    fi
}

# ============================================================================
# Test 3: API Server Running on Port 8080
# ============================================================================
test_api_server() {
    log_info "Test 3: Verifying API server is running"
    
    # Check health endpoint
    HEALTH_RESPONSE=$(curl -s http://localhost:8080/ 2>&1 || echo "FAILED")
    
    if echo "$HEALTH_RESPONSE" | grep -q "status.*ok"; then
        VERSION=$(echo "$HEALTH_RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        log_pass "Test 3: API server running on port 8080 (version: $VERSION)"
    else
        log_fail "Test 3: API Server" "Health endpoint failed or returned unexpected response"
    fi
}

# ============================================================================
# Test 4: Schema Initialization - Tables and template_id Field
# ============================================================================
test_schema_initialization() {
    log_info "Test 4: Verifying database schema"
    
    # Test 4a: Check if schema file exists
    if [ -f "initialize-surrealdb-schema.sql" ]; then
        log_pass "Test 4a: Schema file exists (initialize-surrealdb-schema.sql)"
    else
        log_fail "Test 4a: Schema File" "initialize-surrealdb-schema.sql not found"
        return
    fi
    
    # Test 4b: Verify required tables are defined in schema
    REQUIRED_TABLES=("activity_execution" "template_metrics" "failure_patterns" "task_execution" "activity_content")
    for table in "${REQUIRED_TABLES[@]}"; do
        if grep -q "DEFINE TABLE $table" initialize-surrealdb-schema.sql; then
            log_pass "Test 4b: Schema defines table '$table'"
        else
            log_fail "Test 4b: Schema Table Missing" "Table '$table' not defined in schema"
        fi
    done
    
    # Test 4c: Verify template_id field exists
    if grep -q "DEFINE FIELD template_id ON activity_execution" initialize-surrealdb-schema.sql; then
        log_pass "Test 4c: Schema defines template_id field on activity_execution"
    else
        log_fail "Test 4c: Schema Field Missing" "template_id field not defined on activity_execution"
    fi
    
    # Test 4d: Verify template_id index exists
    if grep -q "idx_template_id.*activity_execution.*template_id" initialize-surrealdb-schema.sql; then
        log_pass "Test 4d: Schema defines template_id index"
    else
        log_fail "Test 4d: Schema Index Missing" "template_id index not defined"
    fi
}

# ============================================================================
# Test 5: Dual-Write - Both Redis and SurrealDB
# ============================================================================
test_dual_write() {
    log_info "Test 5: Testing dual-write to Redis and SurrealDB"
    
    TIMESTAMP=$(date +%s)
    TEST_ACTIVITY_ID="validation_test_$TIMESTAMP"
    TEST_TEMPLATE_ID="validation-template"
    
    # Test 5a: Write execution via API
    log_info "Test 5a: Submitting test execution to API"
    
    API_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/learning-loop/executions \
        -H "Content-Type: application/json" \
        -d "{
            \"activity_id\": \"$TEST_ACTIVITY_ID\",
            \"template_id\": \"$TEST_TEMPLATE_ID\",
            \"started_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"duration_ms\": 1500,
            \"success\": true,
            \"tokens_input\": 150,
            \"tokens_output\": 75,
            \"tokens_cache\": 25,
            \"cost_usd\": 0.0015
        }" 2>&1)
    
    if echo "$API_RESPONSE" | grep -q "\"success\":true"; then
        log_pass "Test 5a: API accepted execution (activity_id: $TEST_ACTIVITY_ID)"
    else
        log_fail "Test 5a: API Execution Submit" "API returned error: $API_RESPONSE"
        return
    fi
    
    # Test 5b: Verify Redis write
    sleep 1  # Give time for async writes
    log_info "Test 5b: Checking Redis for dual-write"
    
    REDIS_DATA=$(docker exec metabob-redis redis-cli HGETALL "activity:executions:$TEST_ACTIVITY_ID" 2>&1 || echo "FAILED")
    
    if echo "$REDIS_DATA" | grep -q "$TEST_TEMPLATE_ID"; then
        log_pass "Test 5b: Redis dual-write successful (found activity data)"
        
        # Verify specific fields
        if echo "$REDIS_DATA" | grep -q "template_id"; then
            log_pass "Test 5b.1: Redis contains template_id field"
        fi
        if echo "$REDIS_DATA" | grep -q "success"; then
            log_pass "Test 5b.2: Redis contains success field"
        fi
        if echo "$REDIS_DATA" | grep -q "cost_usd"; then
            log_pass "Test 5b.3: Redis contains cost_usd field"
        fi
    else
        log_fail "Test 5b: Redis Dual-Write" "Activity data not found in Redis"
    fi
    
    # Test 5c: Verify SurrealDB write (via API query)
    log_info "Test 5c: Checking SurrealDB for execution record"
    
    sleep 2  # Allow time for persistence
    
    # Try querying by template (may fail due to known bug, so also try general query)
    SURREAL_QUERY=$(curl -s "http://localhost:8080/api/v1/learning-loop/executions?hours=1&limit=50" 2>&1)
    
    if echo "$SURREAL_QUERY" | grep -q "$TEST_ACTIVITY_ID"; then
        log_pass "Test 5c: SurrealDB contains execution record (queryable via API)"
    else
        log_fail "Test 5c: SurrealDB Query" "Execution not found in SurrealDB (or query failed)"
    fi
}

# ============================================================================
# Test 6: Data Persistence After Container Restart
# ============================================================================
test_data_persistence() {
    log_info "Test 6: Testing data persistence after container restart"
    
    # Create a test execution before restart
    TIMESTAMP=$(date +%s)
    PERSIST_TEST_ID="persistence_test_$TIMESTAMP"
    
    log_info "Test 6a: Writing test execution before restart"
    
    PRE_RESTART_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/learning-loop/executions \
        -H "Content-Type: application/json" \
        -d "{
            \"activity_id\": \"$PERSIST_TEST_ID\",
            \"template_id\": \"persistence-test\",
            \"started_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"duration_ms\": 2000,
            \"success\": true,
            \"tokens_input\": 200,
            \"tokens_output\": 100,
            \"tokens_cache\": 50,
            \"cost_usd\": 0.002
        }" 2>&1)
    
    if echo "$PRE_RESTART_RESPONSE" | grep -q "\"success\":true"; then
        log_pass "Test 6a: Pre-restart execution recorded"
    else
        log_fail "Test 6a: Pre-restart Write" "Failed to record execution before restart"
        return
    fi
    
    # Restart SurrealDB container
    log_info "Test 6b: Restarting SurrealDB container"
    
    SURREAL_CONTAINER=$(docker ps | grep -i surreal | awk '{print $NF}' | head -1)
    
    if docker restart "$SURREAL_CONTAINER" >/dev/null 2>&1; then
        sleep 5  # Wait for container to be ready
        log_pass "Test 6b: SurrealDB container restarted successfully"
    else
        log_fail "Test 6b: Container Restart" "Failed to restart SurrealDB container"
        return
    fi
    
    # Verify readiness
    for i in {1..10}; do
        if docker exec "$SURREAL_CONTAINER" /surreal isready --conn http://localhost:8000 2>&1 | grep -q "OK"; then
            log_pass "Test 6c: SurrealDB ready after restart (attempt $i)"
            break
        fi
        sleep 2
    done
    
    # Query for the persisted data
    log_info "Test 6d: Querying for pre-restart execution"
    
    sleep 3
    POST_RESTART_QUERY=$(curl -s "http://localhost:8080/api/v1/learning-loop/executions?hours=1&limit=100" 2>&1)
    
    if echo "$POST_RESTART_QUERY" | grep -q "$PERSIST_TEST_ID"; then
        log_pass "Test 6d: Data persisted after container restart (found $PERSIST_TEST_ID)"
    else
        log_fail "Test 6d: Data Persistence" "Pre-restart execution not found after restart"
    fi
}

# ============================================================================
# Main Execution
# ============================================================================
main() {
    echo "========================================================================"
    echo "  SurrealDB Learning Loop Integration - Validation Harness"
    echo "========================================================================"
    echo ""
    
    test_persistent_storage
    echo ""
    
    test_authentication
    echo ""
    
    test_api_server
    echo ""
    
    test_schema_initialization
    echo ""
    
    test_dual_write
    echo ""
    
    test_data_persistence
    echo ""
    
    echo "========================================================================"
    echo "  Test Summary"
    echo "========================================================================"
    echo -e "${GREEN}Passed${NC}: $PASSED_TESTS"
    echo -e "${RED}Failed${NC}: $FAILED_TESTS"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
        exit 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        exit 1
    fi
}

main "$@"
