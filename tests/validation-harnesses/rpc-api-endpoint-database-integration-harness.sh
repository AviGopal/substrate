#!/bin/bash
#
# Validation Harness: rpc-api-endpoint-database-integration
#
# Tests all metabob-rpc-api endpoints to ensure correct database integration:
# - Template CRUD operations
# - Execution tracking
# - Metrics retrieval
# - Learning loop endpoints
# - Storage and task endpoints
#
# This harness validates that the RecordID serialization fix works correctly
# and all endpoints properly interface with SurrealDB.
#

set -euo pipefail

# Configuration
API_BASE="${API_BASE:-http://api.metabob.local}"
TENANT_ID="${TENANT_ID:-test-tenant}"
PROJECT_ID="${PROJECT_ID:-test-project}"
ORG_ID="${ORG_ID:-test-org}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test results array
declare -a TEST_RESULTS=()

#############################################
# Utility Functions
#############################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
    TEST_RESULTS+=("PASS: $1")
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
    TEST_RESULTS+=("FAIL: $1")
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Increment test counter
test_case() {
    ((TOTAL_TESTS++))
    log_info "Test $TOTAL_TESTS: $1"
}

# Make HTTP request and capture response
http_request() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local expected_status="${4:-200}"
    
    local url="${API_BASE}${endpoint}"
    local response_file=$(mktemp)
    local status_code
    
    if [ -n "$data" ]; then
        status_code=$(curl -s -w "%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: $TENANT_ID" \
            -H "X-Project-ID: $PROJECT_ID" \
            -H "X-Org-ID: $ORG_ID" \
            -d "$data" \
            -o "$response_file")
    else
        status_code=$(curl -s -w "%{http_code}" -X "$method" "$url" \
            -H "X-Tenant-ID: $TENANT_ID" \
            -H "X-Project-ID: $PROJECT_ID" \
            -H "X-Org-ID: $ORG_ID" \
            -o "$response_file")
    fi
    
    # Return response file path and status code
    echo "$response_file|$status_code"
}

# Validate JSON response
validate_json() {
    local response_file="$1"
    if jq empty "$response_file" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if response contains RecordID serialization error
check_recordid_error() {
    local response_file="$1"
    if grep -q "RecordID" "$response_file" || grep -q "not.*serializable" "$response_file"; then
        return 0  # Error found
    else
        return 1  # No error
    fi
}

#############################################
# Test Suite: Template Endpoints
#############################################

test_template_endpoints() {
    log_info "======================================"
    log_info "Testing Template Endpoints (Critical)"
    log_info "======================================"
    
    # Test 1: Create Template (POST)
    test_case "POST /v2/activities/templates - Create template"
    
    local template_data='{
        "name": "validation-test-template",
        "description": "Test template for validation harness",
        "category": "feature",
        "tasks": [
            {
                "id": "task-1",
                "description": "Test task",
                "prompt": {"template": "Test prompt"},
                "subagent": "general"
            }
        ],
        "org_id": "'"$ORG_ID"'",
        "project_id": "'"$PROJECT_ID"'",
        "scope": "project"
    }'
    
    local result=$(http_request "POST" "/v2/activities/templates" "$template_data" "201")
    local response_file=$(echo "$result" | cut -d'|' -f1)
    local status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "201" ]; then
        if validate_json "$response_file"; then
            local template_id=$(jq -r '.variant_id // .id' "$response_file")
            if [ -n "$template_id" ] && [ "$template_id" != "null" ]; then
                log_success "Template created successfully (ID: $template_id)"
                echo "$template_id" > /tmp/test_template_id
            else
                log_failure "Template created but no ID returned"
            fi
        else
            log_failure "Template created but response is not valid JSON"
        fi
    else
        log_failure "Failed to create template (status: $status_code)"
        cat "$response_file"
    fi
    rm -f "$response_file"
    
    # Test 2: Get Template by ID (GET) - CRITICAL TEST
    if [ -f /tmp/test_template_id ]; then
        local template_id=$(cat /tmp/test_template_id)
        
        test_case "GET /v2/activities/templates/{id} - Retrieve template (RecordID fix validation)"
        
        local result=$(http_request "GET" "/v2/activities/templates/$template_id")
        local response_file=$(echo "$result" | cut -d'|' -f1)
        local status_code=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "200" ]; then
            if validate_json "$response_file"; then
                if check_recordid_error "$response_file"; then
                    log_failure "GET template returned RecordID serialization error (FIX NOT WORKING)"
                else
                    local returned_id=$(jq -r '.variant_id // .id' "$response_file")
                    if [ "$returned_id" = "$template_id" ]; then
                        log_success "Template retrieved successfully, no RecordID errors (FIX WORKING)"
                    else
                        log_failure "Template retrieved but ID mismatch (expected: $template_id, got: $returned_id)"
                    fi
                fi
            else
                log_failure "Template retrieved but response is not valid JSON"
                cat "$response_file"
            fi
        elif [ "$status_code" = "500" ]; then
            log_failure "GET template returned 500 error (likely RecordID serialization bug)"
            cat "$response_file"
        else
            log_failure "Failed to retrieve template (status: $status_code)"
        fi
        rm -f "$response_file"
    fi
    
    # Test 3: List Templates (GET)
    test_case "GET /v2/activities/templates - List all templates"
    
    local result=$(http_request "GET" "/v2/activities/templates?org_id=$ORG_ID&project_id=$PROJECT_ID")
    local response_file=$(echo "$result" | cut -d'|' -f1)
    local status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "200" ]; then
        if validate_json "$response_file"; then
            if check_recordid_error "$response_file"; then
                log_failure "List templates returned RecordID serialization error"
            else
                local count=$(jq '.templates | length' "$response_file")
                if [ "$count" -gt 0 ]; then
                    log_success "Templates listed successfully (count: $count), no RecordID errors"
                else
                    log_warning "Templates list is empty (might be expected)"
                fi
            fi
        else
            log_failure "List templates response is not valid JSON"
        fi
    else
        log_failure "Failed to list templates (status: $status_code)"
    fi
    rm -f "$response_file"
    
    # Test 4: Update Template Metrics (POST)
    if [ -f /tmp/test_template_id ]; then
        local template_id=$(cat /tmp/test_template_id)
        
        test_case "POST /v2/activities/templates/{id}/metrics - Update metrics"
        
        local metrics_data='{
            "success": true,
            "duration": 45000,
            "cost": 0.0234,
            "tokens": {
                "input": 1000,
                "output": 500,
                "cache": 200
            }
        }'
        
        local result=$(http_request "POST" "/v2/activities/templates/$template_id/metrics" "$metrics_data")
        local response_file=$(echo "$result" | cut -d'|' -f1)
        local status_code=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "204" ]; then
            log_success "Template metrics updated successfully"
        else
            log_failure "Failed to update template metrics (status: $status_code)"
        fi
        rm -f "$response_file"
    fi
}

#############################################
# Test Suite: Learning Loop Endpoints
#############################################

test_learning_loop_endpoints() {
    log_info "==========================================="
    log_info "Testing Learning Loop Endpoints"
    log_info "==========================================="
    
    # Test 5: Get Template Metrics (GET)
    if [ -f /tmp/test_template_id ]; then
        local template_id=$(cat /tmp/test_template_id)
        
        test_case "GET /api/v1/learning-loop/templates/{id}/metrics - Retrieve metrics"
        
        local result=$(http_request "GET" "/api/v1/learning-loop/templates/$template_id/metrics")
        local response_file=$(echo "$result" | cut -d'|' -f1)
        local status_code=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "200" ]; then
            if validate_json "$response_file"; then
                if check_recordid_error "$response_file"; then
                    log_failure "Get metrics returned RecordID serialization error"
                else
                    log_success "Template metrics retrieved successfully, no RecordID errors"
                fi
            else
                log_failure "Get metrics response is not valid JSON"
            fi
        elif [ "$status_code" = "404" ]; then
            log_warning "Metrics not found (might be expected for new template)"
        else
            log_failure "Failed to retrieve metrics (status: $status_code)"
        fi
        rm -f "$response_file"
    fi
    
    # Test 6: Record Execution (POST)
    if [ -f /tmp/test_template_id ]; then
        local template_id=$(cat /tmp/test_template_id)
        
        test_case "POST /api/v1/learning-loop/executions - Record execution"
        
        local execution_data='{
            "template_id": "'"$template_id"'",
            "variant_id": "'"$template_id"'",
            "success": true,
            "duration": 30000,
            "cost": 0.015,
            "tokens": {
                "input": 800,
                "output": 400,
                "cache": 150
            }
        }'
        
        local result=$(http_request "POST" "/api/v1/learning-loop/executions" "$execution_data" "201")
        local response_file=$(echo "$result" | cut -d'|' -f1)
        local status_code=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "201" ] || [ "$status_code" = "200" ]; then
            if validate_json "$response_file"; then
                log_success "Execution recorded successfully"
            else
                log_failure "Execution recorded but response is not valid JSON"
            fi
        else
            log_failure "Failed to record execution (status: $status_code)"
        fi
        rm -f "$response_file"
    fi
    
    # Test 7: Get Boredom Activities (GET)
    test_case "GET /api/v1/learning-loop/boredom-activities - Get candidates"
    
    local result=$(http_request "GET" "/api/v1/learning-loop/boredom-activities?org_id=$ORG_ID")
    local response_file=$(echo "$result" | cut -d'|' -f1)
    local status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "200" ]; then
        if validate_json "$response_file"; then
            log_success "Boredom activities retrieved successfully"
        else
            log_failure "Boredom activities response is not valid JSON"
        fi
    elif [ "$status_code" = "404" ]; then
        log_warning "No boredom activities found (might be expected)"
    else
        log_failure "Failed to get boredom activities (status: $status_code)"
    fi
    rm -f "$response_file"
}

#############################################
# Test Suite: Storage Endpoints
#############################################

test_storage_endpoints() {
    log_info "======================================"
    log_info "Testing Activity Storage Endpoints"
    log_info "======================================"
    
    # Test 8: Create Activity Storage (POST)
    test_case "POST /v2/activities/storage - Create activity"
    
    local activity_data='{
        "activity_id": "test-activity-'$(date +%s)'",
        "template_id": "test-template",
        "status": "running",
        "org_id": "'"$ORG_ID"'",
        "project_id": "'"$PROJECT_ID"'"
    }'
    
    local result=$(http_request "POST" "/v2/activities/storage" "$activity_data" "201")
    local response_file=$(echo "$result" | cut -d'|' -f1)
    local status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "201" ] || [ "$status_code" = "200" ]; then
        if validate_json "$response_file"; then
            local activity_id=$(jq -r '.activity_id // .id' "$response_file")
            if [ -n "$activity_id" ] && [ "$activity_id" != "null" ]; then
                log_success "Activity storage created (ID: $activity_id)"
                echo "$activity_id" > /tmp/test_activity_id
            else
                log_failure "Activity created but no ID returned"
            fi
        else
            log_failure "Activity created but response is not valid JSON"
        fi
    else
        log_failure "Failed to create activity storage (status: $status_code)"
    fi
    rm -f "$response_file"
    
    # Test 9: Get Activity Storage (GET)
    if [ -f /tmp/test_activity_id ]; then
        local activity_id=$(cat /tmp/test_activity_id)
        
        test_case "GET /v2/activities/storage/{id} - Retrieve activity"
        
        local result=$(http_request "GET" "/v2/activities/storage/$activity_id")
        local response_file=$(echo "$result" | cut -d'|' -f1)
        local status_code=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "200" ]; then
            if validate_json "$response_file"; then
                if check_recordid_error "$response_file"; then
                    log_failure "Get activity returned RecordID serialization error"
                else
                    log_success "Activity retrieved successfully, no RecordID errors"
                fi
            else
                log_failure "Activity retrieved but response is not valid JSON"
            fi
        else
            log_failure "Failed to retrieve activity (status: $status_code)"
        fi
        rm -f "$response_file"
    fi
}

#############################################
# Test Suite: Task Endpoints
#############################################

test_task_endpoints() {
    log_info "======================================"
    log_info "Testing Task Execution Endpoints"
    log_info "======================================"
    
    # Test 10: Record Task Start (POST)
    if [ -f /tmp/test_activity_id ]; then
        local activity_id=$(cat /tmp/test_activity_id)
        
        test_case "POST /v2/activities/tasks - Record task start"
        
        local task_data='{
            "activity_id": "'"$activity_id"'",
            "task_id": "task-1",
            "status": "running",
            "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
        }'
        
        local result=$(http_request "POST" "/v2/activities/tasks" "$task_data" "201")
        local response_file=$(echo "$result" | cut -d'|' -f1)
        local status_code=$(echo "$result" | cut -d'|' -f2)
        
        if [ "$status_code" = "201" ] || [ "$status_code" = "200" ]; then
            if validate_json "$response_file"; then
                local task_exec_id=$(jq -r '.id // .task_execution_id' "$response_file")
                if [ -n "$task_exec_id" ] && [ "$task_exec_id" != "null" ]; then
                    log_success "Task execution recorded (ID: $task_exec_id)"
                    echo "$task_exec_id" > /tmp/test_task_id
                else
                    log_failure "Task recorded but no ID returned"
                fi
            else
                log_failure "Task recorded but response is not valid JSON"
            fi
        else
            log_failure "Failed to record task (status: $status_code)"
        fi
        rm -f "$response_file"
        
        # Test 11: Update Task Execution (PATCH)
        if [ -f /tmp/test_task_id ]; then
            local task_exec_id=$(cat /tmp/test_task_id)
            
            test_case "PATCH /v2/activities/tasks/{id} - Update task execution"
            
            local update_data='{
                "status": "completed",
                "completed_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
                "success": true
            }'
            
            local result=$(http_request "PATCH" "/v2/activities/tasks/$task_exec_id" "$update_data")
            local response_file=$(echo "$result" | cut -d'|' -f1)
            local status_code=$(echo "$result" | cut -d'|' -f2)
            
            if [ "$status_code" = "200" ] || [ "$status_code" = "204" ]; then
                log_success "Task execution updated successfully"
            else
                log_failure "Failed to update task execution (status: $status_code)"
            fi
            rm -f "$response_file"
        fi
    fi
}

#############################################
# Test Suite: End-to-End Workflows
#############################################

test_e2e_workflows() {
    log_info "======================================"
    log_info "Testing End-to-End Workflows"
    log_info "======================================"
    
    # Test 12: Complete workflow - Create → Execute → Retrieve
    test_case "E2E: Create template → Execute activity → Retrieve results"
    
    # Step 1: Create template
    local template_data='{
        "name": "e2e-test-template-'$(date +%s)'",
        "description": "E2E test template",
        "category": "feature",
        "tasks": [{"id": "t1", "description": "Test", "prompt": {"template": "Test"}, "subagent": "general"}],
        "org_id": "'"$ORG_ID"'",
        "project_id": "'"$PROJECT_ID"'",
        "scope": "project"
    }'
    
    local result=$(http_request "POST" "/v2/activities/templates" "$template_data" "201")
    local response_file=$(echo "$result" | cut -d'|' -f1)
    local status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" != "201" ]; then
        log_failure "E2E: Failed to create template"
        rm -f "$response_file"
        return
    fi
    
    local e2e_template_id=$(jq -r '.variant_id // .id' "$response_file")
    rm -f "$response_file"
    
    # Step 2: Record execution
    local execution_data='{
        "template_id": "'"$e2e_template_id"'",
        "variant_id": "'"$e2e_template_id"'",
        "success": true,
        "duration": 25000,
        "cost": 0.012
    }'
    
    result=$(http_request "POST" "/api/v1/learning-loop/executions" "$execution_data" "201")
    response_file=$(echo "$result" | cut -d'|' -f1)
    status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" != "201" ] && [ "$status_code" != "200" ]; then
        log_failure "E2E: Failed to record execution"
        rm -f "$response_file"
        return
    fi
    rm -f "$response_file"
    
    # Step 3: Retrieve template (validates RecordID fix)
    result=$(http_request "GET" "/v2/activities/templates/$e2e_template_id")
    response_file=$(echo "$result" | cut -d'|' -f1)
    status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" != "200" ]; then
        log_failure "E2E: Failed to retrieve template"
        rm -f "$response_file"
        return
    fi
    
    if check_recordid_error "$response_file"; then
        log_failure "E2E: RecordID serialization error in retrieval"
        rm -f "$response_file"
        return
    fi
    
    # Step 4: Retrieve metrics
    result=$(http_request "GET" "/api/v1/learning-loop/templates/$e2e_template_id/metrics")
    response_file=$(echo "$result" | cut -d'|' -f1)
    status_code=$(echo "$result" | cut -d'|' -f2)
    
    if [ "$status_code" = "200" ]; then
        if ! check_recordid_error "$response_file"; then
            log_success "E2E workflow completed successfully (Create → Execute → Retrieve → Metrics)"
        else
            log_failure "E2E: RecordID error in metrics retrieval"
        fi
    else
        log_warning "E2E: Metrics retrieval returned status $status_code (might be expected)"
    fi
    rm -f "$response_file"
}

#############################################
# Main Execution
#############################################

main() {
    log_info "========================================"
    log_info "RPC API Endpoint Database Integration"
    log_info "Validation Harness"
    log_info "========================================"
    log_info ""
    log_info "API Base: $API_BASE"
    log_info "Tenant ID: $TENANT_ID"
    log_info "Org ID: $ORG_ID"
    log_info "Project ID: $PROJECT_ID"
    log_info ""
    
    # Check if API is reachable
    if ! curl -s -f -o /dev/null "$API_BASE/health" && ! curl -s -f -o /dev/null "$API_BASE/"; then
        log_failure "API endpoint $API_BASE is not reachable"
        log_info "Please ensure the metabob-rpc-api service is running"
        exit 1
    fi
    
    # Run test suites
    test_template_endpoints
    test_learning_loop_endpoints
    test_storage_endpoints
    test_task_endpoints
    test_e2e_workflows
    
    # Cleanup
    rm -f /tmp/test_template_id /tmp/test_activity_id /tmp/test_task_id
    
    # Summary
    log_info ""
    log_info "========================================"
    log_info "Validation Summary"
    log_info "========================================"
    log_info "Total Tests: $TOTAL_TESTS"
    log_success "Passed: $PASSED_TESTS"
    log_failure "Failed: $FAILED_TESTS"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_info ""
        log_success "✅ All tests passed! RPC API endpoint database integration is working correctly."
        exit 0
    else
        log_info ""
        log_failure "❌ Some tests failed. Please review the output above."
        exit 1
    fi
}

# Run main function
main "$@"
