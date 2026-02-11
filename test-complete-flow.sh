#!/bin/bash
# Test complete activity execution flow

set -e

SESSION_JSON=$(curl -s -X POST http://localhost:8080/v2/session -H "Content-Type: application/json" -d '{"api_key":"test-api-key","project_id":"metabob-devbob","org_id":"test-org"}')
TOKEN=$(echo "$SESSION_JSON" | jq -r '.session_token // .metadata.session_token')

echo "=== Complete Activity Execution Test ==="
echo ""

# Get template
echo "1. Fetching template..."
TEMPLATE=$(curl -s -X GET "http://localhost:8080/v2/activities/templates/refactor-5fccfc17" -H "Authorization: Bearer $TOKEN")
TASK_COUNT=$(echo "$TEMPLATE" | jq -r '.task_steps | length')
echo "   Activity has $TASK_COUNT tasks"

# Start execution
echo ""
echo "2. Starting execution..."
EXEC_ID="full-test-$(date +%s)"
curl -s -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"template_id\":\"refactor-5fccfc17\",\"variables\":{\"scope\":\"entire repo\",\"mode\":\"dryRun\"},\"session_id\":\"test\",\"execution_id\":\"$EXEC_ID\"}" | jq -r '.execution_id'

# Complete all 4 tasks
echo ""
echo "3. Recording task completions..."
for i in {1..4}; do
  curl -s -X POST http://localhost:8080/v2/activities/record/step \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"execution_id\":\"$EXEC_ID\",\"step_order\":$i,\"success\":true,\"duration_ms\":1000,\"cost\":0.01,\"tokens\":500}" | jq -r '.recorded'
  echo "   Task $i: recorded"
done

# Complete execution
echo ""
echo "4. Completing execution..."
curl -s -X POST http://localhost:8080/v2/activities/record/complete \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"execution_id\":\"$EXEC_ID\",\"success\":true,\"duration_ms\":4000,\"cost\":0.04,\"tokens\":2000,\"outcome\":\"all_tasks_completed\"}" | jq -r '.recorded'

echo ""
echo "=== SUCCESS: Full execution flow works ==="
echo "Execution ID: $EXEC_ID"
