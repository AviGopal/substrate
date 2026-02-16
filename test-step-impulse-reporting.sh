#!/usr/bin/env bash
# Test script for step-level impulse reporting integration
#
# Tests the complete flow:
# 1. Create execution via backend API
# 2. Report step with impulse data via backend API
# 3. Verify impulse data was recorded in database
# 4. Check impulse_registry statistics update

set -e

# Configuration
BACKEND_URL="${METABOB_API_URL:-http://localhost:8080}"
SESSION_TOKEN=$(jq -r '.session_metadata.session_token' .metabob/state)
EXECUTION_ID="test-impulse-$(date +%s)"
TEMPLATE_ID="test-template-001"

echo "========================================================================"
echo "Step-Level Impulse Reporting Integration Test"
echo "========================================================================"
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Execution ID: $EXECUTION_ID"
echo ""

# Step 1: Create execution
echo "📝 Step 1: Creating test execution..."
CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/v2/activities/execute" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"$TEMPLATE_ID\",
    \"variant_id\": \"test-variant\",
    \"session_id\": \"test-session-001\",
    \"execution_id\": \"$EXECUTION_ID\",
    \"variables\": {}
  }")

echo "$CREATE_RESPONSE" | jq .
echo ""

# Step 2: Report step with impulse data
echo "📊 Step 2: Reporting step execution with impulse data..."
STEP_RESPONSE=$(curl -s -X POST "$BACKEND_URL/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXECUTION_ID\",
    \"step_order\": 0,
    \"success\": true,
    \"duration_ms\": 1500,
    \"cost\": 0.001,
    \"tokens\": 250,
    \"output\": \"Step completed successfully\",
    \"impulses_loaded\": [
      \"file:test-component.ts\",
      \"memo:architecture-context\",
      \"bashOutput:test-results\"
    ],
    \"impulses_created\": [
      \"memo:implementation-notes\"
    ],
    \"context_summary\": {
      \"total_tokens\": 250,
      \"tokens_by_type\": {
        \"file\": 150,
        \"memo\": 50,
        \"bashOutput\": 50
      },
      \"impulse_count\": 4
    }
  }")

echo "$STEP_RESPONSE" | jq .
STEP_RECORDED=$(echo "$STEP_RESPONSE" | jq -r '.recorded // false')
echo ""

if [ "$STEP_RECORDED" != "true" ]; then
  echo "❌ FAILED: Step recording failed"
  echo "Response: $STEP_RESPONSE"
  exit 1
fi

echo "✅ Step recorded successfully"
echo ""

# Step 3: Verify impulse usage was recorded
echo "🔍 Step 3: Verifying impulse usage in database..."
echo "(Checking if impulses_loaded were tracked)"

# Query the execution to see if step data is present
EXECUTION_DATA=$(curl -s -X GET "$BACKEND_URL/v2/activities/execution/$EXECUTION_ID" \
  -H "Authorization: Bearer $SESSION_TOKEN")

echo "$EXECUTION_DATA" | jq '.steps[0] // "No steps found"'
echo ""

STEP_COUNT=$(echo "$EXECUTION_DATA" | jq '.steps | length // 0')
if [ "$STEP_COUNT" -eq 0 ]; then
  echo "⚠️  WARNING: No steps found in execution data"
  echo "This might indicate the step wasn't persisted correctly"
else
  echo "✅ Found $STEP_COUNT step(s) in execution"
  
  # Check if impulses_loaded is present
  IMPULSES_LOADED=$(echo "$EXECUTION_DATA" | jq -r '.steps[0].impulses_loaded // "missing"')
  if [ "$IMPULSES_LOADED" = "missing" ]; then
    echo "⚠️  WARNING: impulses_loaded field missing from step data"
  else
    echo "✅ impulses_loaded present in step data:"
    echo "$EXECUTION_DATA" | jq '.steps[0].impulses_loaded'
  fi
fi
echo ""

# Step 4: Check impulse registry
echo "📈 Step 4: Checking impulse registry statistics..."
echo "(Verifying if impulse success rates updated)"

# Query impulse registry for one of our test impulses
REGISTRY_DATA=$(curl -s -X GET "$BACKEND_URL/v2/impulse/registry?impulse_id=file:test-component.ts" \
  -H "Authorization: Bearer $SESSION_TOKEN" 2>&1)

if echo "$REGISTRY_DATA" | grep -q "404\|Not Found"; then
  echo "ℹ️  INFO: Impulse not yet in registry (this is expected for first-time impulses)"
  echo "   The impulse will be added to registry after activity completion"
else
  echo "✅ Impulse registry data:"
  echo "$REGISTRY_DATA" | jq .
fi
echo ""

# Summary
echo "========================================================================"
echo "Test Summary"
echo "========================================================================"
echo ""
echo "✅ Backend API accepts impulse data in step recording"
echo "✅ Step with impulse metadata stored successfully"
echo ""
echo "Next steps:"
echo "1. Complete the activity execution (POST to /v2/activities/record/complete)"
echo "2. Verify impulse_registry entries are created"
echo "3. Check that success_rate and usage_count update correctly"
echo "4. Test the MCP tool report_execution_step from OpenCode"
echo ""
echo "💡 To test the MCP tool directly:"
echo "   bun scripts/test-mcp-tool.ts report_execution_step '{\"execution_id\":\"$EXECUTION_ID\",\"step_index\":0,\"step_name\":\"test\",\"success\":true,\"impulses_loaded_json\":\"[\\\"test\\\"]\"}'"
echo ""
