#!/bin/bash
# Run all validation test cases for activity-template-mcp-only-flow

set -e

echo "🧪 Running All Validation Test Cases: activity-template-mcp-only-flow"
echo "====================================================================="

# Test Case 1: Basic Activity Execution
echo -e "\n📋 Test Case 1: Basic Activity Execution"
ACTIVITY_ID="trace-data-flow-single-feature"
VARIABLES='{"featureName": "user-authentication", "entryPoint": "src/auth/login.ts"}'
bun run tests/validation-harnesses/activity-template-mcp-only-flow-harness.ts "$ACTIVITY_ID" "$VARIABLES"
TEST1_RESULT=$?

# Test Case 2: Bootstrap Template Fallback (requires backend disconnect)
echo -e "\n📋 Test Case 2: Bootstrap Template Fallback"
echo "⚠️  Note: This test requires metabob-rpc-api to be temporarily unavailable"
echo "Skipping for now (manual test required)"
TEST2_RESULT=0

# Test Case 3: Clean Environment Fresh Install
echo -e "\n📋 Test Case 3: Clean Environment Fresh Install"
echo "🧹 Cleaning up .metabob/activities directory..."
docker exec devbob-opencode rm -rf /workspace/.metabob/activities || true
ACTIVITY_ID="evolve-activity-self-contained"
VARIABLES='{"templateId": "test-template", "improvementReason": "Add better error handling"}'
bun run tests/validation-harnesses/activity-template-mcp-only-flow-harness.ts "$ACTIVITY_ID" "$VARIABLES"
TEST3_RESULT=$?

# Verify .metabob/activities still doesn't exist after test
echo -e "\n🔍 Verifying .metabob/activities directory still absent..."
docker exec devbob-opencode test -d /workspace/.metabob/activities && echo "❌ FAIL: Directory created" && TEST3_RESULT=1 || echo "✅ PASS: Directory still absent"

# Summary
echo -e "\n====================================================================="
echo "📊 TEST SUMMARY"
echo "====================================================================="
echo "Test Case 1 (Basic Execution):     $([ $TEST1_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Test Case 2 (Bootstrap Fallback):  ⏭️  SKIPPED (manual test)"
echo "Test Case 3 (Clean Install):       $([ $TEST3_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "====================================================================="

# Exit with failure if any test failed
if [ $TEST1_RESULT -ne 0 ] || [ $TEST3_RESULT -ne 0 ]; then
  echo "❌ OVERALL: FAIL"
  exit 1
else
  echo "✅ OVERALL: PASS"
  exit 0
fi
