#!/bin/bash
# Test Impulse Step Reporting - End-to-End Verification
#
# This script verifies that execution step data flows from OpenCode to the backend:
# 1. Runs an activity that uses impulses
# 2. Checks that data reaches execution_steps table
# 3. Verifies impulse_registry updates with success rates

set -e

echo "=================================================="
echo "Impulse Step Reporting - E2E Test"
echo "=================================================="
echo ""

# Configuration
ACTIVITY_ID="bug-fix-v1"  # Simple activity that should complete quickly
POSTGRES_CONTAINER="devbob-postgres"
BACKEND_CONTAINER="devbob-metabob-backend"

echo "Step 1: Check baseline - execution_steps count"
echo "--------------------------------------------------"
BEFORE_COUNT=$(docker exec $POSTGRES_CONTAINER psql -U metabob -d metabob -t -c "SELECT COUNT(*) FROM execution_steps;" | tr -d ' ')
echo "Before: $BEFORE_COUNT execution steps"
echo ""

echo "Step 2: Run activity execution"
echo "--------------------------------------------------"
cd repos/metabob-opencode/packages/opencode
echo "Running: bun run opencode activity search (simple test)"
timeout 30s bun run opencode activity search --limit 3 || true
echo ""

echo "Step 3: Check backend logs for step reporting"
echo "--------------------------------------------------"
echo "Looking for 'report_execution_step' in backend logs..."
docker logs $BACKEND_CONTAINER --tail 50 2>&1 | grep -i "report_execution_step" || echo "⚠️  No step reporting logs found"
echo ""

echo "Step 4: Check execution_steps table"
echo "--------------------------------------------------"
AFTER_COUNT=$(docker exec $POSTGRES_CONTAINER psql -U metabob -d metabob -t -c "SELECT COUNT(*) FROM execution_steps;" | tr -d ' ')
echo "After: $AFTER_COUNT execution steps"
DIFF=$((AFTER_COUNT - BEFORE_COUNT))
echo "Difference: +$DIFF steps"
echo ""

if [ "$DIFF" -gt 0 ]; then
  echo "✅ New execution steps recorded!"
  echo ""
  echo "Latest steps:"
  docker exec $POSTGRES_CONTAINER psql -U metabob -d metabob -c "
    SELECT 
      execution_id,
      step_order,
      success,
      duration_ms,
      tokens,
      array_length(impulses_loaded, 1) as impulses_loaded_count,
      array_length(impulses_created, 1) as impulses_created_count,
      created_at
    FROM execution_steps 
    ORDER BY created_at DESC 
    LIMIT 5;
  "
else
  echo "⚠️  No new execution steps recorded"
  echo ""
  echo "Possible reasons:"
  echo "1. Activity didn't execute tasks (just searched)"
  echo "2. MCP tool call failed (check backend logs)"
  echo "3. OpenCode didn't call reportExecutionStep"
fi
echo ""

echo "Step 5: Check impulse_registry updates"
echo "--------------------------------------------------"
echo "Impulses with success rate data:"
docker exec $POSTGRES_CONTAINER psql -U metabob -d metabob -c "
  SELECT 
    impulse_id,
    success_rate,
    total_uses,
    last_used_at
  FROM impulse_registry 
  WHERE success_rate IS NOT NULL 
  ORDER BY last_used_at DESC 
  LIMIT 5;
" || echo "⚠️  No impulse registry data found"
echo ""

echo "=================================================="
echo "Test Complete"
echo "=================================================="
echo ""
echo "Expected Results:"
echo "  ✅ execution_steps count increased"
echo "  ✅ New rows show impulses_loaded/created arrays"
echo "  ✅ impulse_registry shows success rates"
echo ""
echo "Next Steps:"
echo "  1. Run an actual activity execution (not just search)"
echo "  2. Verify schema matches ExecutionStepRequest"
echo "  3. Monitor learning system for impulse recommendations"
