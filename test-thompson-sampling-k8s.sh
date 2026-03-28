#!/bin/bash
echo "=== Testing Thompson Sampling Activity Recommendations ==="
echo ""
echo "1. Test activity recommendations endpoint directly (curl)..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s http://metabob-rpc-api:8080/activity-recommendations/health
' | jq '.'

echo ""
echo "2. Get recommendation for trace-enforce-validate-loop..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://metabob-rpc-api:8080/activity-recommendations/recommend \
  -H "Content-Type: application/json" \
  -d "{\"template_id\": \"trace-enforce-validate-loop\", \"context\": {\"category\": \"infrastructure\"}}"
' | jq '.'

echo ""
echo "3. Check if opencode activity recommend command works..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cd /tmp/test-workspace
opencode activity recommend trace-enforce-validate-loop 2>&1
' | grep -v "^INFO " | grep -v "^DEBUG "
