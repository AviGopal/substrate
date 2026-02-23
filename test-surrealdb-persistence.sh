#!/bin/bash

echo "======================================================================"
echo "SurrealDB Persistence Test - After Schema Initialization"
echo "======================================================================"
echo ""

VARIANT_ID="hello-world-minimal-31727b21"
TIMESTAMP=$(date +%s)
TEST_EXECUTION_ID="exec_test_${TIMESTAMP}"

echo "Test Data:"
echo "  - Variant ID: $VARIANT_ID"
echo "  - Execution ID: $TEST_EXECUTION_ID"
echo "  - Timestamp: $TIMESTAMP"
echo ""

echo "----------------------------------------------------------------------"
echo "Step 1: POST execution data to API"
echo "----------------------------------------------------------------------"

TEST_DATA=$(cat <<JSONEOF
{
  "variant_id": "${VARIANT_ID}",
  "success": true,
  "cost": 0.25,
  "duration_ms": 15000,
  "tokens": {
    "input": 6000,
    "output": 150,
    "cache": 300
  }
}
JSONEOF
)

echo "Payload:"
echo "$TEST_DATA"
echo ""

echo "POSTing to API..."
API_RESPONSE=$(curl -s -X POST http://localhost:8080/v2/activities/executions \
  -H 'Content-Type: application/json' \
  -d "$TEST_DATA")

echo "API Response:"
echo "$API_RESPONSE" | jq '.'
echo ""

echo "----------------------------------------------------------------------"
echo "Step 2: Check SurrealDB for execution record"
echo "----------------------------------------------------------------------"

sleep 1  # Give backend time to write

echo "Querying activity_execution table..."
curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Accept: application/json" \
  --data "USE NS metabob; USE DB metabob; SELECT * FROM activity_execution WHERE variant_id = '${VARIANT_ID}' ORDER BY created_at DESC LIMIT 1;" | jq '.[2].result'

echo ""

echo "----------------------------------------------------------------------"
echo "Step 3: Check SurrealDB for metrics"
echo "----------------------------------------------------------------------"

echo "Querying template_metrics table..."
curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Accept: application/json" \
  --data "USE NS metabob; USE DB metabob; SELECT * FROM template_metrics WHERE variant_id = '${VARIANT_ID}';" | jq '.[2].result'

echo ""

echo "----------------------------------------------------------------------"
echo "Step 4: Check Redis (should also be updated)"
echo "----------------------------------------------------------------------"

echo "Redis metrics:"
docker exec metabob-redis redis-cli GET "activity:metrics:${VARIANT_ID}" | jq '.'

echo ""
echo "======================================================================"
echo "Test Complete"
echo "======================================================================"
echo ""
echo "Expected Results:"
echo "  ✅ API returns updated Thompson Sampling parameters"
echo "  ❓ SurrealDB has execution record (if dual-write implemented)"
echo "  ❓ SurrealDB has template metrics (if dual-write implemented)"
echo "  ✅ Redis has updated metrics (working)"
echo ""
echo "Next: Check if dual-write is already implemented or needs to be added"
echo "======================================================================"
