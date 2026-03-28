#!/bin/bash
set -e

echo "==================================================================="
echo "Deployment DRYness - Zero Manual Steps Validation"
echo "==================================================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0
ERRORS=()

# Test 1: ConfigMap Template Exists
echo "[TEST 1] Checking ConfigMap template exists..."
if [ -f "helm/charts/metabob-rpc-api/templates/configmap.yaml" ]; then
    echo "  ✅ PASS: ConfigMap template exists"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: ConfigMap template missing"
    ((FAIL_COUNT++))
    ERRORS+=("ConfigMap template does not exist")
fi

# Test 2: Base values.yaml has environment and jwtSecretKey
echo "[TEST 2] Checking base values.yaml has environment and jwtSecretKey..."
HAS_ENV=$(grep -c "^environment:" helm/charts/metabob-rpc-api/values.yaml || echo 0)
HAS_JWT=$(grep -c "^jwtSecretKey:" helm/charts/metabob-rpc-api/values.yaml || echo 0)

if [ "$HAS_ENV" -gt 0 ] && [ "$HAS_JWT" -gt 0 ]; then
    echo "  ✅ PASS: Base values.yaml has environment and jwtSecretKey"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: Base values.yaml missing environment or jwtSecretKey"
    ((FAIL_COUNT++))
    ERRORS+=("Base values.yaml missing required fields")
fi

# Test 3: Local values.yaml has metabobRpcApi config
echo "[TEST 3] Checking local values.yaml has metabobRpcApi config..."
HAS_METABOB_CONFIG=$(grep -c "metabobRpcApi:" helm/environments/local.values.yaml || echo 0)

if [ "$HAS_METABOB_CONFIG" -gt 0 ]; then
    echo "  ✅ PASS: Local values.yaml has metabobRpcApi config"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: Local values.yaml missing metabobRpcApi config"
    ((FAIL_COUNT++))
    ERRORS+=("Local values.yaml missing metabobRpcApi section")
fi

# Test 4: deployment-api.yaml has ENVIRONMENT env var
echo "[TEST 4] Checking deployment-api.yaml has ENVIRONMENT env var..."
HAS_ENV_VAR=$(grep -c "name: ENVIRONMENT" helm/charts/metabob-rpc-api/templates/deployment-api.yaml || echo 0)

if [ "$HAS_ENV_VAR" -gt 0 ]; then
    echo "  ✅ PASS: deployment-api.yaml has ENVIRONMENT env var"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: deployment-api.yaml missing ENVIRONMENT env var"
    ((FAIL_COUNT++))
    ERRORS+=("deployment-api.yaml missing ENVIRONMENT env var")
fi

# Test 5: deployment-worker.yaml has ENVIRONMENT env var
echo "[TEST 5] Checking deployment-worker.yaml has ENVIRONMENT env var..."
HAS_WORKER_ENV=$(grep -c "name: ENVIRONMENT" helm/charts/metabob-rpc-api/templates/deployment-worker.yaml || echo 0)

if [ "$HAS_WORKER_ENV" -gt 0 ]; then
    echo "  ✅ PASS: deployment-worker.yaml has ENVIRONMENT env var"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: deployment-worker.yaml missing ENVIRONMENT env var"
    ((FAIL_COUNT++))
    ERRORS+=("deployment-worker.yaml missing ENVIRONMENT env var")
fi

# Test 6: ConfigMap template has JWT_SECRET_KEY
echo "[TEST 6] Checking ConfigMap template has JWT_SECRET_KEY..."
HAS_JWT_IN_CM=$(grep -c "JWT_SECRET_KEY" helm/charts/metabob-rpc-api/templates/configmap.yaml || echo 0)

if [ "$HAS_JWT_IN_CM" -gt 0 ]; then
    echo "  ✅ PASS: ConfigMap template has JWT_SECRET_KEY"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: ConfigMap template missing JWT_SECRET_KEY"
    ((FAIL_COUNT++))
    ERRORS+=("ConfigMap template missing JWT_SECRET_KEY")
fi

# Test 7: ConfigMap references .Values correctly
echo "[TEST 7] Checking ConfigMap uses helm templating..."
HAS_VALUES_REF=$(grep -c ".Values" helm/charts/metabob-rpc-api/templates/configmap.yaml || echo 0)

if [ "$HAS_VALUES_REF" -gt 0 ]; then
    echo "  ✅ PASS: ConfigMap uses helm templating (.Values)"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: ConfigMap not using helm templating"
    ((FAIL_COUNT++))
    ERRORS+=("ConfigMap missing .Values references")
fi

# Test 8: Deployment templates reference .Values.environment
echo "[TEST 8] Checking deployment templates reference .Values.environment..."
HAS_VALUES_ENV=$(grep -c ".Values.environment" helm/charts/metabob-rpc-api/templates/deployment-api.yaml || echo 0)

if [ "$HAS_VALUES_ENV" -gt 0 ]; then
    echo "  ✅ PASS: Deployment templates reference .Values.environment"
    ((PASS_COUNT++))
else
    echo "  ❌ FAIL: Deployment templates missing .Values.environment reference"
    ((FAIL_COUNT++))
    ERRORS+=("Deployment templates not using .Values.environment")
fi

# Summary
echo ""
echo "==================================================================="
echo "VALIDATION RESULTS"
echo "==================================================================="
echo "Total Tests: $((PASS_COUNT + FAIL_COUNT))"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "Overall Status: PASS ✅"
    echo ""
    echo "All helm chart configuration is correct for deployment DRYness."
    echo "The deployment should work without manual kubectl commands."
    exit 0
else
    echo "Overall Status: FAIL ❌"
    echo ""
    echo "Errors:"
    for error in "${ERRORS[@]}"; do
        echo "  - $error"
    done
    exit 1
fi
