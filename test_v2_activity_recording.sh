#!/bin/bash
# V2 Activity Execution Recording Test

export SESSION_TOKEN="c2Vzc2lvbnM6ZXhwLXJlcG86ZXhwLXJlcG8tZGV2OjQxMmQ2ZjI2LTdmOWYtNDk2Ni05M2E4LTUwMDAyNzRmOTM4Mg=="
export SESSION_ID="exp-repo:exp-repo-dev:412d6f26-7f9f-4966-93a8-5000274f9382"
export EXECUTION_ID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

echo "==========================================================="
echo "Activity Execution Test - V2 Recording API"
echo "==========================================================="
echo ""
echo "Session ID: $SESSION_ID"
echo "Execution ID: $EXECUTION_ID"
echo "Template: feature-7ac86b9b (test-simple-feature)"
echo ""

echo "Step 1: Start Execution Recording"
echo "-----------------------------------------------------------"
curl -s -X POST "http://localhost:8080/v2/activities/record/start" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"feature-7ac86b9b\",
    \"variables\": {\"feature_name\": \"User Profile API\"},
    \"session_id\": \"$SESSION_ID\",
    \"execution_id\": \"$EXECUTION_ID\"
  }" | jq '.'

echo ""
echo "Step 2: Record Task Step 1 (implement-feature)"
echo "-----------------------------------------------------------"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXECUTION_ID\",
    \"step_id\": \"implement-feature\",
    \"status\": \"completed\",
    \"duration_ms\": 5234.5,
    \"tokens\": 1456,
    \"output\": \"Created GET /api/users/:id endpoint with validation\"
  }" | jq '.'

echo ""
echo "Step 3: Record Task Step 2 (test-feature)"
echo "-----------------------------------------------------------"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXECUTION_ID\",
    \"step_id\": \"test-feature\",
    \"status\": \"completed\",
    \"duration_ms\": 3124.2,
    \"tokens\": 892,
    \"output\": \"Created 5 test cases, all passing\"
  }" | jq '.'

echo ""
echo "Step 4: Complete Execution"
echo "-----------------------------------------------------------"
curl -s -X POST "http://localhost:8080/v2/activities/record/complete" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXECUTION_ID\",
    \"success\": true,
    \"duration_ms\": 8358.7,
    \"cost\": 0.047,
    \"tokens\": 2348,
    \"outcome\": \"Successfully implemented and tested User Profile API\"
  }" | jq '.'

echo ""
echo "==========================================================="
echo "Execution Complete!"
echo "Execution ID: $EXECUTION_ID"
echo "==========================================================="
