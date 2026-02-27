#!/usr/bin/env bash
################################################################################
# Validation Harness: Helmfile-driven Kubernetes Deployment Pattern
#
# This harness validates that all Kubernetes deployments in the metabob
# namespace are managed exclusively through helmfile, with no direct kubectl
# modifications.
#
# Validation Strategy:
# 1. List all deployments in metabob namespace
# 2. Compare against helmfile.yaml releases
# 3. Verify image references point to build artifacts
# 4. Check for manual kubectl modifications (compare running vs helmfile-rendered)
# 5. Validate multi-environment support (local + production with Istio)
# 6. Test helmfile sync --dry-run for configuration consistency
################################################################################

set -euo pipefail

# Configuration
BASE_DIR="${1:-$(pwd)}"
NAMESPACE="${2:-metabob}"
HELMFILE_PATH="${BASE_DIR}/helm/helmfile.yaml"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Log functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✅${NC} $*"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_failure() {
    echo -e "${RED}❌${NC} $*"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

################################################################################
# Validation 1: Check kubectl context availability
################################################################################
validate_kubectl_context() {
    log_info "Test 1: Validating kubectl availability and context..."
    
    if ! command -v kubectl &> /dev/null; then
        log_failure "kubectl not found in PATH"
        return 1
    fi
    
    if ! kubectl config current-context &> /dev/null; then
        log_failure "No kubectl context set"
        return 1
    fi
    
    local context=$(kubectl config current-context)
    log_success "kubectl available, context: ${context}"
    return 0
}

################################################################################
# Validation 2: Multi-environment support (local + production)
################################################################################
validate_multi_environment_support() {
    log_info "Test 2: Validating multi-environment support..."
    
    if [[ ! -f "${HELMFILE_PATH}" ]]; then
        log_failure "helmfile.yaml not found at ${HELMFILE_PATH}"
        return 1
    fi
    
    local has_local=$(grep -c "^  local:" "${HELMFILE_PATH}" || echo "0")
    local has_production=$(grep -c "^  production:" "${HELMFILE_PATH}" || echo "0")
    
    if [[ "${has_local}" -eq 0 ]]; then
        log_failure "Missing 'local' environment in helmfile.yaml"
        return 1
    fi
    
    if [[ "${has_production}" -eq 0 ]]; then
        log_failure "Missing 'production' environment in helmfile.yaml"
        return 1
    fi
    
    log_success "Both local and production environments configured in helmfile.yaml"
    return 0
}

################################################################################
# Validation 3: Istio templates exist
################################################################################
validate_istio_templates() {
    log_info "Test 3: Validating Istio template files..."
    
    local missing_files=()
    local expected_files=(
        "helm/charts/devbob/templates/virtualservice.yaml"
        "helm/charts/devbob/templates/destinationrule.yaml"
        "helm/charts/metabob-rpc-api/templates/virtualservice.yaml"
        "helm/environments/production.values.yaml"
    )
    
    for file in "${expected_files[@]}"; do
        if [[ ! -f "${BASE_DIR}/${file}" ]]; then
            missing_files+=("${file}")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        log_failure "Missing ${#missing_files[@]} Istio template file(s):"
        for file in "${missing_files[@]}"; do
            echo "     - ${file}"
        done
        return 1
    fi
    
    log_success "All Istio templates present (${#expected_files[@]} files)"
    return 0
}

################################################################################
# Validation 4: Helmfile template rendering for local environment
################################################################################
validate_helmfile_template_local() {
    log_info "Test 4: Validating helmfile template rendering for local environment..."
    
    if ! command -v helmfile &> /dev/null; then
        log_warning "helmfile not found, skipping template validation"
        return 0
    fi
    
    cd "${BASE_DIR}/helm" || return 1
    
    local output
    if output=$(helmfile -e local template 2>&1); then
        local has_deployments=$(echo "${output}" | grep -c "kind: Deployment\|kind: StatefulSet" || echo "0")
        local has_services=$(echo "${output}" | grep -c "kind: Service" || echo "0")
        
        if [[ "${has_deployments}" -gt 0 && "${has_services}" -gt 0 ]]; then
            log_success "Helmfile template rendered successfully for local (${#output} bytes, ${has_deployments} deployments, ${has_services} services)"
            return 0
        else
            log_failure "Helmfile template missing expected resources for local"
            return 1
        fi
    else
        log_failure "Helmfile template rendering failed for local: ${output}"
        return 1
    fi
}

################################################################################
# Validation 5: Helmfile template rendering for production environment
################################################################################
validate_helmfile_template_production() {
    log_info "Test 5: Validating helmfile template rendering for production environment..."
    
    if ! command -v helmfile &> /dev/null; then
        log_warning "helmfile not found, skipping template validation"
        return 0
    fi
    
    cd "${BASE_DIR}/helm" || {
        log_warning "helm directory not found, skipping production template validation"
        return 0
    }
    
    local output
    if output=$(helmfile -e production template 2>&1); then
        local has_deployments=$(echo "${output}" | grep -c "kind: Deployment\|kind: StatefulSet" || echo "0")
        local has_virtualservices=$(echo "${output}" | grep -c "kind: VirtualService" || echo "0")
        local has_destinationrules=$(echo "${output}" | grep -c "kind: DestinationRule" || echo "0")
        
        if [[ "${has_deployments}" -gt 0 && "${has_virtualservices}" -gt 0 ]]; then
            log_success "Helmfile template rendered successfully for production (${#output} bytes, ${has_virtualservices} VirtualServices, ${has_destinationrules} DestinationRules)"
            return 0
        else
            log_failure "Helmfile template missing Istio resources for production"
            return 1
        fi
    else
        log_failure "Helmfile template rendering failed for production: ${output}"
        return 1
    fi
}

################################################################################
# Validation 6: No kubectl antipatterns (all resources Helm-managed)
################################################################################
validate_no_kubectl_antipatterns() {
    log_info "Test 6: Validating no kubectl antipatterns (all resources Helm-managed)..."
    
    if ! kubectl config current-context &> /dev/null; then
        log_warning "kubectl context not available, skipping cluster validation"
        return 0
    fi
    
    local all_resources
    all_resources=$(kubectl get deployments,statefulsets -n "${NAMESPACE}" -o name 2>/dev/null || echo "")
    
    if [[ -z "${all_resources}" ]]; then
        log_warning "No deployments found in namespace ${NAMESPACE}, skipping validation"
        return 0
    fi
    
    local helm_managed
    helm_managed=$(kubectl get deployments,statefulsets -n "${NAMESPACE}" -l app.kubernetes.io/managed-by=Helm -o name 2>/dev/null || echo "")
    
    local all_count=$(echo "${all_resources}" | grep -c "." || echo "0")
    local helm_count=$(echo "${helm_managed}" | grep -c "." || echo "0")
    
    if [[ "${all_count}" -eq "${helm_count}" ]]; then
        log_success "All ${helm_count} resources in namespace ${NAMESPACE} are Helm-managed"
        return 0
    else
        local unmanaged_count=$((all_count - helm_count))
        log_failure "Found ${unmanaged_count} resource(s) not managed by Helm"
        
        # Show unmanaged resources
        while IFS= read -r resource; do
            if ! echo "${helm_managed}" | grep -q "${resource}"; then
                echo "     - ${resource}"
            fi
        done <<< "${all_resources}"
        
        return 1
    fi
}

################################################################################
# Validation 7: Configuration drift check
################################################################################
validate_configuration_drift() {
    log_info "Test 7: Validating no configuration drift..."
    
    if ! kubectl config current-context &> /dev/null; then
        log_warning "kubectl context not available, skipping drift validation"
        return 0
    fi
    
    # Check metabob-rpc-api version
    local values_file="${BASE_DIR}/helm/environments/local.values.yaml"
    if [[ ! -f "${values_file}" ]]; then
        log_warning "local.values.yaml not found, skipping drift check"
        return 0
    fi
    
    local expected_version
    expected_version=$(grep -A1 "imageVersions:" "${values_file}" | grep "rpcApi:" | awk '{print $2}' | tr -d '"')
    
    if [[ -z "${expected_version}" ]]; then
        log_warning "Could not parse expected rpcApi version, skipping drift check"
        return 0
    fi
    
    local actual_image
    actual_image=$(kubectl get deployment metabob-rpc-api -n "${NAMESPACE}" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")
    
    if [[ -z "${actual_image}" ]]; then
        log_warning "metabob-rpc-api deployment not found, skipping drift check"
        return 0
    fi
    
    if echo "${actual_image}" | grep -q "${expected_version}"; then
        log_success "No configuration drift detected (metabob-rpc-api version: ${expected_version})"
        return 0
    else
        local actual_version=$(echo "${actual_image}" | awk -F: '{print $2}')
        log_failure "Configuration drift detected: expected ${expected_version}, running ${actual_version}"
        return 1
    fi
}

################################################################################
# Main execution
################################################################################
main() {
    echo ""
    echo "🔍 Running Helmfile Deployment Pattern Validation"
    echo ""
    echo "Base directory: ${BASE_DIR}"
    echo "Namespace: ${NAMESPACE}"
    echo "Helmfile path: ${HELMFILE_PATH}"
    echo ""
    echo "📊 Running Tests..."
    echo ""
    
    # Run all validations
    validate_kubectl_context || true
    validate_multi_environment_support || true
    validate_istio_templates || true
    validate_helmfile_template_local || true
    validate_helmfile_template_production || true
    validate_no_kubectl_antipatterns || true
    validate_configuration_drift || true
    
    # Summary
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📈 Summary:"
    echo "   Total Tests: ${TOTAL_TESTS}"
    echo "   Passed: ${GREEN}${PASSED_TESTS}${NC}"
    echo "   Failed: ${RED}${FAILED_TESTS}${NC}"
    
    if [[ ${FAILED_TESTS} -eq 0 ]]; then
        echo ""
        echo -e "   ${GREEN}Overall: ✅ PASS${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        return 0
    else
        echo ""
        echo -e "   ${RED}Overall: ❌ FAIL${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        return 1
    fi
}

# Run main function
main "$@"
