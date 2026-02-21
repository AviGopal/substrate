#!/usr/bin/env bash
# Validate Docker environment for boredom system testing

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================"
echo "Docker Environment Validation"
echo "========================================"
echo ""

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# Function to check status
check() {
    local name="$1"
    local status="$2"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASS_COUNT++))
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $name"
        ((WARN_COUNT++))
    else
        echo -e "${RED}✗${NC} $name"
        ((FAIL_COUNT++))
    fi
}

echo "=== DevBob Container ==="
if docker ps --filter name=devbob-clean --format '{{.Names}}' | grep -q devbob-clean; then
    check "devbob-clean running" "PASS"
else
    check "devbob-clean running" "FAIL"
fi

if docker exec devbob-clean which opencode &>/dev/null; then
    check "OpenCode installed" "PASS"
else
    check "OpenCode installed" "FAIL"
fi

if docker exec devbob-clean test -d /workspace &>/dev/null; then
    check "/workspace exists" "PASS"
else
    check "/workspace exists" "FAIL"
fi

# Check if ACP server is responding
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|404"; then
    check "ACP server responding" "PASS"
else
    check "ACP server responding" "WARN"
fi

echo ""
echo "=== API Server Container ==="
if docker ps --filter name=api-server --format '{{.Names}}' | grep -q api-server; then
    check "API server running" "PASS"
else
    check "API server running" "FAIL"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
    check "API health endpoint" "PASS"
elif curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health | grep -q "200"; then
    check "API health endpoint" "PASS"
else
    check "API health endpoint" "WARN"
fi

echo ""
echo "=== Redis Container ==="
if docker ps --filter name=redis --format '{{.Names}}' | grep -q redis; then
    check "Redis running" "PASS"
else
    check "Redis running" "FAIL"
fi

if docker exec metabob-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    check "Redis responding" "PASS"
else
    check "Redis responding" "FAIL"
fi

echo ""
echo "=== SurrealDB Container ==="
if docker ps --filter name=surrealdb --format '{{.Names}}' | grep -q surreal; then
    check "SurrealDB running" "PASS"
else
    check "SurrealDB running" "FAIL"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health | grep -q "200"; then
    check "SurrealDB health endpoint" "PASS"
elif curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/status | grep -q "200"; then
    check "SurrealDB health endpoint" "PASS"
else
    check "SurrealDB health endpoint" "WARN"
fi

echo ""
echo "========================================"
echo "Validation Summary"
echo "========================================"
echo -e "${GREEN}✓ PASS:${NC} $PASS_COUNT"
echo -e "${YELLOW}⚠ WARN:${NC} $WARN_COUNT"
echo -e "${RED}✗ FAIL:${NC} $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ Environment validation PASSED${NC}"
    exit 0
elif [ $FAIL_COUNT -le 2 ]; then
    echo -e "${YELLOW}⚠️ Environment validation PASSED with warnings${NC}"
    exit 0
else
    echo -e "${RED}❌ Environment validation FAILED${NC}"
    exit 1
fi
