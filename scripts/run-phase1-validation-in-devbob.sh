#!/bin/bash
# Deploy and run Phase 1 validation harness in devbob container
# This script orchestrates the external validation strategy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NAMESPACE="metabob"
DEVBOB_POD=$(kubectl get pods -n $NAMESPACE -l app=devbob -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')
RPC_API_DEPLOYMENT="metabob-rpc-api"

if [ -z "$DEVBOB_POD" ]; then
  echo "ERROR: No ready DevBob pods found in namespace $NAMESPACE"
  kubectl get pods -n $NAMESPACE -l app=devbob
  exit 1
fi

echo "=========================================="
echo "Phase 1 Validation Deployment & Execution"
echo "=========================================="
echo "Namespace: $NAMESPACE"
echo "DevBob Pod: $DEVBOB_POD (ready=true)"
echo ""

# Step 1: Deploy latest code (optional - uncomment if needed)
# echo "[Step 1] Deploying latest code to k8s..."
# cd "$PROJECT_ROOT/repos/platform/metabob-apps"
# helmfile apply
# echo "✅ Deployment initiated"
# echo ""

# Step 2: Wait for rollout
echo "[Step 2] Waiting for RPC API rollout..."
kubectl rollout status deployment/$RPC_API_DEPLOYMENT -n $NAMESPACE --timeout=5m
echo "✅ RPC API deployment ready"
echo ""

# Step 3: Copy validation harness to devbob pod
echo "[Step 3] Copying validation harness to devbob pod..."
HARNESS_FILE="$PROJECT_ROOT/tests/validation-harnesses/phase1-impulse-binding-e2e-validation-harness.py"

if [ ! -f "$HARNESS_FILE" ]; then
    echo "❌ ERROR: Harness file not found: $HARNESS_FILE"
    exit 1
fi

kubectl cp "$HARNESS_FILE" "$NAMESPACE/$DEVBOB_POD:/tmp/phase1-validation-harness.py"
echo "✅ Harness copied to /tmp/phase1-validation-harness.py"
echo ""

# Step 4: Install dependencies in devbob (if needed)
echo "[Step 4] Installing dependencies in devbob..."
kubectl exec -n $NAMESPACE $DEVBOB_POD -- pip install requests 2>&1 | grep -v "Requirement already satisfied" || true
echo "✅ Dependencies ready"
echo ""

# Step 5: Run validation harness
echo "[Step 5] Running validation harness in devbob..."
echo "=========================================="
kubectl exec -n $NAMESPACE $DEVBOB_POD -- python3 /tmp/phase1-validation-harness.py --verbose
VALIDATION_EXIT_CODE=$?
echo "=========================================="
echo ""

# Step 6: Copy results back
echo "[Step 6] Retrieving validation results..."
mkdir -p "$PROJECT_ROOT/validation-results"
kubectl cp "$NAMESPACE/$DEVBOB_POD:/tmp/phase1-validation-results.json" "$PROJECT_ROOT/validation-results/phase1-validation-results.json" 2>/dev/null || echo "⚠️  No results file found"
echo "✅ Results saved to: $PROJECT_ROOT/validation-results/phase1-validation-results.json"
echo ""

# Step 7: Follow RPC API logs (optional)
if [ "$1" == "--follow-logs" ]; then
    echo "[Step 7] Following RPC API logs (Ctrl+C to stop)..."
    RPC_API_POD=$(kubectl get pods -n $NAMESPACE -l app=metabob-rpc-api -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')
    if [ -z "$RPC_API_POD" ]; then
      echo "WARNING: No ready RPC API pods found"
    else
      kubectl logs -f $RPC_API_POD -n $NAMESPACE
    fi
fi

# Summary
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
if [ $VALIDATION_EXIT_CODE -eq 0 ]; then
    echo "✅ ALL VALIDATION CASES PASSED"
    exit 0
else
    echo "❌ VALIDATION FAILED (exit code: $VALIDATION_EXIT_CODE)"
    echo "Check results in: $PROJECT_ROOT/validation-results/phase1-validation-results.json"
    exit 1
fi
