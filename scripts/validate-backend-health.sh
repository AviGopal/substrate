#!/bin/bash
# =============================================================================
# Validation Script: Backend Health Check
# =============================================================================
# Purpose: Verify all backend services are running and responsive
# Success Criteria:
#   - Redis responds to PING
#   - SurrealDB health endpoint returns 200
#   - Metabob RPC API health endpoint returns 200 with valid JSON
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
TOTAL=0

test_start() {
    echo -e "${BLUE}[TEST]${NC} $1"
    TOTAL=$((TOTAL + 1))
}

test_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED=$((PASSED + 1))
}

test_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

test_info() {
    echo -e "       $1"
}

echo "======================================================================"
echo "Backend Health Validation"
echo "======================================================================"
echo ""
echo "Timestamp: $(date -Iseconds)"
echo "Host: $(hostname)"
echo ""

# =============================================================================
# Test 1: Redis
# =============================================================================
test_start "Redis connectivity (localhost:6379)"

if command -v redis-cli &> /dev/null; then
    if timeout 5 redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
        RESPONSE=$(redis-cli -h localhost -p 6379 ping 2>&1)
        if [ "$RESPONSE" = "PONG" ]; then
            test_pass "Redis responded with PONG"
            test_info "Response: $RESPONSE"
        else
            test_fail "Redis unexpected response"
            test_info "Expected: PONG, Got: $RESPONSE"
        fi
    else
        test_fail "Redis connection timeout or refused"
        test_info "Command: redis-cli -h localhost -p 6379 ping"
    fi
else
    test_fail "redis-cli not installed"
    test_info "Install: apt-get install redis-tools"
fi

echo ""

# =============================================================================
# Test 2: SurrealDB
# =============================================================================
test_start "SurrealDB health endpoint (localhost:8000/health)"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:8000/health 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    test_pass "SurrealDB health check returned 200"
    RESPONSE=$(curl -s http://localhost:8000/health 2>/dev/null)
    test_info "Response: $RESPONSE"
elif [ "$HTTP_CODE" = "000" ]; then
    test_fail "SurrealDB connection failed"
    test_info "Check if SurrealDB is running: docker ps | grep surreal"
else
    test_fail "SurrealDB health check returned $HTTP_CODE"
    test_info "Expected: 200, Got: $HTTP_CODE"
fi

echo ""

# =============================================================================
# Test 3: Metabob RPC API
# =============================================================================
test_start "Metabob RPC API status endpoint (localhost:8080/)"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost:8080/ 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    RESPONSE=$(curl -s http://localhost:8080/ 2>/dev/null)
    
    # Validate JSON response
    if echo "$RESPONSE" | jq -e . >/dev/null 2>&1; then
        test_pass "Metabob RPC API status check returned valid JSON"
        test_info "Response: $RESPONSE"
        
        # Extract status and version
        STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)
        VERSION=$(echo "$RESPONSE" | jq -r '.version // empty' 2>/dev/null)
        if [ -n "$STATUS" ]; then
            test_info "Status: $STATUS"
        fi
        if [ -n "$VERSION" ]; then
            test_info "Version: $VERSION"
        fi
    else
        test_fail "Metabob RPC API returned invalid JSON"
        test_info "Response: $RESPONSE"
    fi
elif [ "$HTTP_CODE" = "000" ]; then
    test_fail "Metabob RPC API connection failed"
    test_info "Check if API is running: docker ps | grep api-server"
else
    test_fail "Metabob RPC API status check returned $HTTP_CODE"
    test_info "Expected: 200, Got: $HTTP_CODE"
fi

echo ""

# =============================================================================
# Test 4: Backend Service Discovery
# =============================================================================
test_start "Docker backend services running"

# Check for containers by pattern (handles various naming)
REDIS_RUNNING=0
SURREAL_RUNNING=0
API_RUNNING=0

if docker ps --format '{{.Names}}' | grep -q "redis"; then
    test_info "✓ redis container running"
    REDIS_RUNNING=1
else
    test_info "✗ redis container NOT running"
fi

if docker ps --format '{{.Names}}' | grep -q "surreal"; then
    test_info "✓ surreal container running"
    SURREAL_RUNNING=1
else
    test_info "✗ surreal container NOT running"
fi

if docker ps --format '{{.Names}}' | grep -E "(api-server|metabob-rpc-api)"; then
    test_info "✓ API server container running"
    API_RUNNING=1
else
    test_info "✗ API server container NOT running"
fi

RUNNING_COUNT=$((REDIS_RUNNING + SURREAL_RUNNING + API_RUNNING))

if [ $RUNNING_COUNT -eq 3 ]; then
    test_pass "All backend services running (3/3)"
else
    test_fail "Not all backend services running ($RUNNING_COUNT/3)"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "======================================================================"
echo "Validation Summary"
echo "======================================================================"
echo ""
echo "Total Tests: $TOTAL"
echo -e "Passed:      ${GREEN}$PASSED${NC}"
echo -e "Failed:      ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Backend validation PASSED${NC}"
    echo ""
    echo "All backend services are healthy and responsive."
    exit 0
else
    echo -e "${RED}✗ Backend validation FAILED${NC}"
    echo ""
    echo "Fix failed tests before proceeding."
    exit 1
fi
