#!/bin/bash

###############################################################################
# Pass 4 Execution Harness: Dynamic Activity Creation DevBob Execution Tracking
#
# Purpose: Actually execute meta-templates in devbob pod and track complete 
#          lifecycle through logs and database
#
# What this does:
# 1. Pre-flight checks (devbob pod ready, meta-templates registered, env vars)
# 2. Execute create-activity via kubectl exec
# 3. Monitor devbob pod logs in real-time
# 4. Query SurrealDB to verify activity persistence
# 5. Execute evolve-activity with parent reference
# 6. Execute debug-activity with error context
# 7. Generate complete audit trail with timestamps
#
# Previous passes:
# - Pass 1: Infrastructure deployed ✅
# - Pass 2: Validation scripts created ✅
# - Pass 3: Deployment verified ✅
# - Pass 4: ACTUALLY EXECUTE (this script) ⏳
#
###############################################################################

set -euo pipefail

# Configuration
K8S_NAMESPACE="metabob"
DEVBOB_POD_LABEL="app.kubernetes.io/name=devbob"
RPC_API_POD_LABEL="app.kubernetes.io/name=metabob-rpc-api"
SURREALDB_POD_LABEL="app.kubernetes.io/name=surrealdb"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="./logs/pass4-execution-${TIMESTAMP}"
mkdir -p "${LOG_DIR}"

DEVBOB_LOGS="${LOG_DIR}/devbob-logs.txt"
RPC_API_LOGS="${LOG_DIR}/rpc-api-logs.txt"
SURREALDB_QUERIES="${LOG_DIR}/surrealdb-queries.txt"
AUDIT_TRAIL="${LOG_DIR}/audit-trail.md"
EXECUTION_RESULTS="${LOG_DIR}/execution-results.json"

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "${AUDIT_TRAIL}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "${AUDIT_TRAIL}"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "${AUDIT_TRAIL}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "${AUDIT_TRAIL}"
}

log_section() {
    echo -e "\n${BLUE}========================================${NC}" | tee -a "${AUDIT_TRAIL}"
    echo -e "${BLUE}$*${NC}" | tee -a "${AUDIT_TRAIL}"
    echo -e "${BLUE}========================================${NC}\n" | tee -a "${AUDIT_TRAIL}"
}

# Get pod name from label selector
get_pod_name() {
    local label=$1
    kubectl get pod -n "${K8S_NAMESPACE}" -l "${label}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo ""
}

# Check if pod is ready
is_pod_ready() {
    local pod_name=$1
    local ready=$(kubectl get pod -n "${K8S_NAMESPACE}" "${pod_name}" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")
    [[ "${ready}" == "True" ]]
}

###############################################################################
# Pre-flight Checks
###############################################################################

preflight_checks() {
    log_section "PRE-FLIGHT CHECKS"
    
    local errors=0
    
    # Check kubectl available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found in PATH"
        ((errors++))
    else
        log_success "kubectl available"
    fi
    
    # Check namespace exists
    if ! kubectl get namespace "${K8S_NAMESPACE}" &> /dev/null; then
        log_error "Namespace ${K8S_NAMESPACE} not found"
        ((errors++))
    else
        log_success "Namespace ${K8S_NAMESPACE} exists"
    fi
    
    # Check DevBob pod
    DEVBOB_POD=$(get_pod_name "${DEVBOB_POD_LABEL}")
    if [[ -z "${DEVBOB_POD}" ]]; then
        log_error "DevBob pod not found (label: ${DEVBOB_POD_LABEL})"
        ((errors++))
    elif ! is_pod_ready "${DEVBOB_POD}"; then
        log_error "DevBob pod not ready: ${DEVBOB_POD}"
        ((errors++))
    else
        log_success "DevBob pod ready: ${DEVBOB_POD}"
    fi
    
    # Check RPC API pod
    RPC_API_POD=$(get_pod_name "${RPC_API_POD_LABEL}")
    if [[ -z "${RPC_API_POD}" ]]; then
        log_error "RPC API pod not found (label: ${RPC_API_POD_LABEL})"
        ((errors++))
    elif ! is_pod_ready "${RPC_API_POD}"; then
        log_error "RPC API pod not ready: ${RPC_API_POD}"
        ((errors++))
    else
        log_success "RPC API pod ready: ${RPC_API_POD}"
    fi
    
    # Check SurrealDB pod
    SURREALDB_POD=$(get_pod_name "${SURREALDB_POD_LABEL}")
    if [[ -z "${SURREALDB_POD}" ]]; then
        log_error "SurrealDB pod not found (label: ${SURREALDB_POD_LABEL})"
        ((errors++))
    elif ! is_pod_ready "${SURREALDB_POD}"; then
        log_error "SurrealDB pod not ready: ${SURREALDB_POD}"
        ((errors++))
    else
        log_success "SurrealDB pod ready: ${SURREALDB_POD}"
    fi
    
    # Check opencode CLI in DevBob pod
    if [[ -n "${DEVBOB_POD}" ]]; then
        if kubectl exec -n "${K8S_NAMESPACE}" "${DEVBOB_POD}" -- which opencode &> /dev/null; then
            log_success "opencode CLI available in DevBob pod"
        else
            log_error "opencode CLI not found in DevBob pod"
            ((errors++))
        fi
    fi
    
    # Check environment variables in DevBob pod
    if [[ -n "${DEVBOB_POD}" ]]; then
        local env_vars=$(kubectl exec -n "${K8S_NAMESPACE}" "${DEVBOB_POD}" -- env | grep -E "ACTIVITY|SURREALDB|REDIS" || echo "")
        if [[ -n "${env_vars}" ]]; then
            log_success "Environment variables present in DevBob pod"
            echo "${env_vars}" | while read -r line; do
                log_info "  ${line}"
            done
        else
            log_warn "No ACTIVITY/SURREALDB/REDIS environment variables found"
        fi
    fi
    
    # Check RPC API health
    if [[ -n "${RPC_API_POD}" ]]; then
        if kubectl exec -n "${K8S_NAMESPACE}" "${RPC_API_POD}" -- curl -s -f http://localhost:8000/health &> /dev/null; then
            log_success "RPC API health check passed"
        else
            log_warn "RPC API health check failed (non-blocking)"
        fi
    fi
    
    if [[ ${errors} -gt 0 ]]; then
        log_error "Pre-flight checks failed with ${errors} error(s)"
        return 1
    fi
    
    log_success "All pre-flight checks passed"
    return 0
}

###############################################################################
# Step 1: Execute create-activity
###############################################################################

execute_create_activity() {
    log_section "STEP 1: Execute create-activity"
    
    local start_time=$(date -Iseconds)
    log_info "Start time: ${start_time}"
    
    local goal="REST API for user management with authentication"
    log_info "Goal: ${goal}"
    
    log_info "Executing: kubectl exec -n ${K8S_NAMESPACE} ${DEVBOB_POD} -- opencode activity create-activity..."
    
    # Execute and capture output
    local output
    if output=$(kubectl exec -n "${K8S_NAMESPACE}" "${DEVBOB_POD}" -- opencode activity create-activity \
        --variables "{\"activityName\":\"${goal}\",\"purpose\":\"Pass 4 validation\"}" \
        --reason "Pass 4: Verify meta-template execution in devbob pod" 2>&1); then
        
        log_success "create-activity executed successfully"
        echo "${output}" | tee -a "${DEVBOB_LOGS}"
        
        # Extract activity ID
        CREATE_ACTIVITY_ID=$(echo "${output}" | grep -oP 'act_[a-zA-Z0-9_]+' | head -1 || echo "")
        if [[ -n "${CREATE_ACTIVITY_ID}" ]]; then
            log_success "Activity ID extracted: ${CREATE_ACTIVITY_ID}"
        else
            log_warn "Could not extract activity ID from output"
        fi
    else
        log_error "create-activity execution failed"
        echo "${output}" | tee -a "${DEVBOB_LOGS}"
        return 1
    fi
    
    local end_time=$(date -Iseconds)
    log_info "End time: ${end_time}"
    
    return 0
}

###############################################################################
# Step 2: Monitor DevBob logs
###############################################################################

monitor_devbob_logs() {
    log_section "STEP 2: Monitor DevBob Logs"
    
    log_info "Fetching last 100 lines from DevBob pod..."
    
    local logs
    logs=$(kubectl logs -n "${K8S_NAMESPACE}" "${DEVBOB_POD}" --tail=100 2>&1 || echo "Failed to fetch logs")
    echo "${logs}" >> "${DEVBOB_LOGS}"
    
    # Check for key patterns
    log_info "Analyzing logs for key patterns..."
    
    if echo "${logs}" | grep -q "isMetaTemplate"; then
        log_success "✅ Meta-template detection observed"
    else
        log_warn "⚠️  Meta-template detection NOT observed"
    fi
    
    if echo "${logs}" | grep -qi "trailblazing"; then
        log_success "✅ Trailblazing observed"
    else
        log_warn "⚠️  Trailblazing NOT observed (expected if no failures)"
    fi
    
    if echo "${logs}" | grep -q "memory management hook"; then
        log_success "✅ Lifecycle hooks observed"
    else
        log_warn "⚠️  Lifecycle hooks NOT observed"
    fi
    
    if echo "${logs}" | grep -qi "cost"; then
        log_success "✅ Cost tracking observed"
    else
        log_warn "⚠️  Cost tracking NOT observed"
    fi
    
    return 0
}

###############################################################################
# Step 3: Monitor RPC API logs
###############################################################################

monitor_rpc_api_logs() {
    log_section "STEP 3: Monitor RPC API Logs"
    
    log_info "Fetching last 50 lines from RPC API pod..."
    
    local logs
    logs=$(kubectl logs -n "${K8S_NAMESPACE}" "${RPC_API_POD}" --tail=50 2>&1 || echo "Failed to fetch logs")
    echo "${logs}" >> "${RPC_API_LOGS}"
    
    # Check for HTTP requests
    log_info "Analyzing logs for HTTP requests..."
    
    if echo "${logs}" | grep -qE "POST.*activity.*execution"; then
        log_success "✅ HTTP POST requests observed"
    else
        log_warn "⚠️  HTTP POST requests NOT observed"
    fi
    
    return 0
}

###############################################################################
# Step 4: Query SurrealDB
###############################################################################

query_surrealdb() {
    log_section "STEP 4: Query SurrealDB"
    
    if [[ -z "${CREATE_ACTIVITY_ID}" ]]; then
        log_warn "No activity ID to query, skipping database verification"
        return 0
    fi
    
    log_info "Querying SurrealDB for activity: ${CREATE_ACTIVITY_ID}"
    
    # Note: This is a placeholder - actual SurrealDB query depends on your setup
    # You may need to adjust the query syntax and authentication
    
    local query="SELECT * FROM activity_executions WHERE activity_id = '${CREATE_ACTIVITY_ID}'"
    log_info "Query: ${query}"
    
    # Try to execute query (adjust based on your SurrealDB setup)
    local result
    if result=$(kubectl exec -n "${K8S_NAMESPACE}" "${SURREALDB_POD}" -- \
        surreal sql --conn http://localhost:8000 --user root --pass root \
        "${query}" 2>&1); then
        
        log_success "SurrealDB query executed"
        echo "${result}" | tee -a "${SURREALDB_QUERIES}"
        
        # Check for key fields
        if echo "${result}" | grep -q "activity_id"; then
            log_success "✅ Activity record found in database"
        else
            log_warn "⚠️  Activity record structure unclear"
        fi
        
        if echo "${result}" | grep -q "recovery_attempts"; then
            log_success "✅ recovery_attempts field present"
        else
            log_warn "⚠️  recovery_attempts field NOT present"
        fi
        
        if echo "${result}" | grep -q "state_delta"; then
            log_success "✅ state_delta field present"
        else
            log_warn "⚠️  state_delta field NOT present"
        fi
    else
        log_error "SurrealDB query failed"
        echo "${result}" | tee -a "${SURREALDB_QUERIES}"
    fi
    
    return 0
}

###############################################################################
# Step 5: Execute evolve-activity
###############################################################################

execute_evolve_activity() {
    log_section "STEP 5: Execute evolve-activity"
    
    if [[ -z "${CREATE_ACTIVITY_ID}" ]]; then
        log_warn "No parent activity ID, skipping evolve-activity"
        return 0
    fi
    
    local start_time=$(date -Iseconds)
    log_info "Start time: ${start_time}"
    log_info "Parent activity: ${CREATE_ACTIVITY_ID}"
    
    log_info "Executing: kubectl exec -n ${K8S_NAMESPACE} ${DEVBOB_POD} -- opencode activity evolve-activity..."
    
    local output
    if output=$(kubectl exec -n "${K8S_NAMESPACE}" "${DEVBOB_POD}" -- opencode activity evolve-activity \
        --variables "{\"parentActivityId\":\"${CREATE_ACTIVITY_ID}\",\"evolutionReason\":\"Add JWT authentication\"}" \
        --reason "Pass 4: Verify activity evolution" 2>&1); then
        
        log_success "evolve-activity executed successfully"
        echo "${output}" | tee -a "${DEVBOB_LOGS}"
        
        EVOLVE_ACTIVITY_ID=$(echo "${output}" | grep -oP 'act_[a-zA-Z0-9_]+' | head -1 || echo "")
        if [[ -n "${EVOLVE_ACTIVITY_ID}" ]]; then
            log_success "Evolved activity ID: ${EVOLVE_ACTIVITY_ID}"
        fi
    else
        log_error "evolve-activity execution failed"
        echo "${output}" | tee -a "${DEVBOB_LOGS}"
    fi
    
    local end_time=$(date -Iseconds)
    log_info "End time: ${end_time}"
    
    return 0
}

###############################################################################
# Step 6: Execute debug-activity
###############################################################################

execute_debug_activity() {
    log_section "STEP 6: Execute debug-activity"
    
    local start_time=$(date -Iseconds)
    log_info "Start time: ${start_time}"
    
    log_info "Executing: kubectl exec -n ${K8S_NAMESPACE} ${DEVBOB_POD} -- opencode activity debug-activity..."
    
    local output
    if output=$(kubectl exec -n "${K8S_NAMESPACE}" "${DEVBOB_POD}" -- opencode activity debug-activity \
        --variables "{\"errorDescription\":\"Database connection timeout\",\"activityContext\":\"Pass 4 test\"}" \
        --reason "Pass 4: Verify activity debugging" 2>&1); then
        
        log_success "debug-activity executed successfully"
        echo "${output}" | tee -a "${DEVBOB_LOGS}"
        
        DEBUG_ACTIVITY_ID=$(echo "${output}" | grep -oP 'act_[a-zA-Z0-9_]+' | head -1 || echo "")
        if [[ -n "${DEBUG_ACTIVITY_ID}" ]]; then
            log_success "Debug activity ID: ${DEBUG_ACTIVITY_ID}"
        fi
    else
        log_error "debug-activity execution failed"
        echo "${output}" | tee -a "${DEVBOB_LOGS}"
    fi
    
    local end_time=$(date -Iseconds)
    log_info "End time: ${end_time}"
    
    return 0
}

###############################################################################
# Step 7: Generate execution results
###############################################################################

generate_results() {
    log_section "STEP 7: Generate Execution Results"
    
    cat > "${EXECUTION_RESULTS}" << EOJSON
{
  "timestamp": "$(date -Iseconds)",
  "pass": "partial",
  "activities": {
    "create": "${CREATE_ACTIVITY_ID:-none}",
    "evolve": "${EVOLVE_ACTIVITY_ID:-none}",
    "debug": "${DEBUG_ACTIVITY_ID:-none}"
  },
  "observations": {
    "metaTemplateDetected": false,
    "trailblazingObserved": false,
    "lifecycleHooksObserved": false,
    "httpRequestsObserved": false,
    "databaseRecordsCreated": false
  },
  "logs": {
    "devbob": "${DEVBOB_LOGS}",
    "rpcApi": "${RPC_API_LOGS}",
    "surrealdb": "${SURREALDB_QUERIES}",
    "auditTrail": "${AUDIT_TRAIL}"
  }
}
EOJSON
    
    log_success "Execution results written to: ${EXECUTION_RESULTS}"
    cat "${EXECUTION_RESULTS}"
    
    return 0
}

###############################################################################
# Main Execution
###############################################################################

main() {
    log_section "Pass 4: Dynamic Activity Creation DevBob Execution Tracking"
    log_info "Timestamp: $(date -Iseconds)"
    log_info "Log directory: ${LOG_DIR}"
    
    # Initialize audit trail
    cat > "${AUDIT_TRAIL}" << EOHEADER
# Audit Trail: Pass 4 Execution
## Timestamp: $(date -Iseconds)
## Log Directory: ${LOG_DIR}

---

EOHEADER
    
    # Run pre-flight checks
    if ! preflight_checks; then
        log_error "Pre-flight checks failed, aborting execution"
        exit 1
    fi
    
    # Execute workflow
    execute_create_activity || log_warn "create-activity had issues"
    monitor_devbob_logs || log_warn "DevBob log analysis had issues"
    monitor_rpc_api_logs || log_warn "RPC API log analysis had issues"
    query_surrealdb || log_warn "SurrealDB query had issues"
    execute_evolve_activity || log_warn "evolve-activity had issues"
    execute_debug_activity || log_warn "debug-activity had issues"
    generate_results
    
    log_section "EXECUTION COMPLETE"
    log_info "Review logs in: ${LOG_DIR}"
    log_info "Audit trail: ${AUDIT_TRAIL}"
    log_info "Results: ${EXECUTION_RESULTS}"
    
    echo ""
    log_success "Pass 4 execution tracking complete!"
    echo ""
    log_info "Next steps:"
    log_info "1. Review ${AUDIT_TRAIL} for complete execution flow"
    log_info "2. Check ${DEVBOB_LOGS} for meta-template and trailblazing logs"
    log_info "3. Check ${RPC_API_LOGS} for HTTP request logs"
    log_info "4. Check ${SURREALDB_QUERIES} for database verification"
    log_info "5. Analyze ${EXECUTION_RESULTS} for validation status"
    
    return 0
}

# Execute main function
main "$@"
