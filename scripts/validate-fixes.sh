#!/bin/bash
# Validation script for all 3 high-priority fixes

set -e

echo "🧪 Metabob Integration Fixes Validation"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

function test_passed() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    PASS=$((PASS + 1))
}

function test_failed() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    FAIL=$((FAIL + 1))
}

function test_warning() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "Test Suite: Metabob Integration Fixes"
echo "======================================"
echo ""

# Test 1: Check if API server is running
echo "Test 1: API Server Availability"
if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    test_passed "API server is responding"
else
    test_failed "API server is not responding"
fi
echo ""

# Test 2: Check Redis connectivity
echo "Test 2: Redis Connectivity"
if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
    test_passed "Redis is accessible"
else
    test_failed "Redis is not accessible"
fi
echo ""

# Test 3: Check SurrealDB connectivity
echo "Test 3: SurrealDB Connectivity"
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    test_passed "SurrealDB is accessible"
else
    test_failed "SurrealDB is not accessible"
fi
echo ""

# Test 4: Verify Fix #1 - Dual-write code present
echo "Test 4: Fix #1 - Dual-Write Consistency Code"
if grep -q "COMPENSATING TRANSACTION" repos/metabob-rpc-api/server/actions/activity.py 2>/dev/null; then
    test_passed "Compensating transaction code present"
else
    test_failed "Compensating transaction code NOT found"
fi
echo ""

# Test 5: Verify Fix #2 - Atomic Redis updates
echo "Test 5: Fix #2 - Atomic Redis Updates Code"
if grep -q "WATCH/MULTI/EXEC" repos/metabob-rpc-api/server/actions/activity.py 2>/dev/null; then
    test_passed "Atomic Redis update code present"
else
    test_failed "Atomic Redis update code NOT found"
fi
echo ""

# Test 6: Verify Fix #3 - API validation module
echo "Test 6: Fix #3 - API Response Validation Module"
if [ -f "repos/metabob-cli/src/metabob_cli/mcp/api_validation.py" ]; then
    test_passed "API validation module exists"
else
    test_failed "API validation module NOT found"
fi
echo ""

# Test 7: Check validation functions
echo "Test 7: Fix #3 - Validation Functions"
if grep -q "validate_content_type" repos/metabob-cli/src/metabob_cli/mcp/api_validation.py 2>/dev/null; then
    test_passed "Content-Type validation function present"
else
    test_failed "Content-Type validation function NOT found"
fi
echo ""

# Test 8: Check API client uses validation
echo "Test 8: Fix #3 - API Client Integration"
if grep -q "from .api_validation import" repos/metabob-cli/src/metabob_cli/mcp/api_client.py 2>/dev/null; then
    test_passed "API client imports validation functions"
else
    test_failed "API client does NOT import validation"
fi
echo ""

# Summary
echo ""
echo "======================================"
echo "Validation Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 All validations passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some validations failed${NC}"
    exit 1
fi
