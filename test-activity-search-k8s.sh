#!/bin/bash
echo "=== Testing Activity Template Search in DevBob K8s ==="
echo ""
echo "1. Searching for feature templates..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity templates search --category feature --limit 5 2>&1
' | grep -v "^INFO " | grep -v "^DEBUG "

echo ""
echo "2. Listing all templates (compact)..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity templates list --limit 10 2>&1
' | grep -v "^INFO " | grep -v "^DEBUG "
