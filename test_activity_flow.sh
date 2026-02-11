#!/bin/bash
set -e

echo "=========================================="
echo "ACTIVITY SYSTEM END-TO-END TEST"
echo "=========================================="
echo ""

# Generate unique test ID
TEST_ID="e2e-test-$(date +%s)"
echo "Test ID: $TEST_ID"
echo ""

# Step 1: Create session
echo "Step 1: Creating session..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "test-project", "organization_id": "test-org"}')

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session_id')
SESSION_TOKEN=$(echo "$SESSION_RESPONSE" | jq -r '.metadata.session_token')

if [ "$SESSION_TOKEN" == "null" ] || [ -z "$SESSION_TOKEN" ]; then
  echo "❌ FAILED: Session token not found in metadata"
  echo "Response: $SESSION_RESPONSE"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"
echo "✅ Token extracted from metadata.session_token"
echo ""

# Step 2: Search for activity templates
echo "Step 2: Searching activity templates..."
SEARCH_RESPONSE=$(curl -s -X GET "http://localhost:8080/v2/activities/templates?query=test&limit=5" \
  -H "Authorization: Bearer $SESSION_TOKEN")

TEMPLATE_COUNT=$(echo "$SEARCH_RESPONSE" | jq -r '.templates | length')
echo "✅ Found $TEMPLATE_COUNT templates"

if [ "$TEMPLATE_COUNT" -gt 0 ]; then
  TEMPLATE_ID=$(echo "$SEARCH_RESPONSE" | jq -r '.templates[0].variant_id')
  TEMPLATE_NAME=$(echo "$SEARCH_RESPONSE" | jq -r '.templates[0].variant_name')
  echo "   Using template: $TEMPLATE_NAME (ID: $TEMPLATE_ID)"
else
  echo "   No templates found, using test-template-v1"
  TEMPLATE_ID="test-template-v1"
fi
echo ""

# Step 3: Record execution start
echo "Step 3: Recording execution start..."
START_RESPONSE=$(curl -s -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"$TEMPLATE_ID\",
    \"variables\": {\"test_var\": \"test_value\"},
    \"session_id\": \"$SESSION_ID\",
    \"execution_id\": \"$TEST_ID\"
  }")

START_EXEC_ID=$(echo "$START_RESPONSE" | jq -r '.execution_id')
START_RECORDED=$(echo "$START_RESPONSE" | jq -r '.recorded')

if [ "$START_RECORDED" != "true" ]; then
  echo "❌ FAILED: Execution start not recorded"
  echo "Response: $START_RESPONSE"
  exit 1
fi

echo "✅ Execution started: $START_EXEC_ID"
echo ""

# Wait a moment
sleep 1

# Step 4: Record execution complete
echo "Step 4: Recording execution complete..."
COMPLETE_RESPONSE=$(curl -s -X POST http://localhost:8080/v2/activities/record/complete \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$TEST_ID\",
    \"success\": true,
    \"duration_ms\": 3500,
    \"cost\": 0.025,
    \"tokens\": 1500,
    \"outcome\": \"Test execution completed successfully\",
    \"step_results\": [{\"step\": \"test_step\", \"success\": true}],
    \"notes\": \"End-to-end test execution\"
  }")

COMPLETE_EXEC_ID=$(echo "$COMPLETE_RESPONSE" | jq -r '.execution_id')
COMPLETE_RECORDED=$(echo "$COMPLETE_RESPONSE" | jq -r '.recorded')

if [ "$COMPLETE_RECORDED" != "true" ]; then
  echo "❌ FAILED: Execution complete not recorded"
  echo "Response: $COMPLETE_RESPONSE"
  exit 1
fi

echo "✅ Execution completed: $COMPLETE_EXEC_ID"
echo ""

# Wait for database to sync
sleep 2

# Step 5: Verify in database
echo "Step 5: Verifying database record..."
python3 << PYTHON
import requests
import json

url = "http://localhost:8000/sql"
auth = ("local", "testing")
headers = {"Accept": "application/json", "Content-Type": "application/sql"}

query = f"""
USE NS metabob DB development;
SELECT execution_id, duration, success, total_cost, outcome 
FROM activity_executions 
WHERE execution_id = '$TEST_ID';
"""

response = requests.post(url, data=query, headers=headers, auth=auth)
result = response.json()

if len(result) > 1 and result[1]['result']:
    record = result[1]['result'][0]
    print(f"✅ Database record found:")
    print(f"   Execution ID: {record['execution_id']}")
    print(f"   Duration: {record['duration']}ms")
    print(f"   Success: {record['success']}")
    print(f"   Cost: \${record['total_cost']}")
    print(f"   Outcome: {record['outcome']}")
    
    # Verify values
    if record['duration'] == 3500 and record['success'] == True and record['total_cost'] == 0.025:
        print("")
        print("✅ ALL VALUES CORRECT!")
    else:
        print("")
        print("⚠️  WARNING: Some values don't match expected")
else:
    print("❌ FAILED: No database record found")
    print(f"Response: {json.dumps(result, indent=2)}")
    exit(1)
PYTHON

echo ""
echo "=========================================="
echo "✅ END-TO-END TEST PASSED"
echo "=========================================="
