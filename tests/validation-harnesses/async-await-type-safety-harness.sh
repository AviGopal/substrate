#!/bin/bash
#
# Validation Harness: async-await-type-safety
#
# This script validates that the async-await-type-safety specification is enforced:
# 1. Pyright type checking catches missing await calls
# 2. Test coverage for learning_loop routes is >= 80%
# 3. CI workflow includes type checking step
# 4. Pre-commit hooks include pyright
#
# Returns: 0 (PASS) or 1 (FAIL)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/../../repos/metabob-rpc-api"
RESULTS_FILE="$SCRIPT_DIR/async-await-type-safety-validation-results.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================================================"
echo "Validation Harness: async-await-type-safety"
echo "========================================================================"
echo ""

# Initialize results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

declare -a RESULTS

# Helper function to record check result
record_check() {
    local name="$1"
    local status="$2"
    local details="$3"
    local expected="$4"
    local actual="$5"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$status" == "PASS" ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        echo -e "${GREEN}✓ PASS${NC}: $name"
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        echo -e "${RED}✗ FAIL${NC}: $name"
        echo "  Details: $details"
        [ -n "$expected" ] && echo "  Expected: $expected"
        [ -n "$actual" ] && echo "  Actual: $actual"
    fi
    
    RESULTS+=("{\"name\":\"$name\",\"status\":\"$status\",\"details\":\"$details\",\"expected\":\"$expected\",\"actual\":\"$actual\"}")
}

cd "$REPO_DIR"

echo "========================================================================"
echo "CHECK 1: Pyright Configuration Exists"
echo "========================================================================"

if [ -f "pyrightconfig.json" ]; then
    # Check that reportUnawaited is set to error
    if grep -q '"reportUnawaited".*"error"' pyrightconfig.json; then
        record_check "pyrightconfig.json exists with reportUnawaited: error" "PASS" "Configuration file found with correct settings" "reportUnawaited: error" "reportUnawaited: error"
    else
        record_check "pyrightconfig.json reportUnawaited setting" "FAIL" "reportUnawaited not set to error" "reportUnawaited: error" "$(grep reportUnawaited pyrightconfig.json || echo 'not found')"
    fi
else
    record_check "pyrightconfig.json exists" "FAIL" "Configuration file not found" "pyrightconfig.json exists" "File not found"
fi

echo ""
echo "========================================================================"
echo "CHECK 2: Pyright Dependency in pyproject.toml"
echo "========================================================================"

if grep -q "pyright" pyproject.toml; then
    PYRIGHT_VERSION=$(grep "pyright" pyproject.toml | head -1)
    record_check "pyright in dev dependencies" "PASS" "pyright found in pyproject.toml" "pyright>=1.1.350" "$PYRIGHT_VERSION"
else
    record_check "pyright in dev dependencies" "FAIL" "pyright not found in pyproject.toml" "pyright>=1.1.350" "Not found"
fi

echo ""
echo "========================================================================"
echo "CHECK 3: Pre-commit Hook Configuration"
echo "========================================================================"

if [ -f ".pre-commit-config.yaml" ]; then
    if grep -q "pyright" .pre-commit-config.yaml; then
        record_check "pyright pre-commit hook exists" "PASS" "pyright hook found in .pre-commit-config.yaml" "pyright hook configured" "pyright hook configured"
    else
        record_check "pyright pre-commit hook exists" "FAIL" "pyright hook not found" "pyright hook configured" "Not found"
    fi
else
    record_check ".pre-commit-config.yaml exists" "FAIL" "Pre-commit config not found" ".pre-commit-config.yaml exists" "File not found"
fi

echo ""
echo "========================================================================"
echo "CHECK 4: CI Workflow Type Checking"
echo "========================================================================"

if [ -f ".github/workflows/run-tests.yaml" ]; then
    if grep -q "pyright" .github/workflows/run-tests.yaml; then
        record_check "CI includes type checking step" "PASS" "pyright step found in run-tests.yaml" "Run Type Checking step exists" "Found"
    else
        record_check "CI includes type checking step" "FAIL" "pyright step not found in run-tests.yaml" "Run Type Checking step exists" "Not found"
    fi
else
    record_check "run-tests.yaml exists" "FAIL" "CI workflow file not found" ".github/workflows/run-tests.yaml exists" "File not found"
fi

echo ""
echo "========================================================================"
echo "CHECK 5: CI Coverage Threshold Enforcement"
echo "========================================================================"

if [ -f ".github/workflows/run-tests.yaml" ]; then
    if grep -q "cov-fail-under" .github/workflows/run-tests.yaml; then
        THRESHOLD=$(grep "cov-fail-under" .github/workflows/run-tests.yaml | head -1)
        record_check "CI enforces coverage threshold" "PASS" "Coverage threshold enforcement found" "--cov-fail-under=80" "$THRESHOLD"
    else
        record_check "CI enforces coverage threshold" "FAIL" "No coverage threshold found" "--cov-fail-under=80" "Not found"
    fi
fi

echo ""
echo "========================================================================"
echo "CHECK 6: Build Workflow Type Checking"
echo "========================================================================"

if [ -f ".github/workflows/build.yaml" ]; then
    if grep -q "type-check" .github/workflows/build.yaml; then
        record_check "Build workflow includes type-check job" "PASS" "type-check job found in build.yaml" "type-check job exists" "Found"
    else
        record_check "Build workflow includes type-check job" "FAIL" "type-check job not found" "type-check job exists" "Not found"
    fi
fi

echo ""
echo "========================================================================"
echo "CHECK 7: Learning Loop Test Suite Exists"
echo "========================================================================"

if [ -f "tests/routes/test_routes_learning_loop.py" ]; then
    TEST_LINES=$(wc -l < tests/routes/test_routes_learning_loop.py)
    if [ "$TEST_LINES" -gt 400 ]; then
        record_check "test_routes_learning_loop.py exists" "PASS" "Test suite found with $TEST_LINES lines" ">400 lines" "$TEST_LINES lines"
    else
        record_check "test_routes_learning_loop.py comprehensive" "FAIL" "Test suite too small" ">400 lines" "$TEST_LINES lines"
    fi
else
    record_check "test_routes_learning_loop.py exists" "FAIL" "Test suite not found" "tests/routes/test_routes_learning_loop.py exists" "File not found"
fi

echo ""
echo "========================================================================"
echo "CHECK 8: Run Pyright Type Checking (if available)"
echo "========================================================================"

if command -v pyright &> /dev/null; then
    echo "Running pyright on server/routes/learning_loop.py..."
    
    # Run pyright and capture output
    if pyright server/routes/learning_loop.py > /tmp/pyright-output.txt 2>&1; then
        ERROR_COUNT=$(grep -c "error" /tmp/pyright-output.txt || echo "0")
        if [ "$ERROR_COUNT" -eq 0 ]; then
            record_check "pyright type checking passes" "PASS" "No type errors found in learning_loop.py" "0 errors" "0 errors"
        else
            record_check "pyright type checking passes" "FAIL" "Type errors found" "0 errors" "$ERROR_COUNT errors"
            echo "  Pyright output:"
            cat /tmp/pyright-output.txt | head -20
        fi
    else
        ERROR_COUNT=$(grep -c "error" /tmp/pyright-output.txt || echo "0")
        record_check "pyright type checking passes" "FAIL" "Pyright execution failed" "0 errors" "$ERROR_COUNT errors"
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC}: pyright not installed (install with: pip install pyright)"
    record_check "pyright type checking" "SKIP" "pyright not installed" "0 errors" "Not installed"
fi

echo ""
echo "========================================================================"
echo "CHECK 9: Run Tests with Coverage (if pytest available)"
echo "========================================================================"

if command -v pytest &> /dev/null; then
    echo "Running pytest on tests/routes/test_routes_learning_loop.py..."
    
    # Set test environment
    export CONFIG_PATH=".env.testing"
    
    # Run tests with coverage
    if pytest tests/routes/test_routes_learning_loop.py --cov=server/routes/learning_loop --cov-report=term-missing > /tmp/pytest-output.txt 2>&1; then
        # Extract coverage percentage
        COVERAGE=$(grep "TOTAL" /tmp/pytest-output.txt | awk '{print $NF}' | sed 's/%//')
        
        if [ -n "$COVERAGE" ]; then
            if (( $(echo "$COVERAGE >= 80" | bc -l) )); then
                record_check "test coverage >= 80%" "PASS" "Coverage: $COVERAGE%" ">=80%" "$COVERAGE%"
            else
                record_check "test coverage >= 80%" "FAIL" "Coverage below threshold" ">=80%" "$COVERAGE%"
            fi
        else
            record_check "test coverage measurement" "FAIL" "Could not extract coverage" "Coverage reported" "Not found"
        fi
        
        echo "  Test output:"
        tail -20 /tmp/pytest-output.txt
    else
        record_check "pytest execution" "FAIL" "Tests failed to run" "Tests pass" "Tests failed"
        echo "  Error output:"
        tail -20 /tmp/pytest-output.txt
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC}: pytest not installed (install with: pip install pytest pytest-cov)"
    record_check "pytest coverage check" "SKIP" "pytest not installed" ">=80%" "Not installed"
fi

echo ""
echo "========================================================================"
echo "VALIDATION SUMMARY"
echo "========================================================================"
echo ""
echo "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo ""

# Calculate success rate
if [ $TOTAL_CHECKS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_CHECKS/$TOTAL_CHECKS)*100}")
    echo "Success Rate: $SUCCESS_RATE%"
fi

# Write JSON results
cat > "$RESULTS_FILE" <<EOF
{
  "specificationName": "async-await-type-safety",
  "validationDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "totalChecks": $TOTAL_CHECKS,
  "passedChecks": $PASSED_CHECKS,
  "failedChecks": $FAILED_CHECKS,
  "successRate": $SUCCESS_RATE,
  "overallStatus": "$([ $FAILED_CHECKS -eq 0 ] && echo "PASS" || echo "FAIL")",
  "checks": [
    $(IFS=,; echo "${RESULTS[*]}")
  ]
}
EOF

echo ""
echo "Results written to: $RESULTS_FILE"
echo ""

# Exit with appropriate code
if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✓ VALIDATION PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    exit 1
fi
