#!/bin/bash
set -e

kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080 > /dev/null 2>&1 &
PF_PID=$!
trap "kill $PF_PID 2>/dev/null || true" EXIT
sleep 5

TIMESTAMP=$(date +%s)
echo "=== Final GAP-9 Fix Validation ==="
echo ""

# Register user
echo "[1/4] Registering new user..."
REG_RESP=$(curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"final_$TIMESTAMP@metabob.com\",
    \"password\": \"Final123!\",
    \"name\": \"Final User\",
    \"org_name\": \"Final Org\"
  }")

JWT=$(echo "$REG_RESP" | jq -r '.token')
ORG_ID=$(echo "$REG_RESP" | jq -r '.organization.org_id')

echo "✓ User: final_$TIMESTAMP@metabob.com"
echo "✓ Org ID: $ORG_ID"

# Create API key
echo ""
echo "[2/4] Creating API key..."
API_KEY_RESP=$(curl -s -X POST "http://localhost:8080/auth/orgs/$ORG_ID/api-keys" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Final Test", "description": "GAP-9 validation"}')

API_KEY=$(echo "$API_KEY_RESP" | jq -r '.api_key')
echo "✓ API Key: ${API_KEY:0:25}..."

# Post activity with API key
echo ""
echo "[3/4] Posting activity execution with API key..."
EXEC_RESP=$(curl -s -X POST http://localhost:8080/api/v1/learning-loop/executions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"activity_id\": \"final_test_$TIMESTAMP\",
    \"template_id\": \"add-feature-complete\",
    \"started_at\": \"2026-03-13T19:00:00Z\",
    \"duration_ms\": 150000,
    \"success\": true,
    \"tokens_input\": 4000,
    \"tokens_output\": 1600,
    \"tokens_cache\": 800,
    \"cost_usd\": 0.18,
    \"completed_at\": \"2026-03-13T19:02:30Z\"
  }")

if echo "$EXEC_RESP" | jq -e '.execution_id' > /dev/null 2>&1; then
  echo "✓ Execution recorded: $(echo "$EXEC_RESP" | jq -r '.execution_id')"
else
  echo "✗ Execution failed:"
  echo "$EXEC_RESP" | jq .
  kill $PF_PID 2>/dev/null
  exit 1
fi

sleep 3

# Query dashboard
echo ""
echo "[4/4] Querying dashboard endpoint..."
ACTIVITY_DATA=$(curl -s -X GET "http://localhost:8080/auth/orgs/$ORG_ID/activity" \
  -H "Authorization: Bearer $JWT")

ACTIVITY_COUNT=$(echo "$ACTIVITY_DATA" | jq '.activities | length' 2>/dev/null || echo "0")

echo ""
echo "=== RESULT ==="
if [ "$ACTIVITY_COUNT" -gt 0 ]; then
  echo "✅ SUCCESS! GAP-9 FIX VERIFIED"
  echo "✅ Dashboard returns $ACTIVITY_COUNT activity(ies)"
  echo ""
  echo "Activity details:"
  echo "$ACTIVITY_DATA" | jq '.activities[0]' | head -15
  echo ""
  echo "RPC Logs (checking for GAP-9 FIXED message):"
  kubectl logs -n metabob deployment/metabob-rpc-api --tail=50 | grep -E "GAP-9|org_id.*$ORG_ID" | tail -5
else
  echo "❌ FAILED: Still returning 0 activities"
  echo "Response: $ACTIVITY_DATA"
  echo ""
  echo "RPC Logs:"
  kubectl logs -n metabob deployment/metabob-rpc-api --tail=30 | tail -20
fi

kill $PF_PID 2>/dev/null || true
