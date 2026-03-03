#!/bin/bash

###############################################################################
# Pass 4 Validation Harness Runner
#
# Purpose: Execute the TypeScript validation harness that was created in Pass 2
#          but never actually run against the devbob pod
#
# This script:
# 1. Checks prerequisites (Node.js, ts-node, kubectl)
# 2. Runs the validation harness
# 3. Captures results and logs
# 4. Generates audit trail
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

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
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
    log_success "Node.js available: $(node --version)"
    
    if ! command -v npx &> /dev/null; then
        log_error "npx not found"
        exit 1
    fi
    log_success "npx available"
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi
    log_success "kubectl available: $(kubectl version --client --short 2>/dev/null || echo 'version unknown')"
    
    if ! kubectl get namespace metabob &> /dev/null; then
        log_error "Kubernetes namespace 'metabob' not found"
        exit 1
    fi
    log_success "Kubernetes namespace 'metabob' exists"
}

# Run validation harness
run_harness() {
    log_info "Running validation harness..."
    
    HARNESS_FILE="tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass2-harness.ts"
    
    if [[ ! -f "${HARNESS_FILE}" ]]; then
        log_error "Validation harness not found: ${HARNESS_FILE}"
        exit 1
    fi
    
    log_info "Executing: npx tsx ${HARNESS_FILE}"
    
    # Create logs directory
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    LOG_DIR="./logs/harness-execution-${TIMESTAMP}"
    mkdir -p "${LOG_DIR}"
    
    # Run harness and capture output
    if npx tsx "${HARNESS_FILE}" 2>&1 | tee "${LOG_DIR}/harness-output.log"; then
        log_success "Validation harness completed"
        return 0
    else
        log_error "Validation harness failed"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    log_info "Pass 4: Validation Harness Execution"
    log_info "Timestamp: $(date -Iseconds)"
    echo ""
    
    check_prerequisites
    echo ""
    
    if run_harness; then
        echo ""
        log_success "Validation harness execution complete!"
        echo ""
        log_info "Check logs in: ${LOG_DIR}"
        exit 0
    else
        echo ""
        log_error "Validation harness execution failed!"
        echo ""
        log_info "Check logs in: ${LOG_DIR}"
        exit 1
    fi
}

main "$@"
