#!/bin/bash
# Validation Harness: helmfile-deployment-pattern-with-versioned-builds
# 
# Purpose: Validates GitOps compliance for Kubernetes deployments
# - No configuration drift (helmfile state = cluster state)
# - Images use proper version tags (not :latest in production)
# - No kubectl bypass antipatterns
# - Istio configuration present in production
# - Reproducible deployments from version control

set -euo pipefail

# Configuration
NAMESPACE="${NAMESPACE:-metabob}"
ENVIRONMENT="${ENVIRONMENT:-local}"
HELMFILE="${HELMFILE:-helm/helmfile.yaml}"
SKIP_DESTRUCTIVE="${SKIP_DESTRUCTIVE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "  ${RED}Reason${NC}: $2"
    ((TESTS_FAILED++))
}

skip() {
    echo -e "${YELLOW}⊘ SKIP${NC}: $1"
    echo -e "  ${YELLOW}Reason${NC}: $2"
    ((TESTS_SKIPPED++))
}

info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Test Case 1: Helmfile Diff - No Configuration Drift
test_helmfile_no_drift() {
    info "Test 1: Checking for configuration drift..."
    
    if ! command -v helmfile &> /dev/null; then
        skip "Helmfile not installed" "Install helmfile to run this test"
        return
    fi
    
    if [ ! -f "$HELMFILE" ]; then
        fail "Helmfile not found" "Expected file: $HELMFILE"
        return
    fi
    
    # Run helmfile diff (non-destructive)
    local diff_output
    if diff_output=$(helmfile -e "$ENVIRONMENT" diff 2>&1); then
        pass "No configuration drift detected"
    else
        # Check if diff detected changes or if it's an error
        if echo "$diff_output" | grep -q "has changed"; then
            fail "Configuration drift detected" "Run 'helmfile -e $ENVIRONMENT sync' to reconcile"
        elif echo "$diff_output" | grep -q "release.*not installed"; then
            skip "Releases not installed" "Run 'helmfile -e $ENVIRONMENT sync' first"
        else
            fail "Helmfile diff failed" "$diff_output"
        fi
    fi
}

# Test Case 2: Image Version Tags - No :latest in Production
test_image_version_tags() {
    info "Test 2: Validating image version tags..."
    
    if ! command -v kubectl &> /dev/null; then
        skip "kubectl not installed" "Install kubectl to run this test"
        return
    fi
    
    # Get running pods in namespace
    local pods
    if ! pods=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null); then
        skip "Cannot access namespace $NAMESPACE" "Ensure cluster is accessible and namespace exists"
        return
    fi
    
    # Check if any pods exist
    local pod_count
    pod_count=$(echo "$pods" | jq '.items | length')
    if [ "$pod_count" -eq 0 ]; then
        skip "No pods found in namespace $NAMESPACE" "Deploy services first"
        return
    fi
    
    # Extract image tags
    local latest_count=0
    local images
    images=$(echo "$pods" | jq -r '.items[].spec.containers[].image')
    
    while IFS= read -r image; do
        if [[ "$image" =~ :latest$ ]] || [[ ! "$image" =~ : ]]; then
            echo "  Found :latest or untagged image: $image"
            ((latest_count++))
        fi
    done <<< "$images"
    
    if [ "$latest_count" -gt 0 ]; then
        if [ "$ENVIRONMENT" == "production" ]; then
            fail "Found $latest_count images with :latest tag in production" "Production must use explicit version tags"
        else
            info "  Found $latest_count :latest tags (acceptable in $ENVIRONMENT)"
            pass "Image tags validated for $ENVIRONMENT environment"
        fi
    else
        pass "All images use explicit version tags"
    fi
}

# Test Case 3: Helm Management - No kubectl Bypass
test_no_kubectl_bypass() {
    info "Test 3: Checking for unmanaged resources (kubectl bypass)..."
    
    if ! command -v kubectl &> /dev/null; then
        skip "kubectl not installed" "Install kubectl to run this test"
        return
    fi
    
    # Get all resources in namespace
    local resources
    if ! resources=$(kubectl get all -n "$NAMESPACE" -o json 2>/dev/null); then
        skip "Cannot access namespace $NAMESPACE" "Ensure cluster is accessible"
        return
    fi
    
    # Check for resources without Helm management label
    local unmanaged_count=0
    local resource_types=("deployments" "statefulsets" "services" "configmaps")
    
    for type in "${resource_types[@]}"; do
        local items
        items=$(kubectl get "$type" -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
        
        local count
        count=$(echo "$items" | jq -r '.items[] | select(.metadata.labels["app.kubernetes.io/managed-by"] != "Helm") | .metadata.name' | wc -l)
        
        if [ "$count" -gt 0 ]; then
            echo "  Found $count unmanaged $type:"
            echo "$items" | jq -r '.items[] | select(.metadata.labels["app.kubernetes.io/managed-by"] != "Helm") | "    - " + .metadata.name'
            ((unmanaged_count+=count))
        fi
    done
    
    if [ "$unmanaged_count" -gt 0 ]; then
        fail "Found $unmanaged_count resources not managed by Helm" "All resources must be deployed via Helmfile"
    else
        pass "All resources managed by Helm"
    fi
}

# Test Case 4: Hardcoded Credentials Check
test_no_hardcoded_credentials() {
    info "Test 4: Checking for hardcoded credentials in Helm values..."
    
    local values_files=("helm/charts/*/values.yaml" "helm/environments/*.values.yaml")
    local violations=0
    
    for pattern in "${values_files[@]}"; do
        for file in $pattern; do
            if [ -f "$file" ]; then
                # Check for plaintext passwords
                if grep -q 'password:.*"root"' "$file" 2>/dev/null; then
                    echo "  Found hardcoded 'root' password in: $file"
                    ((violations++))
                fi
                
                # Check for plaintext API keys (common patterns)
                if grep -E '(apiKey|api_key|token):.*"[A-Za-z0-9]{20,}"' "$file" 2>/dev/null; then
                    echo "  Found potential hardcoded API key in: $file"
                    ((violations++))
                fi
            fi
        done
    done
    
    if [ "$violations" -gt 0 ]; then
        fail "Found $violations hardcoded credentials" "Use Kubernetes Secrets with secretKeyRef"
    else
        pass "No hardcoded credentials found in Helm values"
    fi
}

# Test Case 5: Istio Configuration (Production)
test_istio_configuration() {
    info "Test 5: Validating Istio configuration..."
    
    if [ "$ENVIRONMENT" != "production" ]; then
        skip "Istio check (production only)" "Current environment: $ENVIRONMENT"
        return
    fi
    
    # Check for Istio configuration in values
    local prod_values="helm/environments/production.values.yaml"
    
    if [ ! -f "$prod_values" ]; then
        skip "Production values file not found" "Expected: $prod_values"
        return
    fi
    
    # Check for istio.enabled
    if ! grep -q "istio:" "$prod_values"; then
        fail "Istio configuration missing" "Production must include Istio settings"
        return
    fi
    
    # Check for DestinationRule template
    if [ ! -f "helm/charts/devbob/templates/destinationrule.yaml" ]; then
        fail "DestinationRule template missing" "Required for Istio traffic management"
        return
    fi
    
    # Check for stable subset names (not version-based)
    if grep -q 'name:.*{{.*image.tag.*replace' "helm/charts/devbob/templates/destinationrule.yaml"; then
        fail "Istio subset versioning antipattern detected" "Use stable subset names: 'stable', 'canary'"
        return
    fi
    
    pass "Istio configuration validated"
}

# Test Case 6: CI/CD GitOps Automation
test_cicd_gitops_automation() {
    info "Test 6: Validating CI/CD → GitOps automation..."
    
    local workflow_file=".github/workflows/build-devbob.yml"
    
    if [ ! -f "$workflow_file" ]; then
        skip "GitHub Actions workflow not found" "Expected: $workflow_file"
        return
    fi
    
    # Check for update-helm-values job
    if ! grep -q "update-helm-values:" "$workflow_file"; then
        fail "GitOps automation job missing" "CI/CD must auto-update Helm values"
        return
    fi
    
    # Check for yq tool usage (Helm values modification)
    if ! grep -q "yq" "$workflow_file"; then
        fail "Helm values auto-update mechanism missing" "Job must use yq to update values"
        return
    fi
    
    # Check for git commit step
    if ! grep -q "git commit" "$workflow_file"; then
        fail "Git commit step missing" "Updated Helm values must be committed to git"
        return
    fi
    
    pass "CI/CD → GitOps automation configured"
}

# Test Case 7: Validation Workflow (CI Integration)
test_validation_workflow_exists() {
    info "Test 7: Checking CI validation workflow..."
    
    local validation_workflow=".github/workflows/validate-helmfile-gitops.yml"
    
    if [ ! -f "$validation_workflow" ]; then
        fail "GitOps validation workflow missing" "Expected: $validation_workflow"
        return
    fi
    
    # Check for key validation steps
    local required_checks=("kubectl" "hardcoded credentials" "Istio subset")
    local missing_checks=0
    
    for check in "${required_checks[@]}"; do
        if ! grep -qi "$check" "$validation_workflow"; then
            echo "  Missing validation: $check"
            ((missing_checks++))
        fi
    done
    
    if [ "$missing_checks" -gt 0 ]; then
        fail "Validation workflow incomplete" "Missing $missing_checks required checks"
        return
    fi
    
    pass "CI validation workflow configured"
}

# Test Case 8: Reproducible Deployment (Destructive)
test_reproducible_deployment() {
    info "Test 8: Testing reproducible deployment..."
    
    if [ "$SKIP_DESTRUCTIVE" == "true" ]; then
        skip "Destructive test skipped" "Set SKIP_DESTRUCTIVE=false to enable"
        return
    fi
    
    if ! command -v helmfile &> /dev/null || ! command -v kubectl &> /dev/null; then
        skip "Required tools missing" "Need helmfile and kubectl"
        return
    fi
    
    # Capture current state
    local state_before
    state_before=$(kubectl get all -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    local checksum_before
    checksum_before=$(echo "$state_before" | jq -S '.items[].metadata.name' | md5sum)
    
    # Re-sync helmfile (idempotent operation)
    info "  Running helmfile sync..."
    if ! helmfile -e "$ENVIRONMENT" sync 2>&1 | tail -10; then
        fail "Helmfile sync failed" "Check helmfile configuration"
        return
    fi
    
    # Capture state after sync
    sleep 5  # Allow reconciliation
    local state_after
    state_after=$(kubectl get all -n "$NAMESPACE" -o json 2>/dev/null || echo '{"items":[]}')
    local checksum_after
    checksum_after=$(echo "$state_after" | jq -S '.items[].metadata.name' | md5sum)
    
    if [ "$checksum_before" == "$checksum_after" ]; then
        pass "Deployment is reproducible (idempotent)"
    else
        fail "Deployment state changed after sync" "Deployments should be idempotent"
    fi
}

# Test Case 9: Secret Management
test_secret_management() {
    info "Test 9: Validating Kubernetes Secrets usage..."
    
    if ! command -v kubectl &> /dev/null; then
        skip "kubectl not installed" "Install kubectl to run this test"
        return
    fi
    
    # Check for devbob-secrets
    if ! kubectl get secret devbob-secrets -n "$NAMESPACE" &>/dev/null; then
        skip "Secret 'devbob-secrets' not found" "Create secret before deployment"
        return
    fi
    
    # Verify secret keys
    local secret_keys
    secret_keys=$(kubectl get secret devbob-secrets -n "$NAMESPACE" -o json 2>/dev/null | jq -r '.data | keys[]')
    
    local required_keys=("anthropic-api-key" "github-token" "surreal-user" "surreal-pass")
    local missing_keys=0
    
    for key in "${required_keys[@]}"; do
        if ! echo "$secret_keys" | grep -q "^${key}$"; then
            echo "  Missing secret key: $key"
            ((missing_keys++))
        fi
    done
    
    if [ "$missing_keys" -gt 0 ]; then
        fail "Secret missing $missing_keys required keys" "Update secret with all required credentials"
        return
    fi
    
    # Check that deployment references secrets (not plaintext)
    local deployment_yaml
    deployment_yaml=$(kubectl get deployment -n "$NAMESPACE" -o yaml 2>/dev/null || echo "")
    
    if echo "$deployment_yaml" | grep -q "valueFrom:"; then
        if echo "$deployment_yaml" | grep -q "secretKeyRef:"; then
            pass "Deployment correctly references Kubernetes Secrets"
        else
            fail "Deployment uses valueFrom but not secretKeyRef" "Use secretKeyRef for credentials"
        fi
    else
        skip "No deployments found" "Deploy services first"
    fi
}

# Main execution
main() {
    echo "=============================================="
    echo "Validation Harness: helmfile-deployment-pattern-with-versioned-builds"
    echo "=============================================="
    echo "Environment: $ENVIRONMENT"
    echo "Namespace: $NAMESPACE"
    echo "Skip Destructive: $SKIP_DESTRUCTIVE"
    echo ""
    
    # Run all test cases
    test_helmfile_no_drift
    test_image_version_tags
    test_no_kubectl_bypass
    test_no_hardcoded_credentials
    test_istio_configuration
    test_cicd_gitops_automation
    test_validation_workflow_exists
    test_reproducible_deployment
    test_secret_management
    
    # Summary
    echo ""
    echo "=============================================="
    echo "Validation Summary"
    echo "=============================================="
    echo -e "${GREEN}Passed${NC}: $TESTS_PASSED"
    echo -e "${RED}Failed${NC}: $TESTS_FAILED"
    echo -e "${YELLOW}Skipped${NC}: $TESTS_SKIPPED"
    echo ""
    
    if [ "$TESTS_FAILED" -gt 0 ]; then
        echo -e "${RED}❌ VALIDATION FAILED${NC}"
        echo "GitOps compliance issues detected. Review failures above."
        exit 1
    elif [ "$TESTS_PASSED" -eq 0 ]; then
        echo -e "${YELLOW}⚠ NO TESTS RUN${NC}"
        echo "All tests were skipped. Check prerequisites."
        exit 2
    else
        echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
        echo "GitOps compliance verified successfully."
        exit 0
    fi
}

# Run main function
main "$@"
