#!/bin/bash

echo "========================================"
echo "Activity Execution Test - Context Requirements"
echo "========================================"

# Check backend
echo "[1/3] Backend status..."
curl -s http://localhost:8080/status || echo "Backend not responding"

# Check session token
echo -e "\n[2/3] Session token..."
if [ -f .metabob/state ]; then
  TOKEN=$(cat .metabob/state | jq -r '.session_metadata.session_token')
  echo "Token: ${TOKEN:0:20}..."
else
  echo "No session file found"
  exit 1
fi

# List templates with context requirements
echo -e "\n[3/3] Templates with context_requirements..."
curl -s http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.templates[] | select(.context_requirements != null) | {id, name, context_req: (.context_requirements | length)}'

echo ""
echo "========================================" 
echo "READY FOR EXECUTION"
echo "========================================"
echo ""
echo "To execute an activity with context requirements tracing:"
echo ""
echo "  1. Use the 'activity' tool from within this OpenCode session"
echo "  2. Pick template: refactor-72eb4607 (3 context requirements)"
echo "  3. Provide variables for the refactor task"
echo "  4. Monitor logs for CONTEXT_REQUIREMENTS_EXTRACTED and IMPULSE_CREATED events"
echo ""
echo "Example:"
echo "  activity({"
echo "    activityId: 'refactor-72eb4607',"
echo "    variables: {"
echo "      target_file: 'sample.ts',"
echo "      refactor_goal: 'Improve readability'"
echo "    },"
echo "    reason: 'Test context requirements flow'"
echo "  })"
echo ""
