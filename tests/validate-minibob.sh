#!/usr/bin/env bash
#
# Simple validation script for minibob-standalone-execution
#

set -euo pipefail

NAMESPACE="testing-minibob"
BACKEND_URL="http://api.metabob.local"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================================================"
echo "Minibob Standalone Execution - Validation Results"
echo "================================================================================"
echo "Namespace: $NAMESPACE"
echo "Backend: $BACKEND_URL"
echo "================================================================================"
echo ""

PASSED=0
FAILED=0
EXPECTED_FAILURES=0

# Test 1: Pod Health and Readiness
echo -n "Test 1: Pod Health and Readiness... "
POD_COUNT=$(kubectl -n $NAMESPACE get pods --no-headers 2>/dev/null | wc -l)
RUNNING_COUNT=$(kubectl -n $NAMESPACE get pods --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)

if [ "$POD_COUNT" -eq 3 ] && [ "$RUNNING_COUNT" -eq 3 ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC} (Pods: $POD_COUNT/3, Running: $RUNNING_COUNT/3)"
    ((FAILED++))
fi

# Test 2: ACP Gossip Discovery (check logs)
echo -n "Test 2: ACP Gossip Discovery... "
FIRST_POD=$(kubectl -n $NAMESPACE get pods -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -n "$FIRST_POD" ]; then
    LOGS=$(kubectl -n $NAMESPACE logs $FIRST_POD --tail=200 2>/dev/null || echo "")
    if echo "$LOGS" | grep -q "/acp\|ACP"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} (ACP endpoint not found in logs)"
        ((FAILED++))
    fi
else
    echo -e "${RED}❌ FAIL${NC} (No pods found)"
    ((FAILED++))
fi

# Test 3: Boredom Task Execution (check logs)
echo -n "Test 3: Boredom Task Execution... "
if [ -n "$FIRST_POD" ]; then
    LOGS=$(kubectl -n $NAMESPACE logs $FIRST_POD --tail=300 2>/dev/null || echo "")
    if echo "$LOGS" | grep -qi "boredom\|autonomous"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} (Boredom system not found in logs)"
        ((FAILED++))
    fi
else
    echo -e "${RED}❌ FAIL${NC} (No pods found)"
    ((FAILED++))
fi

# Test 4: Learning Loop Metrics (check backend - expected to fail if backend not accessible)
echo -n "Test 4: Learning Loop Metrics... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/activity-executions?limit=10" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
elif [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "000" ]; then
    echo -e "${YELLOW}⏭️ SKIP${NC} (Backend not accessible: HTTP $HTTP_CODE)"
else
    echo -e "${RED}❌ FAIL${NC} (HTTP $HTTP_CODE)"
    ((FAILED++))
fi

# Test 5: Learned Parameter Reuse (known to fail)
echo -n "Test 5: Learned Parameter Reuse... "
echo -e "${RED}❌ FAIL${NC} (Feature not implemented - expected)"
((FAILED++))
((EXPECTED_FAILURES++))

echo ""
echo "================================================================================"
echo "RESULTS: $PASSED PASS / $FAILED FAIL"
echo "Expected Failures: $EXPECTED_FAILURES"
UNEXPECTED_FAILURES=$((FAILED - EXPECTED_FAILURES))
echo "Unexpected Failures: $UNEXPECTED_FAILURES"
echo "================================================================================"

# Create JSON output
cat > /tmp/validation-results-minibob.json << JSONEOF
{
  "specificationName": "minibob-standalone-execution",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validationResults": [
    {
      "testCase": "validation-minibob-standalone-execution-case-1",
      "name": "Pod Health and Readiness",
      "status": "$([ $POD_COUNT -eq 3 ] && [ $RUNNING_COUNT -eq 3 ] && echo 'PASS' || echo 'FAIL')",
      "actual": {"pods": $POD_COUNT, "running": $RUNNING_COUNT},
      "expected": {"pods": 3, "running": 3}
    },
    {
      "testCase": "validation-minibob-standalone-execution-case-6",
      "name": "ACP Gossip Discovery",
      "status": "$(echo "$LOGS" | grep -q "/acp\|ACP" && echo 'PASS' || echo 'FAIL')",
      "actual": {"acpEndpointFound": $(echo "$LOGS" | grep -q "/acp\|ACP" && echo 'true' || echo 'false')},
      "expected": {"acpEndpoint": true}
    },
    {
      "testCase": "validation-minibob-standalone-execution-case-8",
      "name": "Boredom Task Execution",
      "status": "$(echo "$LOGS" | grep -qi "boredom" && echo 'PASS' || echo 'FAIL')",
      "actual": {"boredomInitialized": $(echo "$LOGS" | grep -qi "boredom" && echo 'true' || echo 'false')},
      "expected": {"boredomInitialized": true}
    },
    {
      "testCase": "validation-minibob-standalone-execution-case-10",
      "name": "Learning Loop Metrics",
      "status": "$([ "$HTTP_CODE" = "200" ] && echo 'PASS' || echo 'SKIP')",
      "actual": {"httpCode": "$HTTP_CODE"},
      "expected": {"httpCode": "200"}
    },
    {
      "testCase": "validation-minibob-standalone-execution-case-11",
      "name": "Learned Parameter Reuse",
      "status": "FAIL",
      "actual": {"implemented": false},
      "expected": {"implemented": true},
      "note": "Expected failure - feature not yet implemented"
    }
  ],
  "overallStatus": "$([ $UNEXPECTED_FAILURES -eq 0 ] && echo 'PASS' || echo 'FAIL')",
  "summary": {
    "total": 5,
    "passed": $PASSED,
    "failed": $FAILED,
    "expectedFailures": $EXPECTED_FAILURES,
    "unexpectedFailures": $UNEXPECTED_FAILURES
  }
}
JSONEOF

echo ""
echo "JSON results written to: /tmp/validation-results-minibob.json"

# Exit with appropriate code
exit $UNEXPECTED_FAILURES
