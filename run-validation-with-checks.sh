#!/bin/bash
# Validation runner with prerequisite checks

set -e

echo "=========================================="
echo "minibob Complete System Integration"
echo "Validation Harness Execution"
echo "=========================================="
echo ""

# Check 1: Cluster availability
echo "[Check 1/5] Checking cluster availability..."
if kubectl cluster-info &> /dev/null; then
    echo "✅ Kubernetes cluster accessible"
else
    echo "❌ Kubernetes cluster not accessible"
    exit 1
fi

# Check 2: minibob deployment
echo "[Check 2/5] Checking minibob deployment..."
POD_COUNT=$(kubectl get pods -n minibob-cluster --no-headers 2>/dev/null | wc -l)
if [ "$POD_COUNT" -gt 0 ]; then
    echo "✅ minibob pods found: $POD_COUNT"
else
    echo "⚠️  No minibob pods found in minibob-cluster namespace"
    echo "   Run: cd helm && helmfile -e testing sync -l namespace=minibob-cluster"
    exit 1
fi

# Check 3: Backend availability
echo "[Check 3/5] Checking backend availability..."
if kubectl get pods -n metabob -l app=metabob-rpc-api --no-headers 2>/dev/null | grep -q Running; then
    echo "✅ Backend (metabob-rpc-api) is running"
else
    echo "❌ Backend not available"
    exit 1
fi

# Check 4: Harness file exists
echo "[Check 4/5] Checking validation harness..."
if [ -f "tests/validation-harnesses/minibob-complete-system-integration-harness.ts" ]; then
    echo "✅ Validation harness exists"
else
    echo "❌ Validation harness not found"
    exit 1
fi

# Check 5: bun runtime
echo "[Check 5/5] Checking bun runtime..."
if command -v bun &> /dev/null; then
    echo "✅ bun runtime available"
else
    echo "❌ bun runtime not found"
    exit 1
fi

echo ""
echo "=========================================="
echo "All prerequisites met!"
echo "=========================================="
echo ""

# Run validation
TEST_CASE=${1:-1}
echo "Running test case $TEST_CASE..."
bun run tests/validation-harnesses/run-minibob-validation.ts $TEST_CASE
