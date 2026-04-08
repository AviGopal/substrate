#!/bin/bash
set -e

echo "🧪 Testing Cloud Dashboard Deployment"
echo "======================================"
echo ""

DASHBOARD_URL="${DASHBOARD_URL:-https://app.metabob.com}"
TEST_EMAIL="test-$(date +%s)@metabob.com"
TEST_PASSWORD="TestPassword123!"

echo "📍 Target: $DASHBOARD_URL"
echo ""

# Test 1: Signup
echo "1️⃣  Testing signup..."
SIGNUP_RESPONSE=$(curl -s -X POST "$DASHBOARD_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"name\": \"Test User\",
    \"org_name\": \"Test Org $(date +%s)\"
  }")

echo "$SIGNUP_RESPONSE" | jq .

if echo "$SIGNUP_RESPONSE" | jq -e '.data.token' > /dev/null; then
  TOKEN=$(echo "$SIGNUP_RESPONSE" | jq -r '.data.token')
  echo "✅ Signup successful! Got token."
else
  echo "❌ Signup failed"
  exit 1
fi

echo ""

# Test 2: Get current user
echo "2️⃣  Testing /auth/me..."
ME_RESPONSE=$(curl -s "$DASHBOARD_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")

echo "$ME_RESPONSE" | jq .

if echo "$ME_RESPONSE" | jq -e '.data.user.email' > /dev/null; then
  echo "✅ Auth working! User info retrieved."
else
  echo "❌ Auth/me failed"
  exit 1
fi

echo ""

# Test 3: List members
echo "3️⃣  Testing Members page (GET /v2/users)..."
MEMBERS_RESPONSE=$(curl -s "$DASHBOARD_URL/api/v2/users" \
  -H "Authorization: Bearer $TOKEN")

echo "$MEMBERS_RESPONSE" | jq .

if echo "$MEMBERS_RESPONSE" | jq -e '.data' > /dev/null; then
  echo "✅ Members API working!"
else
  echo "⚠️  Members endpoint may not be ready yet"
fi

echo ""

# Test 4: List API keys
echo "4️⃣  Testing API Keys page..."
KEYS_RESPONSE=$(curl -s "$DASHBOARD_URL/api/v2/api-keys" \
  -H "Authorization: Bearer $TOKEN")

echo "$KEYS_RESPONSE" | jq .

if echo "$KEYS_RESPONSE" | jq -e '.data' > /dev/null; then
  echo "✅ API Keys endpoint working!"
else
  echo "⚠️  API Keys endpoint may not be ready yet"
fi

echo ""

# Test 5: Get execution traces
echo "5️⃣  Testing Activity Traces page..."
TRACES_RESPONSE=$(curl -s "$DASHBOARD_URL/api/v2/activities/execution-traces?limit=10" \
  -H "Authorization: Bearer $TOKEN")

echo "$TRACES_RESPONSE" | jq .

if echo "$TRACES_RESPONSE" | jq -e '.data // .executions' > /dev/null 2>&1; then
  echo "✅ Execution Traces endpoint working!"
else
  echo "⚠️  Execution traces endpoint may not be ready yet"
fi

echo ""

# Test 6: Get metrics summary
echo "6️⃣  Testing Usage Analytics page..."
METRICS_RESPONSE=$(curl -s "$DASHBOARD_URL/api/v2/activities/metrics/summary" \
  -H "Authorization: Bearer $TOKEN")

echo "$METRICS_RESPONSE" | jq .

if echo "$METRICS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
  echo "✅ Usage metrics endpoint working!"
else
  echo "⚠️  Metrics endpoint may not be ready yet"
fi

echo ""
echo "======================================"
echo "✨ Dashboard deployment test complete!"
echo ""
echo "📧 Test account created:"
echo "   Email: $TEST_EMAIL"
echo "   Password: $TEST_PASSWORD"
echo "   Token: ${TOKEN:0:20}..."
echo ""
echo "Next: Open $DASHBOARD_URL in browser and login!"
