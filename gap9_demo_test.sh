#!/bin/bash
set -e

TIMESTAMP=$(date +%s)
EMAIL="demo_$TIMESTAMP@metabob.com"
PASSWORD="Demo123!@#"

echo "=== GAP-9 Complete Demonstration ==="

# Register
REGISTER_RESP=$(curl -s -X POST http://api.metabob.local/auth/register -H "Content-Type: application/json" -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"name\": \"Demo User\", \"org_name\": \"Demo Org\"}")
JWT=$(echo "$REGISTER_RESP" | jq -r '.token')
ORG_ID=$(echo "$REGISTER_RESP" | jq -r '.organization.org_id')

echo "✅ User: $EMAIL"
echo "✅ Org ID: $ORG_ID"

# Create API key
API_KEY_RESP=$(curl -s -X POST "http://api.metabob.local/auth/orgs/$ORG_ID/api-keys" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"name": "Demo Key"}')
API_KEY=$(echo "$API_KEY_RESP" | jq -r '.api_key')
echo "✅ API Key: ${API_KEY:0:30}..."

# Post 5 activities
for i in {1..5}; do
  curl -s -X POST http://api.metabob.local/api/v1/learning-loop/executions -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d "{\"activity_id\": \"demo_$i\", \"template_id\": \"test-template\", \"started_at\": \"2026-03-13T19:00:00Z\", \"duration_ms\": $((i*30000)), \"success\": true, \"tokens_input\": $((i*1000)), \"tokens_output\": $((i*400)), \"tokens_cache\": $((i*200)), \"cost_usd\": 0.1, \"completed_at\": \"2026-03-13T19:01:00Z\"}" > /dev/null
done

echo "✅ Posted 5 activities"

# Query dashboard
DASHBOARD_RESP=$(curl -s "http://api.metabob.local/auth/orgs/$ORG_ID/activity" -H "Authorization: Bearer $JWT")
COUNT=$(echo "$DASHBOARD_RESP" | jq '.activities | length')

echo "✅ Dashboard returns: $COUNT activities"
echo ""
echo "LOGIN CREDENTIALS:"
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
