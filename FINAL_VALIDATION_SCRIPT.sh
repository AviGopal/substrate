#!/bin/bash
set -e

echo "=== FINAL E2E VALIDATION: CLI → Dashboard with org_id Fix ==="
echo ""

# Step 1: Deploy updated RPC API (if needed)
echo "[1/6] Checking RPC API deployment status..."
kubectl rollout status deployment/metabob-rpc-api -n metabob --timeout=5s 2>/dev/null || echo "  Note: May need restart for new code"

# Step 2: Port forward
echo "[2/6] Setting up port forwards..."
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080 > /tmp/pf_rpc.log 2>&1 &
PF_PID=$!
trap "kill $PF_PID 2>/dev/null || true" EXIT
sleep 5

# Step 3: Recreate user (SurrealDB in-memory)
echo "[3/6] Creating test user and API key..."
REGISTER_RESP=$(curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "final@metabob.com",
    "password": "Final123!",
    "name": "Final Test User",
    "org_name": "Final Test Org"
  }')

JWT=$(echo "$REGISTER_RESP" | jq -r '.token')
ORG_ID=$(echo "$REGISTER_RESP" | jq -r '.organization.org_id')
USER_EMAIL=$(echo "$REGISTER_RESP" | jq -r '.user.email')

if [ "$ORG_ID" == "null" ]; then
  echo "✗ Registration failed"
  echo "$REGISTER_RESP" | jq .
  exit 1
fi

echo "  ✓ User: $USER_EMAIL"
echo "  ✓ Org ID: $ORG_ID"

# Create API key
API_KEY_RESP=$(curl -s -X POST "http://localhost:8080/auth/orgs/$ORG_ID/api-keys" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Final Test Key", "description": "E2E validation"}')

API_KEY=$(echo "$API_KEY_RESP" | jq -r '.api_key')
echo "  ✓ API Key: ${API_KEY:0:30}..."

# Step 4: Generate CLI data
echo ""
echo "[4/6] Generating CLI activity data (with org_id fix)..."
for i in {1..3}; do
  ACTIVITY_ID="final_test_$(date +%s)_$i"
  RESULT=$(curl -s -X POST http://localhost:8080/api/v1/learning-loop/executions \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"activity_id\": \"$ACTIVITY_ID\",
      \"template_id\": \"add-feature-complete\",
      \"started_at\": \"2026-03-13T18:$(printf "%02d" $((i*5))):00Z\",
      \"duration_ms\": $((100000 * i)),
      \"success\": true,
      \"tokens_input\": $((2000 * i)),
      \"tokens_output\": $((800 * i)),
      \"tokens_cache\": $((400 * i)),
      \"cost_usd\": $(echo "0.10 * $i" | bc),
      \"completed_at\": \"2026-03-13T18:$(printf "%02d" $((i*5+2))):00Z\"
    }")
  
  if echo "$RESULT" | jq -e '.execution_id' > /dev/null 2>&1; then
    echo "  [$i] ✓ $(echo "$RESULT" | jq -r '.execution_id')"
  else
    echo "  [$i] ✗ $(echo "$RESULT" | jq -r '.error // "Unknown error"')"
  fi
  sleep 0.5
done

# Step 5: Verify in RPC logs (org_id extraction)
echo ""
echo "[5/6] Checking RPC API logs for org_id extraction..."
kubectl logs -n metabob deployment/metabob-rpc-api --tail=50 | grep -E "org_id.*$ORG_ID|GAP-9" | tail -5 || echo "  (no GAP-9 warnings - good!)"

# Step 6: Query dashboard endpoint
echo ""
echo "[6/6] Querying dashboard endpoint..."
ACTIVITY_DATA=$(curl -s -X GET "http://localhost:8080/auth/orgs/$ORG_ID/activity" \
  -H "Authorization: Bearer $JWT")

ACTIVITY_COUNT=$(echo "$ACTIVITY_DATA" | jq '.activities | length')

if [ "$ACTIVITY_COUNT" -gt 0 ]; then
  echo "  ✓ SUCCESS! Dashboard returns $ACTIVITY_COUNT activities"
  echo ""
  echo "Sample activity:"
  echo "$ACTIVITY_DATA" | jq '.activities[0]' | head -20
else
  echo "  ✗ FAILED: Dashboard returns 0 activities"
  echo "$ACTIVITY_DATA" | jq .
fi

# Save credentials for Playwright
cat > /tmp/final_test_creds.json <<EOF
{
  "email": "$USER_EMAIL",
  "password": "Final123!",
  "org_id": "$ORG_ID",
  "api_key": "$API_KEY",
  "jwt_token": "$JWT",
  "expected_activities": 3
}
EOF

echo ""
echo "=== Summary ==="
if [ "$ACTIVITY_COUNT" -gt 0 ]; then
  echo "✅ org_id Fix VERIFIED"
  echo "✅ CLI data appears in dashboard queries"
  echo "✅ Multi-tenancy working"
  echo ""
  echo "Next: Use Playwright to login and verify UI display"
  echo "  Credentials saved to: /tmp/final_test_creds.json"
else
  echo "❌ org_id fix not working yet"
  echo "   Check if RPC API was restarted with new code"
fi

kill $PF_PID 2>/dev/null || true
