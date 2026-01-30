#!/bin/bash

# =============================================================================
# DevBob Backend Verification Script
# =============================================================================
# This script verifies that your DevBob backend infrastructure is correctly
# configured and ready to run all agents against a shared Metabob backend.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMPOSE_FILE="${SCRIPT_DIR}/configs/docker-compose.devbob.yaml"
ENV_FILE="${SCRIPT_DIR}/.env.devbob"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Helper functions
test_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
    ((TESTS_WARNING++))
}

test_info() {
    echo -e "${BLUE}ℹ INFO${NC}: $1"
}

section_header() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Main verification
section_header "DevBob Backend Configuration Verification"

# 1. File Checks
section_header "1. Configuration Files"

if [ -f "$COMPOSE_FILE" ]; then
    test_pass "Docker Compose file exists: $COMPOSE_FILE"
else
    test_fail "Docker Compose file not found: $COMPOSE_FILE"
    exit 1
fi

if [ -f "$ENV_FILE" ]; then
    test_pass "Environment file exists: $ENV_FILE"
else
    test_fail "Environment file not found: $ENV_FILE"
    exit 1
fi

# 2. Docker Installation
section_header "2. Docker Installation"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    test_pass "Docker installed: $DOCKER_VERSION"
else
    test_fail "Docker not installed"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(docker-compose --version)
    test_pass "Docker Compose installed: $DOCKER_COMPOSE_VERSION"
else
    test_fail "Docker Compose not installed"
    exit 1
fi

# 3. Docker Configuration Validation
section_header "3. Docker Configuration Validation"

if docker-compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
    test_pass "Docker Compose configuration is valid"
else
    test_fail "Docker Compose configuration is invalid"
    docker-compose -f "$COMPOSE_FILE" config 2>&1 | head -20
    exit 1
fi

# 4. Network Configuration
section_header "4. Network Configuration"

if docker network ls | grep -q "devbob-network"; then
    test_pass "DevBob network exists"
else
    test_warn "DevBob network not yet created (will be created on first start)"
fi

if docker network ls | grep -q "metabob-network"; then
    test_pass "Metabob network exists"
else
    test_fail "Metabob network doesn't exist - must be created first"
    test_info "Create with: docker network create metabob-network"
fi

# 5. Container Status
section_header "5. Container Status"

test_info "Current container states:"

REDIS_RUNNING=$(docker ps 2>/dev/null | grep -c "metabob-redis" || echo "0")
if [ "$REDIS_RUNNING" -gt 0 ]; then
    STATUS=$(docker inspect metabob-redis --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
    test_pass "Redis container exists (Status: $STATUS)"
else
    test_info "Redis container not yet created (will be created on first start)"
fi

API_RUNNING=$(docker ps 2>/dev/null | grep -c "api-server-dev" || echo "0")
if [ "$API_RUNNING" -gt 0 ]; then
    STATUS=$(docker inspect api-server-dev --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
    test_pass "API Server container exists (Status: $STATUS)"
else
    test_info "API Server container not yet created (will be created on first start)"
fi

# 6. Port Availability
section_header "6. Port Availability"

PORTS=(8080 6379 3001 3002 3003 3004)
for port in "${PORTS[@]}"; do
    if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        test_pass "Port $port is available"
    else
        PROCESS=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null | head -1)
        test_warn "Port $port is in use (PID: $PROCESS - may be previous container)"
    fi
done

# 7. Environment Variables
section_header "7. Environment Variables"

if grep -q "METABOB_API_URL" "$ENV_FILE"; then
    METABOB_API_URL=$(grep "^METABOB_API_URL=" "$ENV_FILE" | cut -d'=' -f2)
    test_pass "METABOB_API_URL configured: $METABOB_API_URL"
else
    test_fail "METABOB_API_URL not configured in $ENV_FILE"
fi

if grep -q "ANTHROPIC_API_KEY" "$ENV_FILE"; then
    ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" "$ENV_FILE" | cut -d'=' -f2 | head -c 20)...
    if [ -n "$ANTHROPIC_KEY" ] && [ "$ANTHROPIC_KEY" != "..." ]; then
        test_pass "ANTHROPIC_API_KEY configured (${ANTHROPIC_KEY})"
    else
        test_warn "ANTHROPIC_API_KEY not set (needed for agents)"
    fi
else
    test_fail "ANTHROPIC_API_KEY not found in $ENV_FILE"
fi

if grep -q "METABOB_PROJECT_ID" "$ENV_FILE"; then
    PROJECT_ID=$(grep "^METABOB_PROJECT_ID=" "$ENV_FILE" | cut -d'=' -f2)
    test_pass "METABOB_PROJECT_ID configured: $PROJECT_ID"
else
    test_fail "METABOB_PROJECT_ID not configured in $ENV_FILE"
fi

# 8. Required Services in Compose
section_header "8. Docker Compose Services"

SERVICES=("redis" "metabob-rpc-api-server" "metabob-rpc-api-worker" "devbob-rpc-api" "devbob-opencode" "devbob-cli" "devbob-dashboard")

for service in "${SERVICES[@]}"; do
    if docker-compose -f "$COMPOSE_FILE" config --services 2>/dev/null | grep -q "^${service}$"; then
        test_pass "Service $service is defined"
    else
        test_fail "Service $service not found in compose file"
    fi
done

# 9. Backend Connectivity (if running)
section_header "9. Backend Connectivity"

if curl -sf http://localhost:8080/status > /dev/null 2>&1; then
    test_pass "Backend API is responding at http://localhost:8080/status"
    
    # Try to get more details
    if RESPONSE=$(curl -sf http://localhost:8080/health 2>/dev/null); then
        test_pass "Backend health endpoint available"
    else
        test_info "Backend /health endpoint not available"
    fi
else
    test_info "Backend API not currently running (expected, will start on demand)"
fi

if docker exec metabob-redis redis-cli ping > /dev/null 2>&1 2>&1; then
    test_pass "Redis is responding"
else
    test_info "Redis not currently running (expected, will start on demand)"
fi

# 10. Architecture Summary
section_header "10. Architecture Summary"

echo ""
echo "Your DevBob setup is configured as:"
echo ""
echo "  SHARED BACKEND MODEL"
echo "  ────────────────────"
echo ""
echo "  • Backend Services:"
echo "    - Redis (Cache/Queue)"
echo "    - FastAPI Server (api-server-dev:80)"
echo "    - Celery Worker"
echo ""
echo "  • All Agents connect to: http://api-server-dev:80"
echo ""
echo "  • DevBob Agents:"
echo "    - devbob-rpc-api (ACP :3001)"
echo "    - devbob-cli (ACP :3003)"
echo "    - devbob-dashboard (ACP :3002)"
echo "    - devbob-opencode (ACP :3004)"
echo ""
echo "  Benefits:"
echo "    ✓ Single backend instance (resource efficient)"
echo "    ✓ Stable analysis context shared across agents"
echo "    ✓ Easy logging and debugging"
echo "    ✓ Centralized metrics collection"
echo ""

# 11. Summary
section_header "11. Verification Summary"

echo ""
echo "Test Results:"
echo "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo "  ${YELLOW}Warnings: $TESTS_WARNING${NC}"
echo "  ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "  1. Create metabob-network if needed:"
    echo "     docker network create metabob-network"
    echo ""
    echo "  2. Start backend services:"
    echo "     docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d redis metabob-rpc-api-server metabob-rpc-api-worker"
    echo ""
    echo "  3. Verify backend is running:"
    echo "     curl http://localhost:8080/status"
    echo ""
    echo "  4. Start one or more agents:"
    echo "     docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d devbob-opencode"
    echo ""
else
    echo -e "${RED}✗ Some checks failed. Please review above.${NC}"
    exit 1
fi

echo ""
echo "For detailed documentation, see:"
echo "  • DEVBOB_BACKEND_CONFIGURATION_GUIDE.md"
echo "  • DEVBOB_QUICK_REFERENCE.md"
echo ""
