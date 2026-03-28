#!/bin/bash
set -e
RPC_API_URL="http://api.metabob.local"
echo "=== Test 1: Health ==="
curl -s "$RPC_API_URL/" | python3 -m json.tool
echo ""
echo "=== Test 2: List Templates ==="
curl -s "$RPC_API_URL/v2/activities/templates" -H "x-tenant-id: test" | python3 -m json.tool
echo ""
echo "=== Test 3: Pods ==="
kubectl get pods -n metabob | grep -E "(rpc-api|devbob|surrealdb|redis)"
