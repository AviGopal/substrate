#!/bin/bash
#
# Validation Harness: Complete Async Ripple Changes for SurrealDB Official Library
#
# This harness validates that all async conversions were completed correctly:
# 1. All get_surreal_client() calls use await
# 2. All db operation functions are async def
# 3. All route handlers properly await db operations
# 4. No sync/async mixing errors
# 5. All partial updates use merge() instead of update()

set -e

RPC_API_PATH="repos/metabob-rpc-api"
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=6

echo "🔍 Running validation harness: Complete Async Ripple Changes for SurrealDB Official Library"
echo ""

# Test Case 1: Static Analysis - No unawaited get_surreal_client() calls
echo "📋 Test 1: No unawaited get_surreal_client() calls"
cd $RPC_API_PATH
UNAWAITED=$(grep -r "^\s*db\s*=\s*get_surreal_client()" --include="*.py" server/db/operations/ server/routes/ server/cli.py 2>/dev/null | wc -l || echo "0")
cd ../..

if [ "$UNAWAITED" -eq "0" ]; then
  echo "✅ PASS - All get_surreal_client() calls are properly awaited"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ FAIL - Found $UNAWAITED unawaited get_surreal_client() calls"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test Case 2: All operation modules have async def signatures
echo "📋 Test 2: All operation modules have async def signatures"
MODULES=(
  "server/db/operations/failure_pattern.py"
  "server/db/operations/task_execution.py"
  "server/db/operations/activity_content.py"
  "server/db/operations/activity_execution.py"
  "server/db/operations/impulse_data.py"
  "server/db/operations/activity_data.py"
  "server/db/operations/impulse_learning.py"
  "server/db/operations/template_data.py"
)

MODULE_PASS=true
for MODULE in "${MODULES[@]}"; do
  cd $RPC_API_PATH
  ASYNC_COUNT=$(grep -c "^async def " "$MODULE" 2>/dev/null || echo "0")
  cd ../..
  
  if [ "$ASYNC_COUNT" -lt "3" ]; then
    echo "   ⚠️  $MODULE has only $ASYNC_COUNT async def functions"
    MODULE_PASS=false
  else
    echo "   ✓ $MODULE has $ASYNC_COUNT async def functions"
  fi
done

if [ "$MODULE_PASS" = true ]; then
  echo "✅ PASS - All operation modules have async def signatures"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ FAIL - Some modules missing async def signatures"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test Case 3: Route handlers properly await db operations
echo "📋 Test 3: Route handlers properly await db operations"
cd $RPC_API_PATH
AWAIT_PATTERNS=(
  "await get_metrics"
  "await create_metrics"
  "await get_surreal_client"
  "await db\.(merge|query|select)"
  "await insert_task_execution"
)

ROUTE_PASS=true
for PATTERN in "${AWAIT_PATTERNS[@]}"; do
  COUNT=$(grep -E "$PATTERN" server/routes/activity.py 2>/dev/null | wc -l || echo "0")
  if [ "$COUNT" -eq "0" ]; then
    echo "   ⚠️  Pattern '$PATTERN' not found in routes"
    ROUTE_PASS=false
  fi
done
cd ../..

if [ "$ROUTE_PASS" = true ]; then
  echo "✅ PASS - Route handlers properly await db operations"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ FAIL - Missing await keywords in route handlers"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test Case 4: CLI commands use asyncio.run() wrapper
echo "📋 Test 4: CLI commands use asyncio.run() wrapper"
cd $RPC_API_PATH
ASYNCIO_RUN_COUNT=$(grep -c "asyncio\.run(" server/cli.py 2>/dev/null || echo "0")
cd ../..

if [ "$ASYNCIO_RUN_COUNT" -ge "8" ]; then
  echo "✅ PASS - CLI commands use asyncio.run() wrapper ($ASYNCIO_RUN_COUNT calls)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ FAIL - CLI commands missing asyncio.run() wrapper (found $ASYNCIO_RUN_COUNT, expected >= 8)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test Case 5: merge() used instead of update() for partial updates
echo "📋 Test 5: merge() used instead of update() for partial updates"
FILES_TO_CHECK=(
  "server/db/operations/failure_pattern.py"
  "server/db/operations/task_execution.py"
  "server/db/operations/template_data.py"
  "server/routes/activity.py"
)

MERGE_PASS=true
cd $RPC_API_PATH
for FILE in "${FILES_TO_CHECK[@]}"; do
  MERGE_COUNT=$(grep -c "db\.merge(" "$FILE" 2>/dev/null || echo "0")
  
  if [ "$MERGE_COUNT" -gt "0" ]; then
    echo "   ✓ $FILE uses db.merge() ($MERGE_COUNT calls)"
  else
    echo "   ⚠️  $FILE does not use db.merge()"
    MERGE_PASS=false
  fi
done
cd ../..

if [ "$MERGE_PASS" = true ]; then
  echo "✅ PASS - merge() used for partial updates"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ FAIL - Some files not using merge() for partial updates"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Test Case 6: Python compilation check
echo "📋 Test 6: Python compilation check"
FILES_TO_COMPILE=(
  "server/db/operations/failure_pattern.py"
  "server/db/operations/task_execution.py"
  "server/db/operations/activity_content.py"
  "server/db/operations/activity_execution.py"
  "server/db/operations/impulse_data.py"
  "server/db/operations/activity_data.py"
  "server/db/operations/impulse_learning.py"
  "server/db/operations/template_data.py"
  "server/routes/activity.py"
  "server/cli.py"
)

COMPILE_PASS=true
cd $RPC_API_PATH
for FILE in "${FILES_TO_COMPILE[@]}"; do
  if python -m py_compile "$FILE" 2>/dev/null; then
    echo "   ✓ $FILE compiles"
  else
    echo "   ✗ $FILE failed to compile"
    COMPILE_PASS=false
  fi
done
cd ../..

if [ "$COMPILE_PASS" = true ]; then
  echo "✅ PASS - All Python files compile successfully"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "❌ FAIL - Some files failed to compile"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi
echo ""

# Summary
echo "================================================================================"
if [ "$FAIL_COUNT" -eq "0" ]; then
  echo "✅ ALL TESTS PASSED ($PASS_COUNT/$TOTAL_TESTS)"
  echo "================================================================================"
  exit 0
else
  echo "❌ SOME TESTS FAILED ($PASS_COUNT passed, $FAIL_COUNT failed out of $TOTAL_TESTS)"
  echo "================================================================================"
  exit 1
fi
