#!/bin/bash
set -e

# Use the user from the test script
TEST_EMAIL="test-e2e-1773471320@example.com"
TEST_PASSWORD="TestPassword123!"

echo "=== Logging in ==="
LOGIN_RESPONSE=$(curl -s -X POST http://api.metabob.local/api/v1/cloud-auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${TEST_EMAIL}\", \"password\": \"${TEST_PASSWORD}\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.user_id')
ORG_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.org_id')

echo "Token: ${TOKEN:0:30}..."
echo "User ID: $USER_ID"
echo "Org ID: $ORG_ID"

echo ""
echo "=== Creating API Key ===" 
API_KEY_RESPONSE=$(curl -s -X POST http://api.metabob.local/api/v1/cloud-auth/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"CLI Demo Key\",
    \"scopes\": [\"read\", \"write\"]
  }")

API_KEY=$(echo "$API_KEY_RESPONSE" | jq -r '.api_key')
echo "API Key: ${API_KEY:0:30}..."

echo ""
echo "=== Posting Activities with API Key ==="

# Post 5 activities
for i in {1..5}; do
  TIMESTAMP=$(date +%s)
  TEMPLATE="add-feature-complete"
  [ $i -eq 2 ] && TEMPLATE="fix-bug-complete"
  [ $i -eq 3 ] && TEMPLATE="refactor-with-tests"
  [ $i -eq 4 ] && TEMPLATE="add-comprehensive-logging"
  
  SUCCESS="true"
  ERROR_MSG=""
  [ $i -eq 5 ] && SUCCESS="false" && ERROR_MSG=', "error_message": "Validation failed", "error_type": "validation"'
  
  echo "Activity $i: $TEMPLATE (success: $SUCCESS)"
  
  curl -s -X POST http://api.metabob.local/api/v1/learning-loop/executions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "{
      \"activity_id\": \"act_demo_${i}_${TIMESTAMP}\",
      \"template_id\": \"${TEMPLATE}\",
      \"duration_ms\": $((15000 + i * 5000)),
      \"success\": ${SUCCESS},
      \"tokens_input\": $((2000 + i * 500)),
      \"tokens_output\": $((800 + i * 200)),
      \"tokens_cache\": $((1000 + i * 100)),
      \"cost_usd\": 0.$(printf "%03d" $((150 + i * 30)))
      ${ERROR_MSG}
    }" > /dev/null
    
  sleep 1
done

echo ""
echo "✓ Posted 5 activities"
echo ""
echo "Test credentials for dashboard login:"
echo "  Email: $TEST_EMAIL"
echo "  Password: $TEST_PASSWORD"
