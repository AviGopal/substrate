#!/bin/bash
# Pass 4 Validation Test: Dynamic Activity Creation with Trailblazing
# Tests the deployment and code changes in devbob pod

set -e

echo "🧪 Pass 4 Validation Tests Starting..."
echo ""
echo "Testing: Dynamic Activity Creation with Trailblazing"
echo "Pod: devbob-84466fdfff-dd87l"
echo "Context: docker-desktop"
echo "Namespace: metabob"
echo ""

POD_NAME="devbob-84466fdfff-dd87l"
CTX="docker-desktop"

PASSED=0
FAILED=0
TOTAL=0

# Helper function to run test
run_test() {
  local test_name="$1"
  local expected="$2"
  local command="$3"
  
  ((TOTAL++))
  echo "=== Test $TOTAL: $test_name ==="
  echo "Expected: $expected"
  
  set +e
  result=$(eval "$command" 2>&1)
  exit_code=$?
  set -e
  
  echo "Result: $result"
  
  if [ $exit_code -eq 0 ] && [ -n "$result" ]; then
    echo "✅ PASS"
    ((PASSED++))
  else
    echo "❌ FAIL (exit code: $exit_code)"
    ((FAILED++))
  fi
  echo ""
}

# Test 1: Check deployed image version
run_test \
  "Image Version" \
  "metabobapp/devbob:v1.0.66-cumulative" \
  "kubectl --context $CTX get deployment devbob -n metabob -o jsonpath='{.spec.template.spec.containers[0].image}' | grep 'v1.0.66-cumulative'"

# Test 2: Check template registration in logs
run_test \
  "Template Registration Logs" \
  "Bootstrap templates registered" \
  "kubectl --context $CTX logs -n metabob $POD_NAME 2>/dev/null | grep 'bootstrap registration complete'"

# Test 3: Check lifecycle hooks registration
run_test \
  "Lifecycle Hooks" \
  "memory-management, activity-recommendation-injection, metabob-context-preparation hooks registered" \
  "kubectl --context $CTX logs -n metabob $POD_NAME 2>/dev/null | grep -E '(memory-management|activity-recommendation-injection|metabob-context-preparation).*hook registered'"

# Test 4: Check searchSimilarActivities stub in compiled code
run_test \
  "searchSimilarActivities Stub" \
  "Stub implementation present" \
  "kubectl --context $CTX exec -n metabob $POD_NAME -- grep -l 'searchSimilarActivities' /opt/opencode/dist/server/template-service-client.js"

# Test 5: Check trailblazing logging code
run_test \
  "Trailblazing Logging Code" \
  "Trailblazing auto-enable logging present" \
  "kubectl --context $CTX exec -n metabob $POD_NAME -- grep -l 'trailblazing' /opt/opencode/dist/session/trailblazing-executor.js"

# Test 6: Check MCP timeout configuration
run_test \
  "MCP Timeout Configuration" \
  "MCP registration timeout set to 30000ms" \
  "kubectl --context $CTX exec -n metabob $POD_NAME -- grep '30000' /opt/opencode/dist/session/template-library.js"

# Test 7: Check templates in local storage
run_test \
  "Templates in Local Storage" \
  "Templates stored locally" \
  "kubectl --context $CTX exec -n metabob $POD_NAME -- ls /workspace/.local/share/opencode/storage/activity-template/ 2>/dev/null | grep -E '(create-activity|debug-activity|evolve-activity)'"

# Test 8: Pod is running
run_test \
  "Pod Status" \
  "Pod is running" \
  "kubectl --context $CTX get pod $POD_NAME -n metabob -o jsonpath='{.status.phase}' | grep 'Running'"

echo "================================================================================"
echo "📊 TEST RESULTS SUMMARY"
echo "================================================================================"
echo ""
echo "Total: $TOTAL tests"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
  echo "❌ Validation FAILED"
  echo ""
  exit 1
else
  echo "✅ Validation PASSED"
  echo ""
  echo "All Pass 4 code changes are deployed and verified in the devbob pod:"
  echo "  - searchSimilarActivities stub implemented ✓"
  echo "  - Trailblazing auto-enable logging present ✓"
  echo "  - MCP timeout increased to 30s ✓"
  echo "  - Lifecycle hooks registered ✓"
  echo "  - Templates registered locally ✓"
  echo "  - Image v1.0.66-cumulative deployed ✓"
  echo ""
  exit 0
fi
