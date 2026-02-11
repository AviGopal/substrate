#!/bin/bash
# Test Activity Workflow End-to-End

set -e

BASE_URL="http://localhost:3004"
BACKEND_URL="http://localhost:8080"

echo "==================================================================="
echo "Activity Workflow Test"
echo "==================================================================="

# Step 1: Verify backend has activities
echo ""
echo "[1] Verifying backend activities..."
BACKEND_SESSION=$(curl -s -X POST "${BACKEND_URL}/v2/session" \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test-workflow"}' | jq -r '.metadata.session_token')

if [ -z "$BACKEND_SESSION" ] || [ "$BACKEND_SESSION" = "null" ]; then
  echo "✗ Failed to create backend session"
  exit 1
fi

ACTIVITY_COUNT=$(curl -s "${BACKEND_URL}/v2/activities/templates?category=refactor&limit=5" \
  -H "Authorization: Bearer ${BACKEND_SESSION}" | jq '.total')

echo "✓ Backend has ${ACTIVITY_COUNT} activities available"

# Step 2: Create OpenCode session
echo ""
echo "[2] Creating OpenCode session..."
SESSION_ID=$(curl -s -X POST "${BASE_URL}/session" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq -r '.id')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  echo "✗ Failed to create OpenCode session"
  exit 1
fi

echo "✓ Session created: ${SESSION_ID}"

# Step 3: Check if session has access to activities via context
echo ""
echo "[3] Testing activity tool availability..."
TOOL_EXISTS=$(curl -s "${BASE_URL}/experimental/tool/ids" | jq -r '.[] | select(. == "activity")')

if [ -z "$TOOL_EXISTS" ]; then
  echo "✗ Activity tool not available"
  exit 1
fi

echo "✓ Activity tool is available"

# Step 4: Test activity tool execution (dry run with jiggle activity)
echo ""
echo "[4] Testing activity tool execution..."
echo "   Using: refactor-5fccfc17 (Jiggle Documentation)"
echo "   Variables: scope=docs, mode=dryRun"

ACTIVITY_RESULT=$(curl -s -X POST "${BASE_URL}/experimental/tool" \
  -H 'Content-Type: application/json' \
  -d '{
    "toolId": "activity",
    "sessionID": "'"${SESSION_ID}"'",
    "input": {
      "activityId": "refactor-5fccfc17",
      "variables": {
        "scope": "**/*.md",
        "recentDays": "7",
        "mediumDays": "30", 
        "obsoleteDays": "90",
        "mode": "dryRun",
        "archiveInsteadOfDelete": "true"
      },
      "reason": "Test activity execution workflow"
    }
  }' 2>&1)

# Check if result contains error
if echo "$ACTIVITY_RESULT" | jq -e '.name' > /dev/null 2>&1; then
  ERROR_NAME=$(echo "$ACTIVITY_RESULT" | jq -r '.name')
  ERROR_MSG=$(echo "$ACTIVITY_RESULT" | jq -r '.data.message // .data')
  echo "✗ Activity execution failed:"
  echo "   Error: ${ERROR_NAME}"
  echo "   Message: ${ERROR_MSG}"
  
  # Check if it's a "not found" error - might need to search first
  if echo "$ERROR_MSG" | grep -q "not found"; then
    echo ""
    echo "   Activity not found in TemplateRepository."
    echo "   This might mean activities need to be fetched/cached first."
  fi
  exit 1
fi

# Check if execution started
if echo "$ACTIVITY_RESULT" | jq -e '.status' > /dev/null 2>&1; then
  STATUS=$(echo "$ACTIVITY_RESULT" | jq -r '.status')
  echo "✓ Activity execution initiated: ${STATUS}"
  
  # If we got a message ID, the activity is running
  if echo "$ACTIVITY_RESULT" | jq -e '.id' > /dev/null 2>&1; then
    MSG_ID=$(echo "$ACTIVITY_RESULT" | jq -r '.id')
    echo "✓ Activity running as message: ${MSG_ID}"
  fi
else
  echo "⚠ Unexpected response format:"
  echo "$ACTIVITY_RESULT" | jq '.' 2>&1 | head -20
fi

echo ""
echo "==================================================================="
echo "Test Summary"
echo "==================================================================="
echo "✓ Backend API working (${ACTIVITY_COUNT} activities)"
echo "✓ OpenCode session created"
echo "✓ Activity tool available"
echo "✓ Activity execution tested"
echo ""
echo "Next step: Test full agent workflow with message sending"
echo "==================================================================="
