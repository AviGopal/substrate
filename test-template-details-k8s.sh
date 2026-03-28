#!/bin/bash
echo "=== Testing Template Details & Metrics in DevBob K8s ==="
echo ""
echo "1. Show trace-enforce-validate-loop template details..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity template show trace-enforce-validate-loop 2>&1
' | grep -v "^INFO " | grep -v "^DEBUG " | head -80

echo ""
echo "2. Check metrics for trace-enforce-validate-loop..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity metrics trace-enforce-validate-loop 2>&1
' | grep -v "^INFO " | grep -v "^DEBUG "
