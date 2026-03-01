#!/bin/bash
API_KEY="mb_OoavN5qM_XuceBTBTsfgWo7jDuvtiXnhf7U-OkCcYX4"

echo "=== Testing Authenticated Endpoints ==="
echo ""
echo "1. List activity templates (authenticated)..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s http://metabob-rpc-api:8080/v2/activities/templates?limit=10 \
  -H 'X-API-Key: $API_KEY'
" | python3 -m json.tool | head -80

echo ""
echo "2. Get specific template details..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s http://metabob-rpc-api:8080/v2/activities/templates/trace-enforce-validate-loop \
  -H 'X-API-Key: $API_KEY'
" | python3 -m json.tool | head -100

echo ""
echo "3. Create a test session..."
SESSION_RESPONSE=\$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s -X POST http://metabob-rpc-api:8080/v2/session \
  -H 'X-API-Key: $API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{\"metadata\": {\"test\": \"k8s-validation\"}}'
")
echo "\$SESSION_RESPONSE" | python3 -m json.tool

SESSION_ID=\$(echo "\$SESSION_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('session_id', ''))" 2>/dev/null)
echo ""
echo "✅ Created session: \$SESSION_ID"

echo ""
echo "4. List recent activities..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
curl -s http://metabob-rpc-api:8080/v2/activities?limit=5 \
  -H 'X-API-Key: $API_KEY'
" | python3 -m json.tool | head -50
