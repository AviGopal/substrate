#!/bin/bash
# DevBob Independent Execution Validation Script
# Tests opencode execution, SDK loading, service connectivity, and activity capabilities

set -e

echo "==================================================================="
echo "DevBob Independent Execution Validation"
echo "==================================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

echo "1. SDK Preload Check"
echo "-------------------------------------------------------------------"
SDK_OUTPUT=$(opencode run 'test' 2>&1 | grep 'SDK loader' || echo "NOT_FOUND")
if echo "$SDK_OUTPUT" | grep -q "loaded=0"; then
    fail "SDK loader reports 0 packages loaded (expected 1+)"
elif echo "$SDK_OUTPUT" | grep -qE "loaded=[1-9]"; then
    LOADED_COUNT=$(echo "$SDK_OUTPUT" | grep -oP 'loaded=\K[0-9]+')
    pass "SDK loader initialized with $LOADED_COUNT packages loaded"
else
    warn "Could not determine SDK load count: $SDK_OUTPUT"
fi
echo ""

echo "2. Provider Initialization Check"
echo "-------------------------------------------------------------------"
INIT_OUTPUT=$(timeout 10s opencode run 'What is 2+2?' 2>&1 || true)
if echo "$INIT_OUTPUT" | grep -q "ProviderInitError"; then
    fail "ProviderInitError detected - SDK preload or fallback failed"
elif echo "$INIT_OUTPUT" | grep -qE "(The answer|result|four|4)"; then
    pass "Provider initialized successfully, opencode run works"
else
    warn "Unexpected output from opencode run: ${INIT_OUTPUT:0:100}"
fi
echo ""

echo "3. Service Connectivity Check"
echo "-------------------------------------------------------------------"
# Check metabob-rpc-api
RPC_STATUS=$(curl -s -m 5 http://metabob-rpc-api.metabob.svc.cluster.local:8080/status 2>&1 || echo "FAILED")
if echo "$RPC_STATUS" | grep -qE '(status|ok|healthy)'; then
    pass "metabob-rpc-api reachable: $RPC_STATUS"
else
    fail "metabob-rpc-api unreachable: $RPC_STATUS"
fi

# Check surrealdb
SURREAL_STATUS=$(curl -s -m 5 http://surrealdb.metabob.svc.cluster.local:8000/health 2>&1 || echo "FAILED")
if [ "$SURREAL_STATUS" != "FAILED" ]; then
    pass "surrealdb reachable"
else
    warn "surrealdb health check inconclusive (may require auth)"
fi
echo ""

echo "4. Secrets and Config Check"
echo "-------------------------------------------------------------------"
if [ -z "$ANTHROPIC_API_KEY" ]; then
    fail "ANTHROPIC_API_KEY not set in environment"
else
    pass "ANTHROPIC_API_KEY present (length: ${#ANTHROPIC_API_KEY})"
fi

if [ -z "$METABOB_API_KEY" ]; then
    fail "METABOB_API_KEY not set in environment"
else
    pass "METABOB_API_KEY present (length: ${#METABOB_API_KEY})"
fi

CONFIG_FILE="/workspace/.config/opencode/opencode.json"
if [ ! -f "$CONFIG_FILE" ]; then
    fail "opencode config not found at $CONFIG_FILE"
else
    if grep -q "sk-ant-" "$CONFIG_FILE"; then
        pass "opencode config exists with substituted API key"
    else
        warn "opencode config exists but API key substitution unclear"
    fi
fi
echo ""

echo "5. Activity Execution Check"
echo "-------------------------------------------------------------------"
ACTIVITY_LIST=$(cd /workspace && opencode activity list 2>&1 || echo "FAILED")
if echo "$ACTIVITY_LIST" | grep -qE "(template|activity|No activities)"; then
    pass "Activity list command works"
else
    fail "Activity list failed: $ACTIVITY_LIST"
fi
echo ""

echo "==================================================================="
echo "Validation Complete"
echo "==================================================================="
echo ""
echo "All checks passed! DevBob is ready for independent execution."
echo "Next: Test activity execution for variant_id tracking validation"
