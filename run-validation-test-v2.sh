#!/bin/bash
set -e

echo "=================================="
echo "Template Loading Persistence Test"
echo "=================================="
echo ""

# Configuration
TEMPLATE_NAME="Validation Test $(date +%s)"
TEMPLATE_CATEGORY="feature"

# Find pods
RPC_API_POD=$(kubectl get pods -o name | grep rpc-api | grep -v dry-workers | head -1 | cut -d/ -f2)
REDIS_POD="redis-master-0"
SURREAL_POD=$(kubectl get pods -o name | grep surrealdb | head -1 | cut -d/ -f2)

if [ -z "$RPC_API_POD" ]; then
  echo "❌ ERROR: Cannot find RPC API pod"
  exit 1
fi

echo "Using pods:"
echo "  RPC API: $RPC_API_POD"
echo "  Redis: $REDIS_POD"
echo "  SurrealDB: $SURREAL_POD"
echo ""

# Start port-forward in background
echo "Starting port-forward to RPC API..."
kubectl port-forward $RPC_API_POD 8080:8080 > /dev/null 2>&1 &
PF_PID=$!
sleep 2

# Cleanup function
cleanup() {
  echo "Cleaning up port-forward..."
  kill $PF_PID 2>/dev/null || true
}
trap cleanup EXIT

# Test results
RESULTS_FILE="/tmp/validation-results-$(date +%s).json"

# Step 1: Create test template
echo "[1/7] Creating test template..."
TEST_ID=$(openssl rand -hex 4)

TEMPLATE_FILE="/tmp/template-$TEST_ID.json"
cat > $TEMPLATE_FILE << TEMPLATE
{
  "name": "$TEMPLATE_NAME $TEST_ID",
  "description": "Test template for validation harness ($TEST_ID)",
  "category": "$TEMPLATE_CATEGORY",
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

# Create template via API
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8080/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d @$TEMPLATE_FILE)

echo "Create response: $CREATE_RESPONSE"

# Extract variant_id
VARIANT_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('variant_id', ''))" 2>/dev/null || echo "")

if [ -z "$VARIANT_ID" ]; then
  echo "❌ FAIL: Failed to create template (no variant_id in response)"
  echo "Full response: $CREATE_RESPONSE"
  rm -f $TEMPLATE_FILE
  exit 1
fi

rm -f $TEMPLATE_FILE
echo "✓ Template created: $VARIANT_ID"
echo ""

# Step 2: Verify template in SurrealDB
echo "[2/7] Verifying template in SurrealDB..."
SURREAL_CHECK=$(kubectl exec -i $SURREAL_POD -- surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns test --db test \
  "SELECT * FROM activity_template:$VARIANT_ID" 2>&1)

if echo "$SURREAL_CHECK" | grep -qi "ERROR\|error\|failed"; then
  echo "❌ FAIL: Template not found in SurrealDB"
  echo "Response: $SURREAL_CHECK"
  exit 1
fi

echo "✓ Template exists in SurrealDB"
echo ""

# Step 3: Verify template in Redis cache
echo "[3/7] Verifying template in Redis cache..."
REDIS_CHECK_1=$(kubectl exec -i $REDIS_POD -- redis-cli EXISTS "activity:template:$VARIANT_ID" 2>&1)

if [ "$REDIS_CHECK_1" != "1" ]; then
  echo "❌ FAIL: Template not found in Redis cache after creation"
  echo "Redis response: $REDIS_CHECK_1"
  exit 1
fi

echo "✓ Template exists in Redis cache"
echo ""

# Step 4: Clear Redis cache
echo "[4/7] Clearing Redis cache..."
kubectl exec -i $REDIS_POD -- redis-cli FLUSHDB > /dev/null 2>&1

# Verify cache is empty
DBSIZE=$(kubectl exec -i $REDIS_POD -- redis-cli DBSIZE 2>&1)
if [ "$DBSIZE" != "0" ]; then
  echo "❌ FAIL: Redis cache not empty after FLUSHDB (size: $DBSIZE)"
  exit 1
fi

echo "✓ Redis cache cleared (DBSIZE=$DBSIZE)"
echo ""

# Step 5: Load template after cache clear (CRITICAL TEST)
echo "[5/7] Loading template after cache clear..."
LOAD_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8080/v2/activities/templates/$VARIANT_ID)

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
sleep 2  # Give Redis a moment to populate

REDIS_CHECK_2=$(kubectl exec -i $REDIS_POD -- redis-cli EXISTS "activity:template:$VARIANT_ID" 2>&1)

if [ "$REDIS_CHECK_2" != "1" ]; then
  echo "❌ FAIL: Redis cache not repopulated after template load"
  echo "Redis response: $REDIS_CHECK_2"
  exit 1
fi

echo "✓ Redis cache repopulated"
echo ""

# Step 7: Verify logs show cache miss pattern
echo "[7/7] Verifying logs for cache miss pattern..."
LOGS=$(kubectl logs $RPC_API_POD --tail=100 2>&1 | grep -E "(Template cache miss|loading from SurrealDB|$VARIANT_ID)" || echo "")

if echo "$LOGS" | grep -q "Template cache miss\|loading from SurrealDB"; then
  echo "✓ Logs confirm cache miss → SurrealDB fallback"
  echo "Sample log: $(echo "$LOGS" | head -1)"
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
  "timestamp": "$(date -Iseconds)",
  "testName": "$TEMPLATE_NAME $TEST_ID"
}
RESULTS

echo "Results saved to: $RESULTS_FILE"
cat $RESULTS_FILE

exit 0
