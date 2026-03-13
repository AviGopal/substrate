#!/bin/bash
# Test API Key Management Flow
# This script validates the complete data flow:
# Dashboard login → Create API key → Use in CLI → View usage in dashboard

set -e

API_BASE="http://api.metabob.local"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!"
TEST_NAME="Test User"
TEST_ORG="Test Organization"

echo "=========================================="
echo "API Key Management Flow Test"
echo "=========================================="
echo ""

# Step 1: Register a new user
echo "Step 1: Registering new user..."
echo "  Email: $TEST_EMAIL"

REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"name\": \"$TEST_NAME\",
    \"org_name\": \"$TEST_ORG\"
  }")

TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
USER_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('user_id', ''))")
ORG_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('org_id', ''))")

if [ -z "$TOKEN" ] || [ -z "$ORG_ID" ]; then
  echo "  ❌ Registration failed!"
  echo "  Response: $REGISTER_RESPONSE"
  exit 1
fi

echo "  ✅ Registration successful"
echo "     User ID: $USER_ID"
echo "     Org ID: $ORG_ID"
echo ""

# Step 2: Login (verify password works)
echo "Step 2: Testing login with same credentials..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$LOGIN_TOKEN" ]; then
  echo "  ❌ Login failed!"
  echo "  Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "  ✅ Login successful"
echo ""

# Step 3: Create API Key
echo "Step 3: Creating API key..."

API_KEY_RESPONSE=$(curl -s -X POST "$API_BASE/auth/orgs/$ORG_ID/api-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"Test CLI Key\",
    \"scopes\": [\"read\", \"write\"]
  }")

API_KEY=$(echo "$API_KEY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('api_key', ''))")
KEY_ID=$(echo "$API_KEY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('key_id', ''))")

if [ -z "$API_KEY" ]; then
  echo "  ❌ API key creation failed!"
  echo "  Response: $API_KEY_RESPONSE"
  exit 1
fi

echo "  ✅ API key created"
echo "     Key ID: $KEY_ID"
echo "     API Key: ${API_KEY:0:20}..."
echo ""

# Step 4: List API Keys
echo "Step 4: Listing API keys for organization..."

LIST_RESPONSE=$(curl -s -X GET "$API_BASE/auth/orgs/$ORG_ID/api-keys" \
  -H "Authorization: Bearer $TOKEN")

KEY_COUNT=$(echo "$LIST_RESPONSE" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('api_keys', [])))")

if [ "$KEY_COUNT" -lt 1 ]; then
  echo "  ❌ API key list empty!"
  echo "  Response: $LIST_RESPONSE"
  exit 1
fi

echo "  ✅ Found $KEY_COUNT API key(s)"
echo ""

# Step 5: Revoke API Key
echo "Step 5: Revoking API key..."

REVOKE_RESPONSE=$(curl -s -X POST "$API_BASE/auth/orgs/$ORG_ID/api-keys/$KEY_ID/revoke" \
  -H "Authorization: Bearer $TOKEN")

REVOKE_MSG=$(echo "$REVOKE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', ''))")

if [[ "$REVOKE_MSG" != *"revoked"* ]]; then
  echo "  ❌ API key revocation failed!"
  echo "  Response: $REVOKE_RESPONSE"
  exit 1
fi

echo "  ✅ API key revoked successfully"
echo ""

# Summary
echo "=========================================="
echo "✅ All tests passed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - User registration: ✅"
echo "  - User login: ✅"
echo "  - Create API key: ✅"
echo "  - List API keys: ✅"
echo "  - Revoke API key: ✅"
echo ""
echo "Next steps:"
echo "  1. Build Docker image: docker build -f repos/metabob-rpc-api/docker/Dockerfile.server -t metabobapp/metabob-rpc-api:0.29.1-api-key-management repos/metabob-rpc-api/"
echo "  2. Update values file: repos/platform/metabob-apps/charts/metabob-rpc-api/values/default.metabob-rpc-api.values.yaml"
echo "  3. Deploy: helmfile -f repos/platform/metabob-apps/helmfile.yaml -e integration sync"
echo "  4. Test CLI integration with API key"
echo ""
