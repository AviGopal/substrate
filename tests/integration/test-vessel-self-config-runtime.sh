#!/usr/bin/env bash
# =============================================================================
# Integration Test: Vessel Self-Configuration Runtime Validation
# =============================================================================
# This test validates that the vessel actually configures itself at runtime.
#
# Test Flow:
#   1. Build the devbob container image
#   2. Start container without existing opencode.json
#   3. Monitor startup logs
#   4. Verify:
#      - Environment detection occurred
#      - Backend connectivity validated
#      - ANTHROPIC_API_KEY checked
#      - configure-vessel-for-environment activity executed
#      - opencode.json created
#      - Config backup created
#      - Settings applied
#      - ACP server started successfully
#   5. Test safe configuration updates via API
#   6. Cleanup
#
# Usage:
#   ./test-vessel-self-config-runtime.sh [environment]
#
# Arguments:
#   environment - dev|staging|prod (default: dev)
#
# Exit codes:
#   0 - All tests passed
#   1 - Build/startup failed
#   2 - Configuration validation failed
#   3 - Update mechanism failed
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEST_ENV="${1:-dev}"
CONTAINER_NAME="test-vessel-self-config-$$"
IMAGE_NAME="devbob-test:vessel-self-config"
TEST_RESULTS_FILE="${SCRIPT_DIR}/../test-results/vessel-self-config-runtime-results.json"
STARTUP_TIMEOUT=120 # 2 minutes

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TEST_DETAILS=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test recording
record_test() {
    local test_name="$1"
    local passed="$2"
    local details="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [[ "$passed" == "true" ]]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        log_success "Test ${TESTS_RUN}: ${test_name}"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        log_error "Test ${TESTS_RUN}: ${test_name}"
        log_error "  Details: ${details}"
    fi
    
    TEST_DETAILS+=("{\"test\":\"${test_name}\",\"passed\":${passed},\"details\":\"${details}\"}")
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test environment..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Stopping and removing container: ${CONTAINER_NAME}"
        docker stop "${CONTAINER_NAME}" 2>/dev/null || true
        docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
    fi
    
    # Optionally remove test image (commented out to speed up re-runs)
    # docker rmi -f "${IMAGE_NAME}" 2>/dev/null || true
}

trap cleanup EXIT

# Generate test results JSON
generate_results() {
    local overall_pass="false"
    [[ $TESTS_FAILED -eq 0 ]] && overall_pass="true"
    
    mkdir -p "$(dirname "${TEST_RESULTS_FILE}")"
    
    cat > "${TEST_RESULTS_FILE}" <<EOF
{
  "testSuite": "Vessel Self-Configuration Runtime Validation",
  "environment": "${TEST_ENV}",
  "timestamp": "$(date -Iseconds)",
  "overallPass": ${overall_pass},
  "totalTests": ${TESTS_RUN},
  "passed": ${TESTS_PASSED},
  "failed": ${TESTS_FAILED},
  "tests": [
    $(IFS=,; echo "${TEST_DETAILS[*]}")
  ]
}
EOF
    
    log_info "Results written to: ${TEST_RESULTS_FILE}"
}

# =============================================================================
# Phase 1: Build Container Image
# =============================================================================
test_build_image() {
    log_info "Phase 1: Building container image..."
    
    cd "${PROJECT_ROOT}"
    
    if ! docker build \
        -f docker/Dockerfile.devbob \
        -t "${IMAGE_NAME}" \
        --build-arg BUILD_ENV=test \
        . 2>&1 | tee /tmp/build-log-$$.txt; then
        record_test "Container Build" "false" "Docker build failed"
        return 1
    fi
    
    record_test "Container Build" "true" "Image built successfully"
    return 0
}

# =============================================================================
# Phase 2: Start Container and Monitor Startup
# =============================================================================
test_container_startup() {
    log_info "Phase 2: Starting container and monitoring startup..."
    
    # Start container with environment variables
    if ! docker run -d \
        --name "${CONTAINER_NAME}" \
        --hostname "devbob-${TEST_ENV}-test" \
        -e "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-test-key-placeholder}" \
        -e "METABOB_API_URL=${METABOB_API_URL:-http://localhost:8000}" \
        -e "SKIP_CONFIG=false" \
        -e "FORCE_ENVIRONMENT=${TEST_ENV}" \
        -p 3100:3000 \
        "${IMAGE_NAME}"; then
        record_test "Container Startup" "false" "Failed to start container"
        return 1
    fi
    
    log_info "Container started: ${CONTAINER_NAME}"
    
    # Wait for logs to accumulate
    sleep 5
    
    record_test "Container Startup" "true" "Container started successfully"
    return 0
}

# =============================================================================
# Phase 3: Validate Startup Logs
# =============================================================================
test_startup_logs() {
    log_info "Phase 3: Validating startup logs..."
    
    # Collect logs
    local logs
    logs=$(docker logs "${CONTAINER_NAME}" 2>&1)
    
    # Test 1: Environment Detection
    if echo "$logs" | grep -q "CONTAINER_ENV\|environment.*${TEST_ENV}\|Detected environment"; then
        record_test "Environment Detection" "true" "Environment detected in logs"
    else
        record_test "Environment Detection" "false" "No environment detection in logs"
    fi
    
    # Test 2: Backend Connectivity Check
    if echo "$logs" | grep -q "backend.*reachable\|connectivity.*ok\|urlopen.*success\|Metabob.*available"; then
        record_test "Backend Connectivity Validation" "true" "Backend connectivity validated"
    else
        record_test "Backend Connectivity Validation" "false" "No backend connectivity validation found"
    fi
    
    # Test 3: API Key Check
    if echo "$logs" | grep -q "ANTHROPIC_API_KEY.*set\|API key.*found\|Anthropic.*configured"; then
        record_test "ANTHROPIC_API_KEY Validation" "true" "API key validation found"
    else
        record_test "ANTHROPIC_API_KEY Validation" "false" "No API key validation found"
    fi
    
    # Test 4: Activity Execution
    if echo "$logs" | grep -q "configure-vessel-for-environment\|Executing activity\|Activity.*started"; then
        record_test "Activity Execution" "true" "Activity execution detected"
    else
        record_test "Activity Execution" "false" "No activity execution found"
    fi
    
    # Test 5: ACP Server Start
    if echo "$logs" | grep -q "ACP server.*started\|opencode acp\|Listening on.*3000"; then
        record_test "ACP Server Startup" "true" "ACP server started"
    else
        record_test "ACP Server Startup" "false" "ACP server did not start"
    fi
}

# =============================================================================
# Phase 4: Validate Configuration File Created
# =============================================================================
test_config_created() {
    log_info "Phase 4: Validating opencode.json created..."
    
    # Check if opencode.json exists in container
    if docker exec "${CONTAINER_NAME}" test -f /workspace/opencode.json 2>/dev/null; then
        record_test "Config File Created" "true" "opencode.json exists"
        
        # Extract and validate config content
        local config
        config=$(docker exec "${CONTAINER_NAME}" cat /workspace/opencode.json 2>/dev/null || echo "{}")
        
        # Test: Config has backend URL
        if echo "$config" | jq -e '.metabob.backend.baseUrl' >/dev/null 2>&1; then
            record_test "Config Has Backend URL" "true" "baseUrl configured"
        else
            record_test "Config Has Backend URL" "false" "No baseUrl in config"
        fi
        
        # Test: Config has token budget
        if echo "$config" | jq -e '.session.maxTokens' >/dev/null 2>&1; then
            record_test "Config Has Token Budget" "true" "Token budget configured"
        else
            record_test "Config Has Token Budget" "false" "No token budget in config"
        fi
    else
        record_test "Config File Created" "false" "opencode.json does not exist"
        record_test "Config Has Backend URL" "false" "Skipped - no config file"
        record_test "Config Has Token Budget" "false" "Skipped - no config file"
    fi
}

# =============================================================================
# Phase 5: Validate Backup Created
# =============================================================================
test_backup_created() {
    log_info "Phase 5: Validating config backup created..."
    
    # Check if backup directory exists
    if docker exec "${CONTAINER_NAME}" test -d /workspace/.opencode 2>/dev/null; then
        # Check for any backup files
        if docker exec "${CONTAINER_NAME}" sh -c 'ls /workspace/.opencode/*.backup 2>/dev/null | wc -l' | grep -q '^[1-9]'; then
            record_test "Config Backup Created" "true" "Backup files found in .opencode/"
        else
            record_test "Config Backup Created" "false" "No backup files found"
        fi
    else
        record_test "Config Backup Created" "false" ".opencode directory does not exist"
    fi
}

# =============================================================================
# Phase 6: Test Safe Configuration Update
# =============================================================================
test_safe_config_update() {
    log_info "Phase 6: Testing safe configuration update mechanism..."
    
    # This would require the container to be fully running with ACP server
    # For now, we verify the update tools exist in the container
    
    if docker exec "${CONTAINER_NAME}" test -f /workspace/repos/metabob-opencode/packages/opencode/src/config/self-modify.ts 2>/dev/null; then
        record_test "ConfigManager Tools Available" "true" "self-modify.ts exists"
    else
        record_test "ConfigManager Tools Available" "false" "self-modify.ts not found"
    fi
    
    if docker exec "${CONTAINER_NAME}" test -f /workspace/repos/metabob-opencode/packages/opencode/src/vessel/update.ts 2>/dev/null; then
        record_test "VesselUpdateManager Tools Available" "true" "update.ts exists"
    else
        record_test "VesselUpdateManager Tools Available" "false" "update.ts not found"
    fi
}

# =============================================================================
# Main Execution
# =============================================================================
main() {
    log_info "Starting Vessel Self-Configuration Runtime Validation"
    log_info "Target Environment: ${TEST_ENV}"
    log_info "Container Name: ${CONTAINER_NAME}"
    log_info "Image Name: ${IMAGE_NAME}"
    echo ""
    
    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed - some config validation tests will be skipped"
    fi
    
    # Run test phases
    test_build_image || exit 1
    test_container_startup || exit 1
    test_startup_logs
    test_config_created
    test_backup_created
    test_safe_config_update
    
    # Generate results
    echo ""
    log_info "Test Execution Complete"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "Total Tests: ${TESTS_RUN}"
    log_info "Passed: ${GREEN}${TESTS_PASSED}${NC}"
    log_info "Failed: ${RED}${TESTS_FAILED}${NC}"
    
    generate_results
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All runtime validation tests passed!"
        exit 0
    else
        log_error "Some runtime validation tests failed"
        exit 2
    fi
}

main "$@"
