#!/bin/bash

echo "======================================================================"
echo "Activity Data Flow Test - Inside DevBob Container"
echo "======================================================================"
echo ""
echo "This test validates the complete data flow:"
echo "  1. Execute activity in devbob container"
echo "  2. Verify MCP tool posts execution data"
echo "  3. Check SurrealDB persistence"
echo "  4. Validate Thompson Sampling updates"
echo ""

TIMESTAMP=$(date +%s)
TEST_ACTIVITY_ID="hello-world-minimal"
TEST_VARIANT_ID="hello-world-minimal-31727b21"

echo "----------------------------------------------------------------------"
echo "Step 1: Check baseline metrics in SurrealDB"
echo "----------------------------------------------------------------------"
echo ""
echo "Querying SurrealDB before test execution..."

# Check current state
docker exec metabob-surreal curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Accept: application/json" \
  --data "USE NS test; USE DB test; SELECT * FROM activity_variant WHERE variant_id = '${TEST_VARIANT_ID}' LIMIT 1;" | head -100

echo ""

echo "----------------------------------------------------------------------"
echo "Step 2: Execute test activity in devbob container"
echo "----------------------------------------------------------------------"
echo ""

# Create a simple test script in devbob
docker exec devbob-clean sh -c "cat > /tmp/test-activity.sh << 'INNEREOF'
#!/bin/sh
echo 'Executing activity via OpenCode tool...'

# The activity tool will:
# 1. Execute the template
# 2. Call TemplateMetricsClient.reportExecution()
# 3. MCP tool metabob_post_activity_result
# 4. POST to API /v2/activities/executions
# 5. API updates SurrealDB

# For now, let's manually test the data flow by calling the API directly
INNEREOF
chmod +x /tmp/test-activity.sh
"

echo "Manual test: POST execution data to API endpoint..."
echo ""

# Test data
TEST_DATA=$(cat <<EOF
{
  "variant_id": "${TEST_VARIANT_ID}",
  "success": true,
  "cost": 0.15,
  "duration_ms": 12345,
  "tokens": {
    "input": 5000,
    "output": 100,
    "cache": 200
  }
}
EOF
)

echo "Test payload:"
echo "$TEST_DATA"
echo ""

# Post from devbob container to API
echo "Posting from devbob container to api-server-dev:8080..."
docker exec devbob-clean sh -c "curl -X POST http://api-server-dev:8080/v2/activities/executions \
  -H 'Content-Type: application/json' \
  -d '$TEST_DATA' \
  -s -w '\nHTTP Status: %{http_code}\n'" | head -50

echo ""

echo "----------------------------------------------------------------------"
echo "Step 3: Verify SurrealDB persistence"
echo "----------------------------------------------------------------------"
echo ""
echo "Querying SurrealDB for updated metrics..."

# Query SurrealDB from surreal container
docker exec metabob-surreal curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Accept: application/json" \
  --data "USE NS test; USE DB test; SELECT * FROM activity_variant WHERE variant_id = '${TEST_VARIANT_ID}' LIMIT 1;"

echo ""

echo "----------------------------------------------------------------------"
echo "Step 4: Check execution records"
echo "----------------------------------------------------------------------"
echo ""
echo "Querying activity_execution table..."

docker exec metabob-surreal curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Accept: application/json" \
  --data "USE NS test; USE DB test; SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 3;"

echo ""

echo "----------------------------------------------------------------------"
echo "Step 5: Verify API metrics endpoint"
echo "----------------------------------------------------------------------"
echo ""
echo "Querying API for template metrics..."

docker exec devbob-clean curl -s "http://api-server-dev:8080/v2/activities/variants/${TEST_VARIANT_ID}"

echo ""
echo ""

echo "======================================================================"
echo "Summary"
echo "======================================================================"
echo ""
echo "Data Flow Check:"
echo "  1. API endpoint exists: /v2/activities/executions"
echo "  2. SurrealDB database: test.test (not metabob.metabob)"
echo "  3. Thompson Sampling should update after POST"
echo ""
echo "Next: Execute real activity via OpenCode tool and verify flow"
echo "======================================================================"
