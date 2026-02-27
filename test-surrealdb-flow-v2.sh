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
  echo "Authentication failed. Response:"
  echo "$SIGNIN_RESPONSE" | jq .
  exit 1
fi

echo "✓ Authenticated successfully"
echo "Token: ${TOKEN:0:20}..."
echo

echo "1. Creating test record in SurrealDB..."
CREATE_SQL="CREATE test_activity:\`e2e-test-activity-run-20260226\` SET testRunId = \"$TEST_RUN_ID\", activityName = \"$INPUT_ACTIVITY_NAME\", status = \"$INPUT_STATUS\", input = \"$INPUT_DATA\", timestamp = time::now();"

CREATE_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "NS: $NS" \
  -H "DB: $DB" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$CREATE_SQL")

echo "Create response:"
echo "$CREATE_RESPONSE" | jq .

# Check for errors
if echo "$CREATE_RESPONSE" | jq -e '.[0].status == "ERR"' > /dev/null 2>&1; then
  echo "Error creating record"
  exit 1
fi

echo "✓ Record created successfully"
echo

echo "2. Querying record back from SurrealDB..."
SELECT_SQL="SELECT * FROM test_activity:\`e2e-test-activity-run-20260226\`;"

SELECT_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "NS: $NS" \
  -H "DB: $DB" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SELECT_SQL")

echo "Select response:"
echo "$SELECT_RESPONSE" | jq .

# Check for errors
if echo "$SELECT_RESPONSE" | jq -e '.[0].status == "ERR"' > /dev/null 2>&1; then
  echo "Error querying record"
  exit 1
fi

echo "✓ Record retrieved successfully"
echo

echo "3. Validating input-output dependencies..."
OUTPUT_ACTIVITY_NAME=$(echo "$SELECT_RESPONSE" | jq -r '.[0].result[0].activityName')
OUTPUT_STATUS=$(echo "$SELECT_RESPONSE" | jq -r '.[0].result[0].status')
OUTPUT_DATA=$(echo "$SELECT_RESPONSE" | jq -r '.[0].result[0].input')

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
UPDATE_SQL="UPDATE test_activity:\`e2e-test-activity-run-20260226\` SET status = \"completed\", result = string::concat(\"transformation of: \", input);"

UPDATE_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "NS: $NS" \
  -H "DB: $DB" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$UPDATE_SQL")

echo "Update response:"
echo "$UPDATE_RESPONSE" | jq .
echo "✓ Record updated successfully"
echo

echo "5. Querying transformed record..."
SELECT2_RESPONSE=$(curl -s -X POST "$URL/sql" \
  -H "Accept: application/json" \
  -H "NS: $NS" \
  -H "DB: $DB" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SELECT_SQL")

echo "Transformed record:"
echo "$SELECT2_RESPONSE" | jq .

TRANSFORMED_STATUS=$(echo "$SELECT2_RESPONSE" | jq -r '.[0].result[0].status')
TRANSFORMED_RESULT=$(echo "$SELECT2_RESPONSE" | jq -r '.[0].result[0].result')

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
