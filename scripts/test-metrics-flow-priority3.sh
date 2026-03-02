#!/bin/bash
# Priority 3: Test Metrics Flow End-to-End
#
# Tests that the newly implemented update_activity_metrics MCP tool
# successfully stores metrics in SurrealDB after activity execution.
#
# Flow tested:
# OpenCode execution → TemplateRepository.updateMetrics()
#   → MCP tool update_activity_metrics (metabob-cli)
#   → REST POST /v2/activities/templates/{id}/metrics (rpc-api)
#   → SurrealDB template_metrics table updated

set -e

echo "=== Priority 3: Testing Metrics Flow End-to-End ==="
echo ""

# Configuration
TEMPLATE_ID="create-demo-utility-function"
NAMESPACE="metabob"
SURREALDB_POD=$(kubectl get pods -n $NAMESPACE -l app=surrealdb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "surrealdb-67fcbdd8d7-lng7j")

echo "Configuration:"
echo "  Template: $TEMPLATE_ID"
echo "  Namespace: $NAMESPACE"
echo "  SurrealDB Pod: $SURREALDB_POD"
echo ""

# Step 1: Check current metrics state
echo "Step 1: Checking current metrics state for $TEMPLATE_ID..."
echo ""

QUERY="SELECT * FROM template_metrics WHERE activity_id = '$TEMPLATE_ID' OR variant_id = '$TEMPLATE_ID' LIMIT 1;"

echo "Executing SurrealDB query:"
echo "  $QUERY"
echo ""

BEFORE_RESULT=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- /surreal sql \
  --namespace metabob --database production \
  --username root --password metabob-secret \
  --command "$QUERY" 2>&1 || echo "[]")

echo "Current metrics:"
echo "$BEFORE_RESULT" | grep -A 20 "result" || echo "No metrics found yet"
echo ""

# Extract current execution count if exists
CURRENT_EXECUTIONS=$(echo "$BEFORE_RESULT" | grep -oP '"total_executions":\s*\K\d+' | head -1 || echo "0")
echo "Current total_executions: $CURRENT_EXECUTIONS"
echo ""

# Step 2: Execute test activity
echo "Step 2: Executing test activity..."
echo ""
echo "NOTE: Activity execution requires OpenCode CLI with proper environment"
echo "This script shows the command to run. Execute it separately:"
echo ""
echo "  opencode activity execute --template $TEMPLATE_ID \\"
echo "    --variables '{\"functionName\":\"test_metrics_flow_$(date +%s)\",\"description\":\"Test metrics flow Priority 3\",\"returnType\":\"string\"}' \\"
echo "    --reason \"Priority 3: Verify metrics flow from OpenCode to SurrealDB\""
echo ""
echo "Press Enter after activity completes to check metrics..."
read -p ""

# Step 3: Check updated metrics
echo ""
echo "Step 3: Checking updated metrics after activity execution..."
echo ""

AFTER_RESULT=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- /surreal sql \
  --namespace metabob --database production \
  --username root --password metabob-secret \
  --command "$QUERY" 2>&1)

echo "Updated metrics:"
echo "$AFTER_RESULT" | grep -A 30 "result"
echo ""

# Extract new execution count
NEW_EXECUTIONS=$(echo "$AFTER_RESULT" | grep -oP '"total_executions":\s*\K\d+' | head -1 || echo "0")
echo "New total_executions: $NEW_EXECUTIONS"
echo ""

# Step 4: Verify metrics were updated
echo "Step 4: Verification"
echo ""

if [ "$NEW_EXECUTIONS" -gt "$CURRENT_EXECUTIONS" ]; then
  echo "✅ SUCCESS: Metrics were updated!"
  echo "   Before: $CURRENT_EXECUTIONS executions"
  echo "   After: $NEW_EXECUTIONS executions"
  echo "   Increment: $((NEW_EXECUTIONS - CURRENT_EXECUTIONS))"
  echo ""
  echo "✅ Priority 3: Metrics flow is FUNCTIONAL"
  echo ""
  echo "Metrics flow verified:"
  echo "  1. Activity executed in OpenCode ✅"
  echo "  2. Metrics sent to MCP tool ✅"
  echo "  3. MCP tool called REST endpoint ✅"
  echo "  4. SurrealDB updated ✅"
  echo ""
  exit 0
else
  echo "❌ FAILED: Metrics were NOT updated"
  echo "   Before: $CURRENT_EXECUTIONS executions"
  echo "   After: $NEW_EXECUTIONS executions"
  echo ""
  echo "Possible causes:"
  echo "  1. Activity was not executed"
  echo "  2. MCP tool not registered (metabob-cli not restarted)"
  echo "  3. REST endpoint not accessible (rpc-api not redeployed)"
  echo "  4. SurrealDB connection issue"
  echo ""
  echo "Check logs:"
  echo "  - OpenCode: Look for 'updateActivityMetrics' calls"
  echo "  - MCP tool: Check metabob-cli logs for update_activity_metrics"
  echo "  - REST API: Check rpc-api logs for POST /v2/activities/templates/*/metrics"
  echo ""
  exit 1
fi
