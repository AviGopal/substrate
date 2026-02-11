#!/bin/bash
# Test if the rebuilt OpenCode can execute an activity

# This simulates what would happen when an agent calls:
# activity({ activityId: "refactor-5fccfc17", variables: {...}, reason: "..." })

# We can't easily call OpenCode programmatically, so we'll test the next layer down:
# Can the backend API execute an activity?

# Get session token
SESSION_JSON=$(curl -s -X POST http://localhost:8080/v2/session \
  -H "Content-Type: application/json" \
  -d '{"api_key":"test-api-key","project_id":"metabob-devbob","org_id":"test-org"}')

TOKEN=$(echo "$SESSION_JSON" | jq -r '.session_token // .metadata.session_token')

echo "Session token: ${TOKEN:0:20}..."

# Try to start an activity execution
echo ""
echo "Testing: POST /v2/activities/record/start"

START_RESP=$(curl -s -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "refactor-5fccfc17",
    "variables": {"scope": "entire repo", "mode": "dryRun"},
    "session_id": "test-session-123",
    "execution_id": "test-exec-123"
  }')

echo "$START_RESP" | jq '.'

# Check response
if echo "$START_RESP" | jq -e '.execution_id' > /dev/null 2>&1; then
  echo ""
  echo "SUCCESS - Execution started"
  exit 0
else
  echo ""
  echo "FAILED - Could not start execution"
  echo "$START_RESP"
  exit 1
fi
