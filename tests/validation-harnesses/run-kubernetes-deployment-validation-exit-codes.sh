#!/bin/bash
# Runner script for Kubernetes-Deployment-Validation-Exit-Codes validation harness
# This avoids ESM/CommonJS issues by running the validation directly

set -e

echo "═══════════════════════════════════════════════════════════"
echo "Validation Harness: Kubernetes-Deployment-Validation-Exit-Codes"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Change to repo root
cd "$(dirname "$0")/../.."

# Test cases directory
TEST_CASES_DIR="tests/validation-harnesses/test-cases"
RESULTS_FILE="tests/validation-harnesses/validation-results-kubernetes-deployment-validation-exit-codes.json"

# Load test cases
TEST_CASES_FILE="$TEST_CASES_DIR/kubernetes-deployment-validation-exit-codes-cases.json"

if [ ! -f "$TEST_CASES_FILE" ]; then
  echo "❌ Test cases file not found: $TEST_CASES_FILE"
  exit 1
fi

echo "📋 Loaded test cases from $TEST_CASES_FILE"
echo ""

# Get current deployment state
echo "1️⃣  Checking current deployment state..."
PODS_NOT_READY=$(kubectl get pods -n metabob --no-headers 2>/dev/null | grep -v "Running\|Completed" | wc -l || echo "0")
TOTAL_PODS=$(kubectl get pods -n metabob --no-headers 2>/dev/null | wc -l || echo "0")
SERVICES_WITHOUT_ENDPOINTS=$(kubectl get endpoints -n metabob --no-headers 2>/dev/null | awk '$2 == "<none>"' | wc -l || echo "0")
TOTAL_SERVICES=$(kubectl get endpoints -n metabob --no-headers 2>/dev/null | wc -l || echo "0")

echo "   Total pods: $TOTAL_PODS"
echo "   Pods not ready: $PODS_NOT_READY"
echo "   Total services: $TOTAL_SERVICES"
echo "   Services without endpoints: $SERVICES_WITHOUT_ENDPOINTS"
echo ""

# Show pod details
if [ "$TOTAL_PODS" -gt 0 ]; then
  echo "   Pod details:"
  kubectl get pods -n metabob --no-headers 2>/dev/null | while read line; do
    NAME=$(echo "$line" | awk '{print $1}')
    STATUS=$(echo "$line" | awk '{print $3}')
    echo "     - $NAME: $STATUS"
  done
  echo ""
fi

# Run validation script
echo "2️⃣  Running validation script..."
SCRIPT_PATH="repos/platform/scripts/validate-local-deployment.sh"

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "❌ Script not found: $SCRIPT_PATH"
  exit 1
fi

# Capture output and exit code
OUTPUT_FILE=$(mktemp)
EXIT_CODE_FILE=$(mktemp)

bash "$SCRIPT_PATH" > "$OUTPUT_FILE" 2>&1 || echo $? > "$EXIT_CODE_FILE"
ACTUAL_EXIT_CODE=$(cat "$EXIT_CODE_FILE" 2>/dev/null || echo "0")

echo "   Exit code: $ACTUAL_EXIT_CODE"
echo ""

# Analyze output
echo "3️⃣  Analyzing output..."
CONTAINS_PASS=$(grep -q "✅ VALIDATION PASSED" "$OUTPUT_FILE" && echo "true" || echo "false")
CONTAINS_FAIL=$(grep -q "❌ VALIDATION FAILED" "$OUTPUT_FILE" && echo "true" || echo "false")

echo "   Contains '✅ VALIDATION PASSED': $CONTAINS_PASS"
echo "   Contains '❌ VALIDATION FAILED': $CONTAINS_FAIL"
echo ""

# Determine expected exit code
echo "4️⃣  Expected behavior:"
HAS_FAILURES="false"
if [ "$PODS_NOT_READY" -gt 0 ] || [ "$SERVICES_WITHOUT_ENDPOINTS" -gt 0 ]; then
  HAS_FAILURES="true"
  EXPECTED_EXIT_CODE=1
  EXPECTED_MESSAGE="❌ VALIDATION FAILED"
else
  EXPECTED_EXIT_CODE=0
  EXPECTED_MESSAGE="✅ VALIDATION PASSED"
fi

echo "   Has failures: $HAS_FAILURES"
echo "   Expected exit code: $EXPECTED_EXIT_CODE"
echo "   Expected message: $EXPECTED_MESSAGE"
echo ""

# Validate results
echo "5️⃣  Validating results..."
ERRORS=0

if [ "$ACTUAL_EXIT_CODE" != "$EXPECTED_EXIT_CODE" ]; then
  echo "   ❌ Exit code mismatch: expected $EXPECTED_EXIT_CODE, got $ACTUAL_EXIT_CODE"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ Exit code correct: $ACTUAL_EXIT_CODE"
fi

if [ "$HAS_FAILURES" = "true" ] && [ "$CONTAINS_FAIL" != "true" ]; then
  echo "   ❌ Output should contain '❌ VALIDATION FAILED' when deployment has failures"
  ERRORS=$((ERRORS + 1))
elif [ "$HAS_FAILURES" = "false" ] && [ "$CONTAINS_PASS" != "true" ]; then
  echo "   ❌ Output should contain '✅ VALIDATION PASSED' when deployment is healthy"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ Output message correct"
fi

if [ "$CONTAINS_PASS" = "true" ] && [ "$CONTAINS_FAIL" = "true" ]; then
  echo "   ❌ Output contains both PASS and FAIL messages - this should not happen"
  ERRORS=$((ERRORS + 1))
fi

if [ "$TOTAL_PODS" -lt 1 ]; then
  echo "   ❌ Expected at least 1 pod, found $TOTAL_PODS"
  ERRORS=$((ERRORS + 1))
else
  echo "   ✅ Minimum pod count satisfied: $TOTAL_PODS >= 1"
fi

echo ""

# Final result
if [ $ERRORS -eq 0 ]; then
  echo "📊 Result: ✅ PASS"
  echo "   Validation script correctly returned exit code $ACTUAL_EXIT_CODE for $([ "$HAS_FAILURES" = "true" ] && echo "unhealthy" || echo "healthy") deployment"
  PASS="true"
else
  echo "📊 Result: ❌ FAIL"
  echo "   $ERRORS validation error(s) found"
  PASS="false"
fi

# Write results to JSON
cat > "$RESULTS_FILE" << EOFRESULTS
{
  "testRun": {
    "timestamp": "$(date -Iseconds)",
    "specificationName": "Kubernetes-Deployment-Validation-Exit-Codes",
    "passed": $PASS,
    "errors": $ERRORS
  },
  "actual": {
    "exitCode": $ACTUAL_EXIT_CODE,
    "podsNotReady": $PODS_NOT_READY,
    "totalPods": $TOTAL_PODS,
    "servicesWithoutEndpoints": $SERVICES_WITHOUT_ENDPOINTS,
    "totalServices": $TOTAL_SERVICES,
    "containsPassMessage": $CONTAINS_PASS,
    "containsFailMessage": $CONTAINS_FAIL
  },
  "expected": {
    "exitCode": $EXPECTED_EXIT_CODE,
    "hasFailures": $HAS_FAILURES,
    "expectedMessage": "$EXPECTED_MESSAGE"
  }
}
EOFRESULTS

echo ""
echo "📄 Results written to: $RESULTS_FILE"

# Cleanup
rm -f "$OUTPUT_FILE" "$EXIT_CODE_FILE"

# Exit with appropriate code
if [ "$PASS" = "true" ]; then
  exit 0
else
  exit 1
fi
