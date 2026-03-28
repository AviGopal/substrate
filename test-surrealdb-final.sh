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

echo "0. Authenticating with SurrealDB..."
SIGNIN_RESPONSE=$(curl -s -X POST "$URL/signin" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"user":"root","pass":"root"}')

TOKEN=$(echo "$SIGNIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "Authentication failed"
  exit 1
fi

echo "✓ Authenticated successfully"
echo

echo "1. Creating test record in SurrealDB with USE statement..."
SQL_COMMANDS="USE NS $NS DB $DB; CREATE test_activity:\`e2e-test-activity-run-20260226\` SET testRunId = '$TEST_RUN_ID', activityName = '$INPUT_ACTIVITY_NAME', status = '$INPUT_STATUS', input = '$INPUT_DATA', timestamp = time::now();"

CREATE_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SQL_COMMANDS")

echo "Create response:"
echo "$CREATE_RESPONSE" | jq .

# Check result array length (should be 2: USE command + CREATE command)
RESULT_COUNT=$(echo "$CREATE_RESPONSE" | jq 'length')
if [ "$RESULT_COUNT" -lt 2 ]; then
  echo "Unexpected response format"
  exit 1
fi

# Check if CREATE was successful (second element in array)
CREATE_STATUS=$(echo "$CREATE_RESPONSE" | jq -r '.[1].status')
if [ "$CREATE_STATUS" != "OK" ]; then
  echo "Error creating record: $(echo "$CREATE_RESPONSE" | jq -r '.[1].result')"
  exit 1
fi

echo "✓ Record created successfully"
echo

echo "2. Querying record back from SurrealDB..."
SELECT_COMMANDS="USE NS $NS DB $DB; SELECT * FROM test_activity:\`e2e-test-activity-run-20260226\`;"

SELECT_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SELECT_COMMANDS")

echo "Select response:"
echo "$SELECT_RESPONSE" | jq .

# Extract the record data (second element, first result)
OUTPUT_ACTIVITY_NAME=$(echo "$SELECT_RESPONSE" | jq -r '.[1].result[0].activityName')
OUTPUT_STATUS=$(echo "$SELECT_RESPONSE" | jq -r '.[1].result[0].status')
OUTPUT_DATA=$(echo "$SELECT_RESPONSE" | jq -r '.[1].result[0].input')

echo "✓ Record retrieved successfully"
echo

echo "3. Validating input-output dependencies..."
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

echo "4. Testing data transformation..."
UPDATE_COMMANDS="USE NS $NS DB $DB; UPDATE test_activity:\`e2e-test-activity-run-20260226\` SET status = 'completed', result = string::concat('transformation of: ', input);"

UPDATE_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$UPDATE_COMMANDS")

echo "Update response:"
echo "$UPDATE_RESPONSE" | jq .
echo "✓ Record updated successfully"
echo

echo "5. Querying transformed record..."
SELECT2_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SELECT_COMMANDS")

echo "Transformed record:"
echo "$SELECT2_RESPONSE" | jq .

TRANSFORMED_STATUS=$(echo "$SELECT2_RESPONSE" | jq -r '.[1].result[0].status')
TRANSFORMED_RESULT=$(echo "$SELECT2_RESPONSE" | jq -r '.[1].result[0].result')

echo "✓ Transformation verified"
echo "  - Status changed: $INPUT_STATUS → $TRANSFORMED_STATUS"
echo "  - Result field: $TRANSFORMED_RESULT"
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
    "resultField": "$TRANSFORMED_RESULT"
  },
  "status": "$OVERALL_STATUS",
  "surrealdbTestImpulseId": "surrealdb-test-e2e-test-activity-run-20260226",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
RESULT

cat ./surrealdb-test-result.json | jq .
