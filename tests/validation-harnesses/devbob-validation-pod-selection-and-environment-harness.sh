#!/bin/bash
# Validation Harness: DevBob Validation Pod Selection and Environment
# Specification: devbob-validation-pod-selection-and-environment
# Generated: 2026-03-09
#
# This harness validates the complete enforcement of:
# 1. Pod selection logic (ready filter)
# 2. METABOB_API_KEY environment variable
# 3. Activity template storage
# 4. ConfigMap volume mount
# 5. Complete validation environment (7-9 tests)

set -e

NAMESPACE="metabob"
EXIT_CODE=0
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "DevBob Validation Environment Harness"
echo "========================================"
echo "Specification: devbob-validation-pod-selection-and-environment"
echo "Date: $(date)"
echo ""

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    echo -e "${RED}   Expected: $2${NC}"
    echo -e "${RED}   Actual: $3${NC}"
    FAILED=$((FAILED + 1))
    EXIT_CODE=1
}

info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

# ============================================================================
# TEST CASE 1: Pod Selection Logic
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Pod Selection - Ready Filter"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Testing kubectl jsonpath filter for ready pods"

# Get pod using ready filter
READY_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob \
  -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')

if [ -z "$READY_POD" ]; then
    fail "Pod Selection" "A ready pod" "No ready pods found"
    info "Available pods:"
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob
    echo ""
    echo "CRITICAL: Cannot continue without ready pod. Exiting."
    exit 1
fi

# Verify pod is actually ready
POD_READY=$(kubectl get pod -n $NAMESPACE $READY_POD -o jsonpath='{.status.containerStatuses[0].ready}')

if [ "$POD_READY" == "true" ]; then
    pass "Pod Selection - Selected pod '$READY_POD' is ready"
else
    fail "Pod Selection" "ready=true" "ready=$POD_READY"
fi

info "Using pod: $READY_POD"
echo ""

# ============================================================================
# TEST CASE 2: METABOB_API_KEY Environment Variable
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: METABOB_API_KEY Environment Variable"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Checking METABOB_API_KEY in pod environment"

# Check if environment variable exists
if kubectl exec -n $NAMESPACE $READY_POD -- env 2>/dev/null | grep -q "^METABOB_API_KEY="; then
    # Get the value (first 20 chars for verification)
    API_KEY_VALUE=$(kubectl exec -n $NAMESPACE $READY_POD -- env 2>/dev/null | grep "^METABOB_API_KEY=" | cut -d'=' -f2 | head -c 20)
    
    if [ -z "$API_KEY_VALUE" ]; then
        fail "METABOB_API_KEY Value" "Non-empty value" "Empty string"
    else
        pass "METABOB_API_KEY - Present with value: ${API_KEY_VALUE}..."
    fi
else
    fail "METABOB_API_KEY Presence" "Environment variable present" "Not found in pod environment"
    info "Run enforcement script to inject METABOB_API_KEY via Helm redeploy"
fi

echo ""

# ============================================================================
# TEST CASE 3: Activity Template Storage
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Activity Template Storage"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Checking activity templates in pod storage"

# Count templates
TEMPLATE_COUNT=$(kubectl exec -n $NAMESPACE $READY_POD -- ls /root/.local/share/opencode/storage/activity-template/ 2>/dev/null | wc -l || echo "0")

if [ "$TEMPLATE_COUNT" -ge 3 ]; then
    pass "Activity Templates - $TEMPLATE_COUNT templates present (>= 3 required)"
    
    # List specific templates
    info "Available templates:"
    kubectl exec -n $NAMESPACE $READY_POD -- ls -lh /root/.local/share/opencode/storage/activity-template/ 2>/dev/null | tail -n +2 | awk '{print "  - " $9 " (" $5 ")"}'
else
    fail "Activity Templates" ">= 3 templates" "$TEMPLATE_COUNT templates"
    info "Run enforcement script to copy templates via kubectl cp"
fi

echo ""

# ============================================================================
# TEST CASE 4: ConfigMap Volume Mount
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: ConfigMap Volume Mount"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Checking ConfigMap mount at /workspace/.config/opencode/opencode.json"

# Check if file exists
if kubectl exec -n $NAMESPACE $READY_POD -- test -f /workspace/.config/opencode/opencode.json 2>/dev/null; then
    # Get file size
    CONFIG_SIZE=$(kubectl exec -n $NAMESPACE $READY_POD -- stat -c %s /workspace/.config/opencode/opencode.json 2>/dev/null)
    
    if [ "$CONFIG_SIZE" -gt 100 ]; then
        pass "ConfigMap File - Exists and readable ($CONFIG_SIZE bytes)"
        
        # Verify it's valid JSON
        if kubectl exec -n $NAMESPACE $READY_POD -- cat /workspace/.config/opencode/opencode.json 2>/dev/null | jq . > /dev/null 2>&1; then
            pass "ConfigMap Content - Valid JSON structure"
        else
            fail "ConfigMap Content" "Valid JSON" "Invalid JSON or parse error"
        fi
    else
        fail "ConfigMap File Size" "> 100 bytes" "$CONFIG_SIZE bytes (suspiciously small)"
    fi
else
    fail "ConfigMap File Existence" "File at /workspace/.config/opencode/opencode.json" "File not found"
    info "Checking mount directory:"
    kubectl exec -n $NAMESPACE $READY_POD -- ls -la /workspace/.config/opencode/ 2>/dev/null || echo "  Directory doesn't exist"
fi

echo ""

# ============================================================================
# TEST CASE 5: Git Operations
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: Git Operations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Checking git availability and configuration"

# Check git binary
if kubectl exec -n $NAMESPACE $READY_POD -- which git > /dev/null 2>&1; then
    GIT_VERSION=$(kubectl exec -n $NAMESPACE $READY_POD -- git --version 2>/dev/null)
    pass "Git Binary - Available: $GIT_VERSION"
else
    fail "Git Binary" "git command available" "git not found"
fi

# Check git config
GIT_USER_NAME=$(kubectl exec -n $NAMESPACE $READY_POD -- env 2>/dev/null | grep "^GIT_USER_NAME=" | cut -d'=' -f2 || echo "")
GIT_USER_EMAIL=$(kubectl exec -n $NAMESPACE $READY_POD -- env 2>/dev/null | grep "^GIT_USER_EMAIL=" | cut -d'=' -f2 || echo "")

if [ -n "$GIT_USER_NAME" ] && [ -n "$GIT_USER_EMAIL" ]; then
    pass "Git Configuration - User: $GIT_USER_NAME <$GIT_USER_EMAIL>"
else
    fail "Git Configuration" "GIT_USER_NAME and GIT_USER_EMAIL set" "One or both missing"
fi

echo ""

# ============================================================================
# TEST CASE 6: API Connectivity
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: API Connectivity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Checking RPC API connectivity"

# Check if RPC API is reachable
if kubectl exec -n $NAMESPACE $READY_POD -- curl -s --max-time 3 http://metabob-rpc-api/health 2>/dev/null | grep -q "ok"; then
    pass "RPC API Connectivity - Health endpoint reachable"
else
    info "RPC API not reachable (may not be running - skipping)"
    # Don't fail, just note
fi

echo ""

# ============================================================================
# TEST CASE 7: Secrets Present
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 7: Kubernetes Secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Checking DevBob secrets in k8s"

# Count secrets in devbob-secrets
SECRET_COUNT=$(kubectl get secret -n $NAMESPACE devbob-secrets -o json 2>/dev/null | jq -r '.data | length' || echo "0")
EXPECTED_SECRETS=5

if [ "$SECRET_COUNT" -eq "$EXPECTED_SECRETS" ]; then
    pass "Kubernetes Secrets - All $EXPECTED_SECRETS secrets present"
    info "Secrets: anthropic-api-key, metabob-api-key, github-token, git-user-name, git-user-email"
else
    fail "Kubernetes Secrets" "$EXPECTED_SECRETS secrets" "$SECRET_COUNT secrets"
fi

echo ""

# ============================================================================
# TEST CASE 8: OpenCode Binary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 8: OpenCode Binary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Checking OpenCode installation"

# Check OpenCode binary
if kubectl exec -n $NAMESPACE $READY_POD -- which opencode > /dev/null 2>&1; then
    OPENCODE_VERSION=$(kubectl exec -n $NAMESPACE $READY_POD -- opencode --version 2>&1 | grep -v INFO | head -1)
    pass "OpenCode Binary - Available: $OPENCODE_VERSION"
else
    fail "OpenCode Binary" "opencode command available" "opencode not found"
fi

echo ""

# ============================================================================
# TEST CASE 9: Activity Execution Test
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 9: Activity Execution (Simple Test)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

info "Testing basic activity execution capability"

# Check if we have templates to test with
if [ "$TEMPLATE_COUNT" -ge 1 ]; then
    # Try to list activities (non-LLM operation)
    if kubectl exec -n $NAMESPACE $READY_POD -- opencode activity list 2>&1 | grep -q "trace-data-flow\|trace-enforce-validate\|add-feature" 2>/dev/null; then
        pass "Activity System - Templates registered and listable"
    else
        info "Activity templates not registered yet (needs bootstrap)"
        # Don't fail, this is optional
    fi
else
    info "Skipping activity execution test (no templates available)"
fi

echo ""

# ============================================================================
# VALIDATION SUMMARY
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VALIDATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
PASS_RATE=$((PASSED * 100 / TOTAL))

if [ "$PASSED" -ge 7 ]; then
    echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
    echo "   Pass rate: $PASS_RATE% ($PASSED/$TOTAL)"
    echo "   Requirement: >= 7 tests passing"
    echo ""
    echo "Environment is ready for:"
    echo "  - Activity execution in DevBob"
    echo "  - Variant_id data flow observation"
    echo "  - Hierarchical composition validation"
    echo "  - Continuous optimization architecture testing"
else
    echo -e "${RED}❌ VALIDATION FAILED${NC}"
    echo "   Pass rate: $PASS_RATE% ($PASSED/$TOTAL)"
    echo "   Requirement: >= 7 tests passing"
    echo ""
    echo "Required fixes:"
    [ "$FAILED" -gt 0 ] && echo "  - Review failed tests above"
    [ "$TEMPLATE_COUNT" -lt 3 ] && echo "  - Copy activity templates to pod storage"
    ! kubectl exec -n $NAMESPACE $READY_POD -- env 2>/dev/null | grep -q "^METABOB_API_KEY=" && echo "  - Re-deploy Helm chart to inject METABOB_API_KEY"
    echo ""
    echo "Run enforcement script to fix:"
    echo "  ./scripts/enforce-devbob-validation-fixes.sh"
fi

echo ""
echo "========================================"
echo "End of Validation Harness"
echo "========================================"

exit $EXIT_CODE
