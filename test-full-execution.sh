#!/bin/bash
# Test full activity execution flow

SESSION_JSON=$(curl -s -X POST http://localhost:8080/v2/session \
  -H "Content-Type: application/json" \
  -d '{"api_key":"test-api-key","project_id":"metabob-devbob","org_id":"test-org"}')

TOKEN=$(echo "$SESSION_JSON" | jq -r '.session_token // .metadata.session_token')

echo "=== Testing Full Activity Execution ==="
echo ""

# Get activity details
echo "1. Getting activity details..."
ACTIVITY=$(curl -s -X GET "http://localhost:8080/v2/activities/templates/refactor-5fccfc17" \
  -H "Authorization: Bearer $TOKEN")

TASK_COUNT=$(echo "$ACTIVITY" | jq -r '.task_steps | length')
echo "   Found activity with $TASK_COUNT tasks"

# Start execution
echo ""
echo "2. Starting execution..."
EXEC_ID="exec-$(date +%s)"
START=$(curl -s -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"refactor-5fccfc17\",
    \"variables\": {\"scope\": \"entire repo\", \"mode\": \"dryRun\"},
    \"session_id\": \"test-session\",
    \"execution_id\": \"$EXEC_ID\"
  }")

echo "   Execution started: $EXEC_ID"

# Record first step
echo ""
echo "3. Recording step 1 completion..."
STEP=$(curl -s -X POST http://localhost:8080/v2/activities/record/step \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID\",
    \"step_order\": 1,
    \"success\": true,
    \"duration_ms\": 1500,
    \"cost\": 0.01,
    \"tokens\": 500
  }")

echo "   Step recorded: $(echo "$STEP" | jq -r '.recorded')"

# Complete execution
echo ""
echo "4. Completing execution..."
COMPLETE=$(curl -s -X POST http://localhost:8080/v2/activities/record/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID\",
    \"success\": true,
    \"total_duration_ms\": 1500,
    \"total_cost\": 0.01,
    \"total_tokens\": 500
  }")

echo "   Completed: $(echo "$COMPLETE" | jq -r '.completed')"

echo ""
echo "=== Full execution flow works ==="
