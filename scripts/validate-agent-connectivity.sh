#!/bin/bash
# =============================================================================
# Validation Script: Agent Connectivity
# =============================================================================
# Purpose: Verify devbob agent containers can reach backend and expose ACP
# Success Criteria:
#   - Agent container is running
#   - Agent ACP port is accessible
#   - Agent can reach backend API (host.docker.internal:8080)
#   - Agent config file is correctly mounted
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

# Agent to test (default: devbob-opencode)
AGENT_NAME="${1:-devbob-opencode}"
ACP_PORT="${2:-3004}"

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
echo "Agent Connectivity Validation"
echo "======================================================================"
echo ""
echo "Agent: $AGENT_NAME"
echo "ACP Port: $ACP_PORT"
echo "Timestamp: $(date -Iseconds)"
echo ""

# =============================================================================
# Test 1: Container Running
# =============================================================================
test_start "Agent container is running"

if docker ps --format '{{.Names}}' | grep -q "^${AGENT_NAME}$"; then
    test_pass "Container $AGENT_NAME is running"
    
    # Get container details
    CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$AGENT_NAME" 2>/dev/null)
    CONTAINER_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$AGENT_NAME" 2>/dev/null || echo "none")
    
    test_info "Status: $CONTAINER_STATUS"
    if [ "$CONTAINER_HEALTH" != "none" ]; then
        test_info "Health: $CONTAINER_HEALTH"
    fi
else
    test_fail "Container $AGENT_NAME is NOT running"
    test_info "Start with: docker compose --profile $AGENT_NAME up -d"
    
    echo ""
    echo "======================================================================"
    echo "Validation ABORTED - Container not running"
    echo "======================================================================"
    exit 1
fi

echo ""

# =============================================================================
# Test 2: ACP Port Accessible
# =============================================================================
test_start "ACP port accessible (localhost:$ACP_PORT)"

# Try to connect to ACP port
if timeout 5 bash -c "echo > /dev/tcp/localhost/$ACP_PORT" 2>/dev/null; then
    test_pass "ACP port $ACP_PORT is accessible"
    
    # Try to get config if available
    if command -v curl &> /dev/null; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://localhost:$ACP_PORT/config" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            test_info "ACP /config endpoint returned 200"
            CONFIG=$(curl -s "http://localhost:$ACP_PORT/config" 2>/dev/null)
            if echo "$CONFIG" | jq -e . >/dev/null 2>&1; then
                test_info "Config is valid JSON"
            fi
        else
            test_info "ACP /config endpoint returned $HTTP_CODE (may not be implemented)"
        fi
    fi
else
    test_fail "ACP port $ACP_PORT is NOT accessible"
    test_info "Port may not be exposed or agent not listening"
fi

echo ""

# =============================================================================
# Test 3: Config File Mounted
# =============================================================================
test_start "Config file mounted in container"

CONFIG_PATH="/workspace/configs/opencode.devbob.json"

if docker exec "$AGENT_NAME" test -f "$CONFIG_PATH" 2>/dev/null; then
    test_pass "Config file exists: $CONFIG_PATH"
    
    # Verify it's valid JSON
    if docker exec "$AGENT_NAME" cat "$CONFIG_PATH" 2>/dev/null | jq -e . >/dev/null 2>&1; then
        test_pass "Config file is valid JSON"
        
        # Check for expected fields
        BASE_URL=$(docker exec "$AGENT_NAME" cat "$CONFIG_PATH" 2>/dev/null | jq -r '.metabob.base_url // empty')
        if [ -n "$BASE_URL" ]; then
            test_info "Metabob API URL: $BASE_URL"
            
            # Should be host.docker.internal for containers
            if echo "$BASE_URL" | grep -q "host.docker.internal"; then
                test_pass "Config uses host.docker.internal (correct for containers)"
            else
                test_fail "Config should use host.docker.internal, found: $BASE_URL"
            fi
        else
            test_fail "Config missing metabob.base_url"
        fi
    else
        test_fail "Config file is NOT valid JSON"
    fi
else
    test_fail "Config file NOT found: $CONFIG_PATH"
    test_info "Check volume mount: ./configs:/workspace/configs"
fi

echo ""

# =============================================================================
# Test 4: Backend Connectivity from Container
# =============================================================================
test_start "Agent can reach backend API"

# Test from inside container
BACKEND_URL="http://host.docker.internal:8080/health"

if docker exec "$AGENT_NAME" curl -sf --connect-timeout 5 "$BACKEND_URL" >/dev/null 2>&1; then
    test_pass "Agent can reach backend at $BACKEND_URL"
    
    RESPONSE=$(docker exec "$AGENT_NAME" curl -s "$BACKEND_URL" 2>/dev/null)
    test_info "Response: $RESPONSE"
else
    test_fail "Agent CANNOT reach backend at $BACKEND_URL"
    test_info "Check: 1) Backend is running, 2) network_mode: host is set"
fi

echo ""

# =============================================================================
# Test 5: Workspace Mount
# =============================================================================
test_start "Workspace directory mounted"

if docker exec "$AGENT_NAME" test -d "/workspace" 2>/dev/null; then
    test_pass "Workspace directory exists"
    
    # Check for expected subdirectories
    EXPECTED_DIRS=("configs" "repos" ".metabob")
    FOUND_DIRS=0
    
    for dir in "${EXPECTED_DIRS[@]}"; do
        if docker exec "$AGENT_NAME" test -d "/workspace/$dir" 2>/dev/null; then
            test_info "✓ /workspace/$dir exists"
            FOUND_DIRS=$((FOUND_DIRS + 1))
        else
            test_info "✗ /workspace/$dir NOT found"
        fi
    done
    
    if [ $FOUND_DIRS -eq ${#EXPECTED_DIRS[@]} ]; then
        test_pass "All expected directories mounted"
    else
        test_fail "Some directories missing ($FOUND_DIRS/${#EXPECTED_DIRS[@]})"
    fi
else
    test_fail "Workspace directory NOT mounted"
    test_info "Check volume: ./:/workspace"
fi

echo ""

# =============================================================================
# Test 6: Shared .metabob Directory
# =============================================================================
test_start "Shared .metabob directory accessible"

if docker exec "$AGENT_NAME" test -d "/workspace/.metabob" 2>/dev/null; then
    test_pass ".metabob directory accessible"
    
    # Check write permissions
    TEST_FILE="/workspace/.metabob/.test-$$"
    if docker exec "$AGENT_NAME" touch "$TEST_FILE" 2>/dev/null; then
        test_pass ".metabob directory is writable"
        docker exec "$AGENT_NAME" rm -f "$TEST_FILE" 2>/dev/null
    else
        test_fail ".metabob directory is NOT writable"
        test_info "Component tracking will fail without write access"
    fi
else
    test_fail ".metabob directory NOT accessible"
    test_info "Check volume: ./.metabob:/workspace/.metabob"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "======================================================================"
echo "Validation Summary"
echo "======================================================================"
echo ""
echo "Agent: $AGENT_NAME"
echo "Total Tests: $TOTAL"
echo -e "Passed:      ${GREEN}$PASSED${NC}"
echo -e "Failed:      ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Agent connectivity validation PASSED${NC}"
    echo ""
    echo "Agent is properly configured and can communicate with backend."
    exit 0
else
    echo -e "${RED}✗ Agent connectivity validation FAILED${NC}"
    echo ""
    echo "Fix failed tests before using this agent."
    exit 1
fi
