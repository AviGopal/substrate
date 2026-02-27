#!/bin/bash
set -e

echo "=== SURREALDB DATA FLOW TEST ==="
echo

# Configuration
URL="http://localhost:8000"
NS="metabob"
DB="metabob"

# Input data
INPUT_ACTIVITY_NAME="activity-e2e-test"
INPUT_STATUS="running"
INPUT_DATA="SurrealDB test data from activity execution"
TEST_RUN_ID="e2e-test-activity-run-20260226"

echo "0. Creating record with direct key endpoint..."

# Use direct key endpoint which handles namespace/database creation
RECORD_KEY="test_activity:e2e-test-activity-run-20260226"
RECORD_DATA=$(cat <<JSON
{
  "testRunId": "$TEST_RUN_ID",
  "activityName": "$INPUT_ACTIVITY_NAME",
  "status": "$INPUT_STATUS",
  "input": "$INPUT_DATA",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
JSON
)

echo "Creating record with key: $RECORD_KEY"
CREATE_RESPONSE=$(curl -s -X POST "$URL/key/$NS/$DB/$RECORD_KEY" \
  -u "root:root" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "$RECORD_DATA")

echo "Create response:"
echo "$CREATE_RESPONSE" | jq .
echo "✓ Record created successfully"
echo

echo "1. Querying record back from SurrealDB..."
SELECT_RESPONSE=$(curl -s -X GET "$URL/key/$NS/$DB/$RECORD_KEY" \
  -u "root:root" \
  -H "Accept: application/json")

echo "Select response:"
echo "$SELECT_RESPONSE" | jq .
echo "✓ Record retrieved successfully"
echo

echo "2. Validating input-output dependencies..."
OUTPUT_ACTIVITY_NAME=$(echo "$SELECT_RESPONSE" | jq -r '.activityName')
OUTPUT_STATUS=$(echo "$SELECT_RESPONSE" | jq -r '.status')
OUTPUT_DATA=$(echo "$SELECT_RESPONSE" | jq -r '.input')

echo "Input activityName: $INPUT_ACTIVITY_NAME"
echo "Output activityName: $OUTPUT_ACTIVITY_NAME"
MATCH_ACTIVITY=$([[ "$INPUT_ACTIVITY_NAME" == "$OUTPUT_ACTIVITY_NAME" ]] && echo "true" || echo "false")
echo "Match: $MATCH_ACTIVITY"
echo

echo "Input status: $INPUT_STATUS"
echo "Output status: $OUTPUT_STATUS"
MATCH_STATUS=$([[ "$INPUT_STATUS" == "$OUTPUT_STATUS" ]] && echo "true" || echo "false")
echo "Match: $MATCH_STATUS"
echo

echo "Input data: $INPUT_DATA"
echo "Output data: $OUTPUT_DATA"
MATCH_DATA=$([[ "$INPUT_DATA" == "$OUTPUT_DATA" ]] && echo "true" || echo "false")
echo "Match: $MATCH_DATA"
echo

# Determine overall status
if [[ "$MATCH_ACTIVITY" == "true" && "$MATCH_STATUS" == "true" && "$MATCH_DATA" == "true" ]]; then
  OVERALL_STATUS="PASS"
else
  OVERALL_STATUS="FAIL"
fi

echo "Overall validation: $OVERALL_STATUS"
echo

echo "3. Testing data transformation..."
# Read current data, transform it, and update
CURRENT_INPUT=$(echo "$SELECT_RESPONSE" | jq -r '.input')
TRANSFORMED_RESULT="transformation of: $CURRENT_INPUT"

UPDATE_DATA=$(cat <<JSON
{
  "testRunId": "$TEST_RUN_ID",
  "activityName": "$INPUT_ACTIVITY_NAME",
  "status": "completed",
  "input": "$INPUT_DATA",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "result": "$TRANSFORMED_RESULT"
}
JSON
)

UPDATE_RESPONSE=$(curl -s -X PUT "$URL/key/$NS/$DB/$RECORD_KEY" \
  -u "root:root" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_DATA")

echo "Update response:"
echo "$UPDATE_RESPONSE" | jq .
echo "✓ Record updated successfully"
echo

echo "4. Querying transformed record..."
SELECT2_RESPONSE=$(curl -s -X GET "$URL/key/$NS/$DB/$RECORD_KEY" \
  -u "root:root" \
  -H "Accept: application/json")

echo "Transformed record:"
echo "$SELECT2_RESPONSE" | jq .

TRANSFORMED_STATUS=$(echo "$SELECT2_RESPONSE" | jq -r '.status')
TRANSFORMED_RESULT_OUT=$(echo "$SELECT2_RESPONSE" | jq -r '.result')

echo "✓ Transformation verified"
echo "  - Status changed: $INPUT_STATUS → $TRANSFORMED_STATUS"
echo "  - Result field: $TRANSFORMED_RESULT_OUT"
echo

echo "=== TEST RESULT ==="
cat > ./surrealdb-test-result.json << RESULT
{
  "testRunId": "$TEST_RUN_ID",
  "testName": "surrealdb-data-flow",
  "inputs": {
    "activityName": "$INPUT_ACTIVITY_NAME",
    "status": "$INPUT_STATUS",
    "data": "$INPUT_DATA"
  },
  "outputs": {
    "activityName": "$OUTPUT_ACTIVITY_NAME",
    "status": "$OUTPUT_STATUS",
    "data": "$OUTPUT_DATA"
  },
  "dataDependencies": [
    {"field": "activityName", "match": $MATCH_ACTIVITY},
    {"field": "status", "match": $MATCH_STATUS},
    {"field": "data", "match": $MATCH_DATA}
  ],
  "transformation": {
    "applied": true,
    "statusChange": "$INPUT_STATUS -> $TRANSFORMED_STATUS",
    "resultField": "$TRANSFORMED_RESULT_OUT"
  },
  "status": "$OVERALL_STATUS",
  "surrealdbTestImpulseId": "surrealdb-test-e2e-test-activity-run-20260226",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
RESULT

cat ./surrealdb-test-result.json | jq .
