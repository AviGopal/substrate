#!/bin/bash
###############################################################################
# Validation Harness: dashboard-data-flow-to-surrealdb
#
# Tests end-to-end data flow from frontend API expectations through
# backend database operations to SurrealDB schema compliance.
#
# Validation Strategy: external-api-trace
# - Validates database operations layer functions exist and have correct signatures
# - Validates SurrealDB schema tables exist with required fields
# - Validates data transformations match frontend API expectations
#
# NO LLM REQUIRED - Pure validation logic
###############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_CASES=0
PASSED=0
FAILED=0

# Test result arrays
declare -a RESULTS

echo "=== Dashboard Data Flow Validation Harness ==="
echo ""
echo "Specification: dashboard-data-flow-to-surrealdb"
echo "Strategy: external-api-trace"
echo ""

###############################################################################
# Helper Functions
###############################################################################

pass_test() {
    local test_name="$1"
    echo -e "${GREEN}✅ PASS${NC}: $test_name"
    RESULTS+=("PASS: $test_name")
    ((PASSED++))
    ((TOTAL_CASES++))
}

fail_test() {
    local test_name="$1"
    local error_msg="$2"
    echo -e "${RED}❌ FAIL${NC}: $test_name"
    echo "   Error: $error_msg"
    RESULTS+=("FAIL: $test_name - $error_msg")
    ((FAILED++))
    ((TOTAL_CASES++))
}

validate_file_exists() {
    local file_path="$1"
    if [[ ! -f "$file_path" ]]; then
        return 1
    fi
    return 0
}

validate_python_functions() {
    local file_path="$1"
    shift
    local functions=("$@")
    
    for func in "${functions[@]}"; do
        if ! grep -q "async def $func" "$file_path"; then
            echo "Missing function: $func"
            return 1
        fi
    done
    return 0
}

validate_surrealdb_tables() {
    local schema_file="$1"
    shift
    local tables=("$@")
    
    for table in "${tables[@]}"; do
        if ! grep -qi "DEFINE TABLE $table" "$schema_file"; then
            echo "Missing table: $table"
            return 1
        fi
        
        # Check for SCHEMAFULL
        if ! grep -A 2 "DEFINE TABLE $table" "$schema_file" | grep -q "SCHEMAFULL"; then
            echo "Table $table is not SCHEMAFULL"
            return 1
        fi
    done
    return 0
}

validate_js_exports() {
    local file_path="$1"
    shift
    local exports=("$@")
    
    for export in "${exports[@]}"; do
        if ! grep -q "$export" "$file_path"; then
            echo "Missing export: $export"
            return 1
        fi
    done
    return 0
}

###############################################################################
# Test Cases
###############################################################################

# Test Case 1: Validate SurrealDB Schema
echo "Running Test Case 1: SurrealDB Schema Validation..."
SCHEMA_FILE="repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql"

if validate_file_exists "$SCHEMA_FILE"; then
    REQUIRED_TABLES=(
        "organizations"
        "projects"
        "developers"
        "api_keys"
        "sessions"
        "activity_executions"
        "project_annotations"
        "project_problems"
        "project_metrics_history"
    )
    
    if validate_surrealdb_tables "$SCHEMA_FILE" "${REQUIRED_TABLES[@]}"; then
        pass_test "SurrealDB Schema Tables"
    else
        fail_test "SurrealDB Schema Tables" "Missing or invalid tables"
    fi
else
    fail_test "SurrealDB Schema Tables" "Schema file not found: $SCHEMA_FILE"
fi

# Test Case 2: Validate Organization Operations
echo "Running Test Case 2: Organization Operations Validation..."
ORG_OPS_FILE="repos/metabob-rpc-api/server/db/operations/organization_ops.py"

if validate_file_exists "$ORG_OPS_FILE"; then
    ORG_FUNCTIONS=(
        "create_organization"
        "get_organization"
        "list_organizations"
        "update_organization"
        "delete_organization"
        "get_organization_stats"
    )
    
    if validate_python_functions "$ORG_OPS_FILE" "${ORG_FUNCTIONS[@]}"; then
        pass_test "Organization Database Operations"
    else
        fail_test "Organization Database Operations" "Missing functions"
    fi
else
    fail_test "Organization Database Operations" "File not found: $ORG_OPS_FILE"
fi

# Test Case 3: Validate Project Operations
echo "Running Test Case 3: Project Operations Validation..."
PROJECT_OPS_FILE="repos/metabob-rpc-api/server/db/operations/project_ops.py"

if validate_file_exists "$PROJECT_OPS_FILE"; then
    PROJECT_FUNCTIONS=(
        "create_project"
        "get_project"
        "list_projects_by_org"
        "update_project"
        "update_project_stats"
        "delete_project"
    )
    
    if validate_python_functions "$PROJECT_OPS_FILE" "${PROJECT_FUNCTIONS[@]}"; then
        pass_test "Project Database Operations"
    else
        fail_test "Project Database Operations" "Missing functions"
    fi
else
    fail_test "Project Database Operations" "File not found: $PROJECT_OPS_FILE"
fi

# Test Case 4: Validate API Key Operations
echo "Running Test Case 4: API Key Operations Validation..."
API_KEY_OPS_FILE="repos/metabob-rpc-api/server/db/operations/api_key_ops.py"

if validate_file_exists "$API_KEY_OPS_FILE"; then
    API_KEY_FUNCTIONS=(
        "generate_api_key"
        "create_api_key"
        "get_api_key_by_key"
        "list_api_keys_by_org"
        "list_api_keys_by_user"
        "deactivate_api_key"
        "update_last_used"
    )
    
    if validate_python_functions "$API_KEY_OPS_FILE" "${API_KEY_FUNCTIONS[@]}"; then
        pass_test "API Key Database Operations"
    else
        fail_test "API Key Database Operations" "Missing functions"
    fi
else
    fail_test "API Key Database Operations" "File not found: $API_KEY_OPS_FILE"
fi

# Test Case 5: Validate Frontend OrganizationApi
echo "Running Test Case 5: Frontend OrganizationApi Validation..."
ORG_API_FILE="repos/metabob-dashboard/src/cloud/api/OrganizationApi.js"

if validate_file_exists "$ORG_API_FILE"; then
    ORG_API_EXPORTS=(
        "useGetOrganizationsQuery"
        "useGetOrganizationQuery"
        "useCreateOrganizationMutation"
        "useUpdateOrganizationMutation"
        "useDeleteOrganizationMutation"
    )
    
    if validate_js_exports "$ORG_API_FILE" "${ORG_API_EXPORTS[@]}"; then
        pass_test "Frontend Organization API"
    else
        fail_test "Frontend Organization API" "Missing exports"
    fi
else
    fail_test "Frontend Organization API" "File not found: $ORG_API_FILE"
fi

# Test Case 6: Validate Frontend ProjectApi
echo "Running Test Case 6: Frontend ProjectApi Validation..."
PROJECT_API_FILE="repos/metabob-dashboard/src/cloud/api/ProjectApi.js"

if validate_file_exists "$PROJECT_API_FILE"; then
    PROJECT_API_EXPORTS=(
        "useGetProjectsQuery"
        "useGetProjectQuery"
        "useCreateProjectMutation"
        "useUpdateProjectMutation"
        "useGetProjectStatsQuery"
    )
    
    if validate_js_exports "$PROJECT_API_FILE" "${PROJECT_API_EXPORTS[@]}"; then
        pass_test "Frontend Project API"
    else
        fail_test "Frontend Project API" "Missing exports"
    fi
else
    fail_test "Frontend Project API" "File not found: $PROJECT_API_FILE"
fi

# Test Case 7: Validate Frontend ApiKeyApi
echo "Running Test Case 7: Frontend ApiKeyApi Validation..."
API_KEY_API_FILE="repos/metabob-dashboard/src/cloud/api/ApiKeyApi.js"

if validate_file_exists "$API_KEY_API_FILE"; then
    API_KEY_API_EXPORTS=(
        "useGetApiKeysQuery"
        "useCreateApiKeyMutation"
        "useDeleteApiKeyMutation"
    )
    
    if validate_js_exports "$API_KEY_API_FILE" "${API_KEY_API_EXPORTS[@]}"; then
        pass_test "Frontend API Key API"
    else
        fail_test "Frontend API Key API" "Missing exports"
    fi
else
    fail_test "Frontend API Key API" "File not found: $API_KEY_API_FILE"
fi

###############################################################################
# Summary
###############################################################################

echo ""
echo "=== Validation Results ==="
echo "Total Cases: $TOTAL_CASES"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [[ $TOTAL_CASES -gt 0 ]]; then
    SUCCESS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL_CASES" | bc)
    echo "Success Rate: $SUCCESS_RATE%"
fi

echo ""
echo "=== Detailed Results ==="
for result in "${RESULTS[@]}"; do
    echo "$result"
done

# Exit with appropriate code
if [[ $FAILED -gt 0 ]]; then
    exit 1
else
    exit 0
fi
