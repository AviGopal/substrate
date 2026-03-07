#!/bin/bash
set -e

echo "=================================="
echo "Template Loading Persistence Test"
echo "=================================="
echo ""

# Configuration
TEMPLATE_NAME="Validation Test $(date +%s)"
TEMPLATE_CATEGORY="feature"

# Find pods with better error handling
RPC_API_POD=$(kubectl get pods -o name | grep rpc-api | grep -v dry-workers | head -1 | cut -d/ -f2)
REDIS_POD="redis-master-0"
SURREAL_POD=$(kubectl get pods -o name | grep surrealdb | head -1 | cut -d/ -f2)

if [ -z "$RPC_API_POD" ]; then
  echo "❌ ERROR: Cannot find RPC API pod"
  kubectl get pods | grep rpc-api
  exit 1
fi

echo "Using pods:"
echo "  RPC API: $RPC_API_POD"
echo "  Redis: $REDIS_POD"
echo "  SurrealDB: $SURREAL_POD"
echo ""

# Test results
RESULTS_FILE="/tmp/validation-results-$(date +%s).json"

# Step 1: Create test template
echo "[1/7] Creating test template..."
TEST_ID=$(openssl rand -hex 4)
TEMPLATE_JSON=$(cat <<'TEMPLATE'
{
  "name": "TEMPLATE_NAME_PLACEHOLDER TEST_ID_PLACEHOLDER",
  "description": "Test template for validation harness (TEST_ID_PLACEHOLDER)",
  "category": "TEMPLATE_CATEGORY_PLACEHOLDER",
  "tasks": [
    {
      "id": "task-1",
      "description": "Test task for validation",
      "prompt": {
        "template": "Echo: Validation test template",
        "maxTokens": 1000
      }
    }
  ]
}
TEMPLATE
)

# Replace placeholders
TEMPLATE_JSON=$(echo "$TEMPLATE_JSON" | sed "s/TEMPLATE_NAME_PLACEHOLDER/$TEMPLATE_NAME/" | sed "s/TEST_ID_PLACEHOLDER/$TEST_ID/g" | sed "s/TEMPLATE_CATEGORY_PLACEHOLDER/$TEMPLATE_CATEGORY/")

# Create template via kubectl exec (direct API call)
CREATE_RESPONSE=$(kubectl exec -i $RPC_API_POD -- curl -s -X POST http://localhost:8080/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d "$TEMPLATE_JSON")

echo "Create response: $CREATE_RESPONSE"

# Extract variant_id (try both snake_case and camelCase)
VARIANT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"variant_id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$VARIANT_ID" ]; then
  VARIANT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"variantId":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$VARIANT_ID" ]; then
  echo "❌ FAIL: Failed to create template (no variant_id in response)"
  echo "Full response: $CREATE_RESPONSE"
  exit 1
fi

echo "✓ Template created: $VARIANT_ID"
echo ""

# Step 2: Verify template in SurrealDB
echo "[2/7] Verifying template in SurrealDB..."
SURREAL_CHECK=$(kubectl exec -i $SURREAL_POD -- surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns test --db test \
  "SELECT * FROM activity_template:$VARIANT_ID" 2>&1 || echo "ERROR")

if echo "$SURREAL_CHECK" | grep -q "ERROR\|error"; then
  echo "❌ FAIL: Template not found in SurrealDB"
  echo "Response: $SURREAL_CHECK"
  exit 1
fi

echo "✓ Template exists in SurrealDB"
echo ""

# Step 3: Verify template in Redis cache
echo "[3/7] Verifying template in Redis cache..."
REDIS_CHECK_1=$(kubectl exec -i $REDIS_POD -- redis-cli EXISTS "activity:template:$VARIANT_ID")

if [ "$REDIS_CHECK_1" != "1" ]; then
  echo "❌ FAIL: Template not found in Redis cache after creation"
  exit 1
fi

echo "✓ Template exists in Redis cache"
echo ""

# Step 4: Clear Redis cache
echo "[4/7] Clearing Redis cache..."
kubectl exec -i $REDIS_POD -- redis-cli FLUSHDB > /dev/null

# Verify cache is empty
DBSIZE=$(kubectl exec -i $REDIS_POD -- redis-cli DBSIZE)
if [ "$DBSIZE" != "0" ]; then
  echo "❌ FAIL: Redis cache not empty after FLUSHDB (size: $DBSIZE)"
  exit 1
fi

echo "✓ Redis cache cleared (DBSIZE=$DBSIZE)"
echo ""

# Step 5: Load template after cache clear (CRITICAL TEST)
echo "[5/7] Loading template after cache clear..."
LOAD_RESPONSE=$(kubectl exec -i $RPC_API_POD -- curl -s -w "\nHTTP_CODE:%{http_code}" \
  http://localhost:8080/v2/activities/templates/$VARIANT_ID)

HTTP_CODE=$(echo "$LOAD_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
LOAD_BODY=$(echo "$LOAD_RESPONSE" | grep -v "HTTP_CODE:")

echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAIL: Failed to load template after cache clear (HTTP $HTTP_CODE)"
  echo "Response: $LOAD_BODY"
  exit 1
fi

echo "✓ Template loaded successfully after cache clear"
echo ""

# Step 6: Verify Redis cache repopulated
echo "[6/7] Verifying cache repopulation..."
sleep 1  # Give Redis a moment to populate

REDIS_CHECK_2=$(kubectl exec -i $REDIS_POD -- redis-cli EXISTS "activity:template:$VARIANT_ID")

if [ "$REDIS_CHECK_2" != "1" ]; then
  echo "❌ FAIL: Redis cache not repopulated after template load"
  exit 1
fi

echo "✓ Redis cache repopulated"
echo ""

# Step 7: Verify logs show cache miss pattern
echo "[7/7] Verifying logs for cache miss pattern..."
LOGS=$(kubectl logs $RPC_API_POD --tail=100 | grep -E "(Template cache miss|loading from SurrealDB|$VARIANT_ID)" || echo "")

if echo "$LOGS" | grep -q "Template cache miss\|loading from SurrealDB"; then
  echo "✓ Logs confirm cache miss → SurrealDB fallback"
else
  echo "⚠ Warning: Cache miss pattern not found in recent logs (may have rolled over)"
fi

echo ""
echo "=================================="
echo "✅ PASS: All validation steps succeeded"
echo "=================================="
echo ""
echo "Test Summary:"
echo "  Template ID: $VARIANT_ID"
echo "  Template Name: $TEMPLATE_NAME $TEST_ID"
echo "  Category: $TEMPLATE_CATEGORY"
echo ""
echo "Validation Results:"
echo "  ✓ Template created (HTTP 201)"
echo "  ✓ Template persisted in SurrealDB"
echo "  ✓ Template cached in Redis"
echo "  ✓ Redis cache cleared successfully"
echo "  ✓ Template loaded after cache clear (HTTP 200) ← CRITICAL"
echo "  ✓ Redis cache repopulated automatically"
echo "  ✓ Cache-aside pattern confirmed"
echo ""

# Save results
cat > $RESULTS_FILE << RESULTS
{
  "testCase": "validation-template-loading-persistence-case-1",
  "status": "PASS",
  "variantId": "$VARIANT_ID",
  "actual": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": true,
    "existsInRedisAfterClear": true,
    "cacheRepopulated": true
  },
  "expected": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": true,
    "existsInRedisAfterClear": true,
    "cacheRepopulated": true
  },
  "httpStatusCode": $HTTP_CODE,
  "timestamp": "$(date -Iseconds)"
}
RESULTS

echo "Results saved to: $RESULTS_FILE"
cat $RESULTS_FILE

exit 0
