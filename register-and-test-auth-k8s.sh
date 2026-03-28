#!/bin/bash
echo "=== Complete Authentication Flow Test ==="
echo ""
echo "1. Register new user..."
REGISTER_RESPONSE=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://metabob-rpc-api:8080/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"DevBob Test User\",
    \"email\": \"devbob-test@local.dev\",
    \"password\": \"test-password-123\",
    \"organization_name\": \"DevBob K8s Test Org\"
  }"
')
echo "$REGISTER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESPONSE"

echo ""
echo "2. Login to get API key..."
LOGIN_RESPONSE=$(kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://metabob-rpc-api:8080/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"devbob-test@local.dev\",
    \"password\": \"test-password-123\"
  }"
')
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null

# Extract API key
API_KEY=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('api_key', ''))" 2>/dev/null)

if [ -n "$API_KEY" ]; then
  echo ""
  echo "3. Test authenticated endpoint with API key..."
  kubectl exec devbob-0 -n metabob -c devbob -- bash -c "
  curl -s http://metabob-rpc-api:8080/v2/activities/templates?limit=5 \
    -H 'X-API-Key: $API_KEY'
  " | python3 -m json.tool 2>/dev/null | head -100
  
  echo ""
  echo "✅ API Key for future use:"
  echo "   $API_KEY"
else
  echo "❌ Failed to extract API key from login response"
fi
