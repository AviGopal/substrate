#!/bin/bash
echo "=== Testing Activity Template Management in DevBob K8s ==="
echo ""
echo "1. List all activity templates..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity template list 2>&1
' | grep -v "^INFO " | grep -v "^DEBUG " | head -50

echo ""
echo "2. List feature category templates..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity template list feature 2>&1
' | grep -v "^INFO " | grep -v "^DEBUG " | head -30

echo ""
echo "3. Check activity metrics command..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity metrics 2>&1 || echo "No template ID provided (expected)"
' | grep -v "^INFO " | grep -v "^DEBUG " | head -20
