#!/bin/bash
echo "=== Checking RPC API Code in Running Container ==="
echo ""

POD=$(kubectl get pod -n metabob -l app=metabob-rpc-api -o name | head -1)
echo "RPC API Pod: $POD"
echo ""

echo "1. Check if our modified files exist..."
kubectl exec -n metabob $POD -c rpc-api -- ls -la /app/server/routes/activity.py /app/server/actions/activity.py 2>&1 | head -10

echo ""
echo "2. Check if scope/org_id code is in routes..."
kubectl exec -n metabob $POD -c rpc-api -- grep -n "scope\|org_id" /app/server/routes/activity.py 2>&1 | head -20

echo ""
echo "3. Check Python environment..."
kubectl exec -n metabob $POD -c rpc-api -- python --version 2>&1

echo ""
echo "4. Check if we can hot-patch the code..."
kubectl exec -n metabob $POD -c rpc-api -- ls -la /app/server/ 2>&1 | head -15

echo ""
echo "Analysis: If files exist but don't have scope code, we need to:"
echo "  Option A: Copy our fixed files into the container"
echo "  Option B: Build new Docker image and deploy"
echo "  Option C: Use submodule code directly (if mounted)"
