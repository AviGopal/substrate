#!/bin/bash
# Test script to demonstrate validation and failure handling

SESSION_TOKEN="c2Vzc2lvbnM6ZXhwLXJlcG86ZXhwLXJlcG8tZGV2OjQxMmQ2ZjI2LTdmOWYtNDk2Ni05M2E4LTUwMDAyNzRmOTM4Mg=="
SESSION_ID="exp-repo:exp-repo-dev:412d6f26-7f9f-4b0a-a85c-d047849eb398"

echo "==========================================================="
echo "VALIDATION AND FAILURE HANDLING TEST"
echo "==========================================================="
echo ""

# ===================================================================
# TEST 1: Successful Execution with Passing Validation
# ===================================================================

EXEC_ID_SUCCESS=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

echo "TEST 1: Successful Execution (All Validations Pass)"
echo "-----------------------------------------------------------"
echo "Execution ID: $EXEC_ID_SUCCESS"
echo ""

# Start execution
echo "▶ Starting execution..."
curl -s -X POST "http://localhost:8080/v2/activities/record/start" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"feature-0b169911\",
    \"variables\": {\"feature_name\": \"UserAuth\", \"should_fail\": false},
    \"session_id\": \"$SESSION_ID\",
    \"execution_id\": \"$EXEC_ID_SUCCESS\"
  }" | jq -c '{started_at, recorded}'

# Step 1: Success with validation passing
echo ""
echo "▶ Step 1: create-files (SUCCESS + validation passed)"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_SUCCESS\",
    \"step_order\": 1,
    \"success\": true,
    \"duration_ms\": 3250.5,
    \"cost\": 0.018,
    \"tokens\": 1123,
    \"output\": \"✓ Created required files:\\n  - src/UserAuth.ts\\n  - tests/UserAuth.test.ts\\n  - README.md\\n\\n✓ Validation passed:\\n  - All required files exist\\n  - Feature name present in all files\\n  - No forbidden patterns (TODO/FIXME) found\"
  }" | jq -c '{step_order, success, recorded}'

# Step 2: Success
echo ""
echo "▶ Step 2: run-tests (SUCCESS)"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_SUCCESS\",
    \"step_order\": 2,
    \"success\": true,
    \"duration_ms\": 2100.3,
    \"cost\": 0.012,
    \"tokens\": 745,
    \"output\": \"✓ Tests executed:\\n  5 tests, 5 passed, 0 failed\\n\\n✓ Validation passed:\\n  - npm test exited with code 0\"
  }" | jq -c '{step_order, success, recorded}'

# Step 3: Success
echo ""
echo "▶ Step 3: typecheck (SUCCESS)"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_SUCCESS\",
    \"step_order\": 3,
    \"success\": true,
    \"duration_ms\": 1800.2,
    \"cost\": 0.008,
    \"tokens\": 512,
    \"output\": \"✓ TypeScript check passed:\\n  - No type errors\\n\\n✓ Validation passed:\\n  - tsc exited with code 0\"
  }" | jq -c '{step_order, success, recorded}'

# Complete success
echo ""
echo "▶ Completing execution (SUCCESS)..."
curl -s -X POST "http://localhost:8080/v2/activities/record/complete" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_SUCCESS\",
    \"success\": true,
    \"duration_ms\": 7151.0,
    \"cost\": 0.038,
    \"tokens\": 2380,
    \"outcome\": \"✓ All tasks completed successfully with validation passing\"
  }" | jq -c '{success, completed_at, recorded}'

echo ""
echo "✅ TEST 1 COMPLETE: All validations passed, execution successful"
echo ""
echo ""

# ===================================================================
# TEST 2: Execution with Validation Failures
# ===================================================================

EXEC_ID_FAIL=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

echo "TEST 2: Failed Execution (Validation Failures)"
echo "-----------------------------------------------------------"
echo "Execution ID: $EXEC_ID_FAIL"
echo ""

# Start execution
echo "▶ Starting execution..."
curl -s -X POST "http://localhost:8080/v2/activities/record/start" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"feature-0b169911\",
    \"variables\": {\"feature_name\": \"BrokenFeature\", \"should_fail\": true},
    \"session_id\": \"$SESSION_ID\",
    \"execution_id\": \"$EXEC_ID_FAIL\"
  }" | jq -c '{started_at, recorded}'

# Step 1: Failure - missing required files
echo ""
echo "▶ Step 1: create-files (FAILURE - validation failed, attempt 1)"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_FAIL\",
    \"step_order\": 1,
    \"success\": false,
    \"duration_ms\": 2800.5,
    \"cost\": 0.015,
    \"tokens\": 980,
    \"output\": \"✗ Validation FAILED:\\n  - Missing required file: tests/BrokenFeature.test.ts\\n  - Found forbidden pattern: TODO in src/BrokenFeature.ts\\n  - Command failed: ls tests/*.test.ts (exit code: 2)\\n\\n⚠ Retry attempt 1/2: Applying fallback prompt\"
  }" | jq -c '{step_order, success, recorded}'

# Step 1: Retry - still fails
echo ""
echo "▶ Step 1: create-files (FAILURE - validation failed, attempt 2)"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_FAIL\",
    \"step_order\": 2,
    \"success\": false,
    \"duration_ms\": 3100.8,
    \"cost\": 0.017,
    \"tokens\": 1050,
    \"output\": \"✗ Validation FAILED (retry 2/2):\\n  - Still missing required file: tests/BrokenFeature.test.ts\\n  - Command failed: ls tests/*.test.ts (exit code: 2)\\n\\n❌ Max retries exceeded, task failed\"
  }" | jq -c '{step_order, success, recorded}'

# Complete with failure
echo ""
echo "▶ Completing execution (FAILURE)..."
curl -s -X POST "http://localhost:8080/v2/activities/record/complete" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_FAIL\",
    \"success\": false,
    \"duration_ms\": 5901.3,
    \"cost\": 0.032,
    \"tokens\": 2030,
    \"outcome\": \"❌ Execution failed: Task 'create-files' validation failed after 2 attempts. Missing required files and forbidden patterns found.\"
  }" | jq -c '{success, completed_at, recorded}'

echo ""
echo "❌ TEST 2 COMPLETE: Validation failures properly recorded"
echo ""
echo ""

# ===================================================================
# TEST 3: Partial Failure (Some Tasks Succeed, Others Fail)
# ===================================================================

EXEC_ID_PARTIAL=$(python3 -c "import uuid; print(str(uuid.uuid4()))")

echo "TEST 3: Partial Failure (Task 1 succeeds, Task 2 fails)"
echo "-----------------------------------------------------------"
echo "Execution ID: $EXEC_ID_PARTIAL"
echo ""

# Start execution
echo "▶ Starting execution..."
curl -s -X POST "http://localhost:8080/v2/activities/record/start" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"feature-0b169911\",
    \"variables\": {\"feature_name\": \"PartialSuccess\", \"should_fail\": true},
    \"session_id\": \"$SESSION_ID\",
    \"execution_id\": \"$EXEC_ID_PARTIAL\"
  }" | jq -c '{started_at, recorded}'

# Step 1: Success
echo ""
echo "▶ Step 1: create-files (SUCCESS)"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_PARTIAL\",
    \"step_order\": 1,
    \"success\": true,
    \"duration_ms\": 3500.0,
    \"cost\": 0.019,
    \"tokens\": 1200,
    \"output\": \"✓ Files created successfully\\n✓ All validations passed\"
  }" | jq -c '{step_order, success, recorded}'

# Step 2: Failure - test fails
echo ""
echo "▶ Step 2: run-tests (FAILURE - tests failed)"
curl -s -X POST "http://localhost:8080/v2/activities/record/step" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_PARTIAL\",
    \"step_order\": 2,
    \"success\": false,
    \"duration_ms\": 2200.5,
    \"cost\": 0.013,
    \"tokens\": 820,
    \"output\": \"✗ Tests FAILED:\\n  5 tests, 3 passed, 2 failed\\n\\n  FAIL tests/PartialSuccess.test.ts\\n    ● PartialSuccess › should handle edge case\\n      Expected: 'success'\\n      Received: 'error'\\n\\n✗ Validation FAILED:\\n  - npm test exited with code 1 (expected 0)\"
  }" | jq -c '{step_order, success, recorded}'

# Complete with partial failure
echo ""
echo "▶ Completing execution (FAILURE)..."
curl -s -X POST "http://localhost:8080/v2/activities/record/complete" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID_PARTIAL\",
    \"success\": false,
    \"duration_ms\": 5700.5,
    \"cost\": 0.032,
    \"tokens\": 2020,
    \"outcome\": \"⚠ Partial failure: Task 'create-files' succeeded, but 'run-tests' failed. 2 tests failing.\"
  }" | jq -c '{success, completed_at, recorded}'

echo ""
echo "⚠ TEST 3 COMPLETE: Partial failure properly recorded"
echo ""
echo ""

# ===================================================================
# Summary
# ===================================================================

echo "==========================================================="
echo "SUMMARY: VALIDATION AND FAILURE TESTING"
echo "==========================================================="
echo ""
echo "✅ Test 1: $EXEC_ID_SUCCESS"
echo "   Status: SUCCESS - All validations passed"
echo ""
echo "❌ Test 2: $EXEC_ID_FAIL"
echo "   Status: FAILURE - Validation failed, retries exhausted"
echo ""
echo "⚠  Test 3: $EXEC_ID_PARTIAL"
echo "   Status: PARTIAL - Some tasks succeeded, others failed"
echo ""
echo "==========================================================="
echo ""
echo "Verifying in database..."
docker exec -i metabob-surreal /surreal sql --endpoint http://localhost:8000 --username root --password root --namespace metabob --database devbob <<EOF
SELECT execution_id, success, completed_at 
FROM activity_executions 
WHERE execution_id IN ['$EXEC_ID_SUCCESS', '$EXEC_ID_FAIL', '$EXEC_ID_PARTIAL']
ORDER BY completed_at;
EOF

echo ""
echo "✅ All failure scenarios tested and recorded"
