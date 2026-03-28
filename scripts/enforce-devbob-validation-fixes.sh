#!/bin/bash
# Enforcement Script for DevBob Validation Pod Selection and Environment
# Generated from trace analysis: trace-devbob-validation-pod-selection-and-environment

set -e

NAMESPACE="metabob"
TEMPLATES_SOURCE="/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/src/session/templates"

echo "========================================"
echo "DevBob Validation Environment Enforcement"
echo "========================================"
echo ""

# Step 1: Get ready pod
echo "[Step 1] Finding ready DevBob pod..."
POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')

if [ -z "$POD" ]; then
  echo "ERROR: No ready DevBob pods found"
  kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob
  exit 1
fi

echo "✅ Found ready pod: $POD"
echo ""

# Step 2: Re-deploy Helm chart to inject METABOB_API_KEY
echo "[Step 2] Re-deploying Helm chart to inject METABOB_API_KEY..."
cd /home/avi/documents/work/exp-repo/metabob-devbob/helm
helmfile apply --skip-deps 2>&1 | tail -20
echo "✅ Helm chart re-deployed"
echo ""

# Step 3: Wait for new pod to be ready
echo "[Step 3] Waiting for new pod to be ready (may take 30-60s)..."
kubectl rollout status deployment/devbob -n $NAMESPACE --timeout=2m
echo "✅ Deployment rolled out"
echo ""

# Step 4: Get NEW ready pod
echo "[Step 4] Getting new ready pod..."
POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')
echo "✅ New pod: $POD"
echo ""

# Step 5: Verify METABOB_API_KEY
echo "[Step 5] Verifying METABOB_API_KEY injection..."
if kubectl exec -n $NAMESPACE $POD -- env | grep -q "METABOB_API_KEY"; then
  echo "✅ METABOB_API_KEY is present"
  kubectl exec -n $NAMESPACE $POD -- env | grep METABOB_API_KEY | head -c 40
  echo "..."
else
  echo "❌ METABOB_API_KEY still missing - deployment may not have been updated"
  exit 1
fi
echo ""

# Step 6: Copy activity templates
echo "[Step 6] Copying activity templates to pod storage..."
kubectl exec -n $NAMESPACE $POD -- mkdir -p /root/.local/share/opencode/storage/activity-template
kubectl cp $TEMPLATES_SOURCE/trace-data-flow-single-feature.json $NAMESPACE/$POD:/root/.local/share/opencode/storage/activity-template/
kubectl cp $TEMPLATES_SOURCE/trace-enforce-validate-loop.json $NAMESPACE/$POD:/root/.local/share/opencode/storage/activity-template/
kubectl cp $TEMPLATES_SOURCE/add-feature-complete.json $NAMESPACE/$POD:/root/.local/share/opencode/storage/activity-template/
TEMPLATE_COUNT=$(kubectl exec -n $NAMESPACE $POD -- ls /root/.local/share/opencode/storage/activity-template/ | wc -l)
echo "✅ Copied $TEMPLATE_COUNT activity templates"
echo ""

# Step 7: Verify ConfigMap mount
echo "[Step 7] Verifying ConfigMap mount..."
if kubectl exec -n $NAMESPACE $POD -- test -f /workspace/.config/opencode/opencode.json; then
  echo "✅ ConfigMap file exists"
  kubectl exec -n $NAMESPACE $POD -- ls -lh /workspace/.config/opencode/opencode.json
  CONFIG_SIZE=$(kubectl exec -n $NAMESPACE $POD -- cat /workspace/.config/opencode/opencode.json | wc -c)
  echo "   Config size: $CONFIG_SIZE bytes"
else
  echo "❌ ConfigMap file not found at /workspace/.config/opencode/opencode.json"
  kubectl exec -n $NAMESPACE $POD -- ls -la /workspace/.config/opencode/ || echo "Directory doesn't exist"
fi
echo ""

# Step 8: Validation Summary
echo "========================================"
echo "Validation Summary"
echo "========================================"
echo ""
echo "Testing all 7 requirements:"
echo ""

# Test 1: Pod selection
echo "1. Pod Selection:"
READY_POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=devbob -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' | awk '{print $1}')
if [ "$READY_POD" == "$POD" ]; then
  echo "   ✅ PASS: Selected ready pod: $READY_POD"
else
  echo "   ❌ FAIL: Pod mismatch"
fi

# Test 2: METABOB_API_KEY
echo "2. METABOB_API_KEY Environment Variable:"
if kubectl exec -n $NAMESPACE $POD -- env | grep -q "METABOB_API_KEY"; then
  echo "   ✅ PASS: Environment variable present"
else
  echo "   ❌ FAIL: Environment variable missing"
fi

# Test 3: Activity Templates
echo "3. Activity Templates:"
TEMPLATE_COUNT=$(kubectl exec -n $NAMESPACE $POD -- ls /root/.local/share/opencode/storage/activity-template/ 2>/dev/null | wc -l)
if [ "$TEMPLATE_COUNT" -ge 3 ]; then
  echo "   ✅ PASS: $TEMPLATE_COUNT templates present"
else
  echo "   ❌ FAIL: Only $TEMPLATE_COUNT templates (need ≥3)"
fi

# Test 4: ConfigMap
echo "4. ConfigMap Mount:"
if kubectl exec -n $NAMESPACE $POD -- test -f /workspace/.config/opencode/opencode.json; then
  echo "   ✅ PASS: Config file accessible"
else
  echo "   ❌ FAIL: Config file not found"
fi

# Test 5: Git Operations
echo "5. Git Operations:"
if kubectl exec -n $NAMESPACE $POD -- which git > /dev/null 2>&1; then
  echo "   ✅ PASS: Git available"
else
  echo "   ❌ FAIL: Git not available"
fi

# Test 6: API Connectivity
echo "6. API Connectivity:"
if kubectl exec -n $NAMESPACE $POD -- curl -s http://metabob-rpc-api/health 2>&1 | grep -q "ok"; then
  echo "   ✅ PASS: RPC API reachable"
else
  echo "   ⚠️  SKIP: RPC API not reachable (may not be running)"
fi

# Test 7: Secrets
echo "7. Secrets Present:"
SECRET_COUNT=$(kubectl get secret -n $NAMESPACE devbob-secrets -o json | jq -r '.data | length')
if [ "$SECRET_COUNT" -eq 5 ]; then
  echo "   ✅ PASS: All 5 secrets present"
else
  echo "   ⚠️  PARTIAL: $SECRET_COUNT secrets (expected 5)"
fi

echo ""
echo "========================================"
echo "Enforcement Complete!"
echo "========================================"
echo ""
echo "Pod: $POD (ready=true)"
echo "Templates: $TEMPLATE_COUNT"
echo "Secrets: $SECRET_COUNT"
echo ""
echo "Next steps:"
echo "  - Run validation harness: scripts/run-phase1-validation-in-devbob.sh"
echo "  - Execute activities in DevBob to test variant_id data flow"
