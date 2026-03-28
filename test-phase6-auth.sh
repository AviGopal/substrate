#!/bin/bash

# Phase 6: MiniBob Authentication Test Suite
# Tests SurrealDB schemas and authentication endpoints

set -e

API_URL="http://localhost:8080"
SURREAL_URL="http://localhost:8000"

echo "=== Phase 6: MiniBob Authentication Test Suite ==="
echo ""

# Test 1: Verify SurrealDB connection
echo "✓ Test 1: SurrealDB connection"
SURREAL_RESPONSE=$(curl -s -X POST ${SURREAL_URL}/sql \
  -H "Surreal-NS: activity-system" \
  -H "Surreal-DB: learning_loop" \
  -H "Content-Type: text/plain" \
  -u "root:surrealdb-local-dev-123" \
  --data "INFO FOR DB;")
  
if echo "$SURREAL_RESPONSE" | jq -e '.[0].status == "OK"' > /dev/null; then
  echo "  ✅ SurrealDB connected successfully"
else
  echo "  ❌ SurrealDB connection failed"
  exit 1
fi
echo ""

# Test 2: Verify organizations table
echo "✓ Test 2: Organizations table"
ORG_RESPONSE=$(curl -s -X POST ${SURREAL_URL}/sql \
  -H "Surreal-NS: activity-system" \
  -H "Surreal-DB: learning_loop" \
  -H "Content-Type: text/plain" \
  -u "root:surrealdb-local-dev-123" \
  --data "SELECT * FROM organizations;")
  
ORG_COUNT=$(echo "$ORG_RESPONSE" | jq -r '.[0].result | length')
if [ "$ORG_COUNT" -ge 1 ]; then
  echo "  ✅ Organization found: $(echo "$ORG_RESPONSE" | jq -r '.[0].result[0].name')"
else
  echo "  ❌ No organizations found"
  exit 1
fi
echo ""

# Test 3: Verify MiniBob instances table
echo "✓ Test 3: MiniBob instances table"
INSTANCE_RESPONSE=$(curl -s -X POST ${SURREAL_URL}/sql \
  -H "Surreal-NS: activity-system" \
  -H "Surreal-DB: learning_loop" \
  -H "Content-Type: text/plain" \
  -u "root:surrealdb-local-dev-123" \
  --data "SELECT * FROM minibob_instance;")
  
INSTANCE_COUNT=$(echo "$INSTANCE_RESPONSE" | jq -r '.[0].result | length')
if [ "$INSTANCE_COUNT" -ge 1 ]; then
  INSTANCE_ID=$(echo "$INSTANCE_RESPONSE" | jq -r '.[0].result[0].instance_id')
  echo "  ✅ MiniBob instance found: $INSTANCE_ID"
else
  echo "  ❌ No MiniBob instances found"
  exit 1
fi
echo ""

# Test 4: MiniBob signin
echo "✓ Test 4: MiniBob signin"
SIGNIN_RESPONSE=$(curl -s -X POST ${API_URL}/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"test-api-key-123"}')
  
TOKEN=$(echo "$SIGNIN_RESPONSE" | jq -r '.token.access')
if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "  ✅ JWT token received (${#TOKEN} chars)"
  echo "  Token: ${TOKEN:0:50}..."
else
  echo "  ❌ Failed to receive token"
  echo "  Response: $SIGNIN_RESPONSE"
  exit 1
fi
echo ""

# Test 5: Token structure validation
echo "✓ Test 5: Token structure validation"
DECODED_PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null || echo "{}")
if echo "$DECODED_PAYLOAD" | jq -e '.AC == "minibob_record"' > /dev/null 2>&1; then
  echo "  ✅ Token has correct ACCESS method"
  echo "  ✅ Namespace: $(echo "$DECODED_PAYLOAD" | jq -r '.NS')"
  echo "  ✅ Database: $(echo "$DECODED_PAYLOAD" | jq -r '.DB')"
  echo "  ✅ Instance ID: $(echo "$DECODED_PAYLOAD" | jq -r '.ID')"
else
  echo "  ❌ Token structure invalid"
  exit 1
fi
echo ""

# Test 6: Verify access definitions
echo "✓ Test 6: SurrealDB access definitions"
ACCESS_RESPONSE=$(curl -s -X POST ${SURREAL_URL}/sql \
  -H "Surreal-NS: activity-system" \
  -H "Surreal-DB: learning_loop" \
  -H "Content-Type: text/plain" \
  -u "root:surrealdb-local-dev-123" \
  --data "INFO FOR DB;")
  
if echo "$ACCESS_RESPONSE" | jq -e '.[0].result.accesses | has("jwt_external")' > /dev/null; then
  echo "  ✅ JWT access method defined"
else
  echo "  ⚠️  JWT access method not found"
fi

if echo "$ACCESS_RESPONSE" | jq -e '.[0].result.accesses | has("minibob_record")' > /dev/null; then
  echo "  ✅ MiniBob RECORD access method defined"
else
  echo "  ❌ MiniBob RECORD access method not found"
  exit 1
fi
echo ""

# Test 7: Wrong credentials
echo "✓ Test 7: Invalid credentials test"
INVALID_RESPONSE=$(curl -s -X POST ${API_URL}/v2/auth/minibob/signin \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"minibob-local-001","api_key":"wrong-key"}')
  
INVALID_TOKEN=$(echo "$INVALID_RESPONSE" | jq -r '.token.access // .error')
if [ "$INVALID_TOKEN" = "null" ] || echo "$INVALID_TOKEN" | grep -q "error\|invalid\|denied"; then
  echo "  ✅ Invalid credentials rejected properly"
else
  echo "  ❌ Invalid credentials should be rejected"
  echo "  Response: $INVALID_RESPONSE"
  exit 1
fi
echo ""

echo "=== Phase 6 Test Suite: ALL TESTS PASSED ✅ ==="
echo ""
echo "Summary:"
echo "  • SurrealDB schemas applied"
echo "  • Organizations table working"
echo "  • MiniBob instances table working"
echo "  • Authentication endpoint functional"
echo "  • JWT tokens generated correctly"
echo "  • Access definitions configured"
echo "  • Invalid credentials rejected"
echo ""
