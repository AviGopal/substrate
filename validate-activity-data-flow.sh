#!/bin/bash

ACTIVITY_ID="hello-world-minimal"
TEST_ID="surrealdb-validation-test"

echo "======================================================================"
echo "Activity Data Flow Validation"
echo "======================================================================"
echo ""
echo "Testing: $ACTIVITY_ID execution with testId=$TEST_ID"
echo ""

# Step 1: Check Redis for template (cache)
echo "----------------------------------------------------------------------"
echo "1. Redis Template Cache (Should exist - templates are cached)"
echo "----------------------------------------------------------------------"
REDIS_TEMPLATE=$(docker exec metabob-redis redis-cli KEYS "activity:template:*$ACTIVITY_ID*" | head -1)
if [ -n "$REDIS_TEMPLATE" ]; then
    echo "✅ Template found in Redis cache: $REDIS_TEMPLATE"
    docker exec metabob-redis redis-cli GET "$REDIS_TEMPLATE" | jq -r '.variant_id, .description' 2>/dev/null || docker exec metabob-redis redis-cli GET "$REDIS_TEMPLATE"
else
    echo "❌ Template NOT found in Redis"
fi
echo ""

# Step 2: Check Redis for metrics (cache - should update after execution)
echo "----------------------------------------------------------------------"
echo "2. Redis Metrics Cache (Should update with execution stats)"
echo "----------------------------------------------------------------------"
REDIS_METRICS=$(docker exec metabob-redis redis-cli KEYS "activity:metrics:*$ACTIVITY_ID*" | head -1)
if [ -n "$REDIS_METRICS" ]; then
    echo "✅ Metrics found in Redis cache: $REDIS_METRICS"
    echo ""
    echo "Metrics data:"
    docker exec metabob-redis redis-cli GET "$REDIS_METRICS" | jq '{
      total_selections,
      total_successes,
      total_failures,
      thompson_alpha,
      thompson_beta,
      avg_cost,
      avg_duration_ms,
      last_updated
    }' 2>/dev/null || docker exec metabob-redis redis-cli GET "$REDIS_METRICS"
else
    echo "❌ Metrics NOT found in Redis"
fi
echo ""

# Step 3: Check filesystem for activity artifacts
echo "----------------------------------------------------------------------"
echo "3. Filesystem Activity Artifacts (Local execution data)"
echo "----------------------------------------------------------------------"
ACTIVITY_DIR=$(find /home/avi/.local/share/opencode/activities -name "act_*" -type d -newer /tmp 2>/dev/null | head -1)
if [ -n "$ACTIVITY_DIR" ]; then
    echo "✅ Activity directory found: $ACTIVITY_DIR"
    echo ""
    echo "Directory structure:"
    ls -lah "$ACTIVITY_DIR"
    echo ""
    echo "Activity metadata:"
    cat "$ACTIVITY_DIR/activity.json" 2>/dev/null | jq '{id, template_id, status, started_at, completed_at, metrics}' 2>/dev/null || cat "$ACTIVITY_DIR/activity.json"
else
    echo "❌ Activity directory NOT found"
fi
echo ""

# Step 4: Check SurrealDB for execution record (PRIMARY STORAGE)
echo "----------------------------------------------------------------------"
echo "4. SurrealDB Execution Record (PRIMARY STORAGE - Should persist data)"
echo "----------------------------------------------------------------------"
echo "Querying SurrealDB for activity_execution records..."
echo ""

# Try with proper headers
curl -s -X POST "http://localhost:8000/sql" \
  -u "root:root" \
  -H "Accept: application/json" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  --data "SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 5;" | jq '.' 2>/dev/null

echo ""

# Alternative: Check if we can query tables
echo "Attempting to list tables in SurrealDB..."
curl -s -X POST "http://localhost:8000/sql" \
  -u "root:root" \
  -H "Accept: application/json" \
  --data "INFO FOR ROOT;" | jq '.' 2>/dev/null

echo ""

# Step 5: Check API server for backend data
echo "----------------------------------------------------------------------"
echo "5. Backend API (Should provide access to persisted data)"
echo "----------------------------------------------------------------------"
echo "API Server Health:"
curl -s http://localhost:8080/ | jq '.'
echo ""

echo "Attempting to query learning loop metrics via API..."
curl -s http://localhost:8080/api/v1/learning-loop/metrics 2>/dev/null | head -20

echo ""
echo "======================================================================"
echo "Summary: Data Storage Validation"
echo "======================================================================"
echo ""
echo "Expected Data Flow:"
echo "  1. Template loaded from Redis cache ✓"
echo "  2. Activity executed"
echo "  3. Metrics updated in Redis cache ✓"
echo "  4. Execution record stored in SurrealDB (PRIMARY) ?"
echo "  5. Artifacts saved to filesystem ✓"
echo ""
echo "Critical Question: Is data being persisted to SurrealDB?"
echo "  - Redis should be CACHE only (can be flushed)"
echo "  - SurrealDB should be PRIMARY STORAGE (permanent)"
echo ""
echo "======================================================================"
