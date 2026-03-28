#!/bin/bash

###############################################################################
# Pass 4 Validation Runner
#
# Purpose: Execute the Pass 4 validation harness that actually invokes
#          meta-templates in devbob pod and validates complete lifecycle
#
# Usage:
#   ./run-pass4-validation.sh [test-case-number]
#
# Examples:
#   ./run-pass4-validation.sh          # Run default test case
#   ./run-pass4-validation.sh 1        # Run test case 1
#   ./run-pass4-validation.sh 2        # Run test case 2
###############################################################################

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found"
        exit 1
    fi
    log_success "Node.js: $(node --version)"
    
    if ! command -v npx &> /dev/null; then
        log_error "npx not found"
        exit 1
    fi
    log_success "npx available"
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi
    log_success "kubectl available"
    
    if ! kubectl get namespace metabob &> /dev/null; then
        log_error "Kubernetes namespace 'metabob' not found"
        exit 1
    fi
    log_success "Namespace 'metabob' exists"
    
    # Check devbob pod
    if ! kubectl get pods -n metabob -l app.kubernetes.io/name=devbob &> /dev/null; then
        log_error "DevBob pod not found"
        exit 1
    fi
    log_success "DevBob pod exists"
}

# Run validation harness
run_harness() {
    local test_case=${1:-1}
    
    log_info "Running validation harness (test case ${test_case})..."
    
    HARNESS_FILE="tests/validation-harnesses/dynamic-activity-creation-devbob-execution-tracking-harness.ts"
    
    if [[ ! -f "${HARNESS_FILE}" ]]; then
        log_error "Validation harness not found: ${HARNESS_FILE}"
        exit 1
    fi
    
    log_info "Executing: npx tsx ${HARNESS_FILE}"
    
    if npx tsx "${HARNESS_FILE}"; then
        log_success "Validation harness completed successfully"
        return 0
    else
        log_error "Validation harness failed"
        return 1
    fi
}

# Main execution
main() {
    local test_case=${1:-1}
    
    echo ""
    log_info "Pass 4 Validation: Dynamic Activity Creation DevBob Execution Tracking"
    log_info "Test Case: ${test_case}"
    log_info "Timestamp: $(date -Iseconds)"
    echo ""
    
    check_prerequisites
    echo ""
    
    if run_harness "${test_case}"; then
        echo ""
        log_success "✅ Validation PASSED"
        echo ""
        log_info "Check validation-results-pass4-*.json for detailed results"
        log_info "Check audit-trail-pass4-*.md for complete audit trail"
        exit 0
    else
        echo ""
        log_error "❌ Validation FAILED"
        echo ""
        log_info "Check validation-results-pass4-*.json for error details"
        exit 1
    fi
}

main "$@"
