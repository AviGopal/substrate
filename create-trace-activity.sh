#!/bin/bash
# Create a trace activity using goal-seeking

BACKEND_URL="http://metabob-activity-api.activity-system.svc.cluster.local:8080"

echo "🎯 Creating 'trace-minibob-execution' activity using goal-seeking..."
echo

# Create the trace activity
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/v2/activities/create-goal-seeking" \
  -H "Content-Type: application/json" \
  -d '{
    "goal_description": "Create an activity that traces minibob execution behavior for debugging. The activity should: 1) Log current configuration, 2) Execute a test task, 3) Capture execution metrics (tokens, duration, cost), 4) Verify MCP connection, 5) Check impulse filtering status, 6) Generate a summary report.",
    "template_name": "trace-minibob-execution",
    "category": "infrastructure",
    "variables": {
      "test_message": "Hello from trace test"
    },
    "register_to_backend": true
  }')

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo

# Extract template ID
TEMPLATE_ID=$(echo "$RESPONSE" | jq -r '.template_id' 2>/dev/null)

if [ "$TEMPLATE_ID" != "null" ] && [ -n "$TEMPLATE_ID" ]; then
  echo "✅ Activity created: $TEMPLATE_ID"
  echo
  
  # Query the created template
  echo "📋 Querying template details..."
  curl -s "${BACKEND_URL}/v2/activities/templates/${TEMPLATE_ID}" | jq '.'
  echo
  
  # Query all infrastructure activities
  echo "📊 All infrastructure activities:"
  curl -s "${BACKEND_URL}/v2/activities/templates?category=infrastructure" | jq '.[] | {id, name, success_rate, execution_count}'
else
  echo "❌ Failed to create activity"
  exit 1
fi
