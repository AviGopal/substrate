#!/bin/bash
set -e

echo "========================================"
echo "DevBob K8s Deployment Verification"
echo "========================================"
echo ""

echo "1. Checking pod status..."
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o wide
echo ""

echo "2. Checking service..."
kubectl get svc -n metabob devbob
echo ""

echo "3. Verifying OpenCode version..."
POD=$(kubectl get pods -n metabob -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n metabob $POD -- /opt/opencode/bin/opencode --version 2>&1 | grep -v INFO | head -1
echo ""

echo "4. Verifying ripgrep..."
kubectl exec -n metabob $POD -- rg --version 2>&1 | grep -v Defaulted | head -1
echo ""

echo "5. Testing config endpoint..."
kubectl exec -n metabob $POD -- curl -s http://localhost:8080/config 2>&1 | grep -v Defaulted | jq -r '.sessionMemory.enabled'
echo ""

echo "6. Checking recent logs (last 10 lines)..."
kubectl logs -n metabob $POD --tail=10 2>&1 | grep -v Defaulted
echo ""

echo "========================================"
echo "✅ Verification Complete!"
echo "========================================"
echo ""
echo "DevBob is ready for ACP delegation testing."
echo ""
echo "Next steps:"
echo "  - Test vessel container connectivity"
echo "  - Run activity via ACP protocol"
echo "  - Verify git operations work"
