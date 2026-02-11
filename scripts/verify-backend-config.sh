#!/bin/bash
# =============================================================================
# Backend Configuration Verification Script
# =============================================================================
# Verifies that backend configuration is correctly set up for shared access
# between host machine and DevBob containers
#
# Usage:
#   ./scripts/verify-backend-config.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_ID="${PROJECT_ID:-exp-repo-dev}"
EXPECTED_PROJECT_ID="exp-repo-dev"

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}Backend Configuration Verification${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo ""

# Test function
test_check() {
    local test_name=$1
    local result=$2
    local message=$3
    
    if [ "$result" == "pass" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        [ -n "$message" ] && echo "  → $message"
        ((PASSED++))
    elif [ "$result" == "fail" ]; then
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        [ -n "$message" ] && echo "  → $message"
        ((FAILED++))
    else
        echo -e "${YELLOW}⚠ WARN${NC}: $test_name"
        [ -n "$message" ] && echo "  → $message"
        ((WARNINGS++))
    fi
    echo ""
}

# =============================================================================
# Test 1: Backend API Running
# =============================================================================
echo -e "${BLUE}[Test 1] Backend API Status${NC}"

if docker ps | grep -q "api-server-dev"; then
    BACKEND_RESPONSE=$(curl -s http://localhost:8080/ 2>/dev/null || echo "")
    if echo "$BACKEND_RESPONSE" | grep -q "ok"; then
        VERSION=$(echo "$BACKEND_RESPONSE" | jq -r '.version' 2>/dev/null || echo "unknown")
        test_check "Backend API responding" "pass" "Version: $VERSION"
    else
        test_check "Backend API responding" "fail" "Backend returned unexpected response"
    fi
else
    test_check "Backend API running" "fail" "Container api-server-dev not running"
fi

# =============================================================================
# Test 2: Host Configuration
# =============================================================================
echo -e "${BLUE}[Test 2] Host Machine Configuration${NC}"

if [ -f ~/.opencode/opencode.json ]; then
    HOST_PROJECT_ID=$(jq -r '.metabob.project_id // null' ~/.opencode/opencode.json)
    HOST_BASE_URL=$(jq -r '.metabob.base_url // null' ~/.opencode/opencode.json)
    HOST_MCP_ENABLED=$(jq -r '.mcp.metabob.enabled // false' ~/.opencode/opencode.json)
    
    if [ "$HOST_PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]; then
        test_check "Host project_id set correctly" "pass" "project_id: $HOST_PROJECT_ID"
    elif [ "$HOST_PROJECT_ID" == "null" ]; then
        test_check "Host project_id set" "fail" "project_id is not set"
    else
        test_check "Host project_id matches expected" "warn" "Expected: $EXPECTED_PROJECT_ID, Got: $HOST_PROJECT_ID"
    fi
    
    if [ "$HOST_BASE_URL" == "http://localhost:8080" ]; then
        test_check "Host base_url correct" "pass" "base_url: $HOST_BASE_URL"
    else
        test_check "Host base_url correct" "warn" "Expected: http://localhost:8080, Got: $HOST_BASE_URL"
    fi
    
    if [ "$HOST_MCP_ENABLED" == "true" ]; then
        test_check "Host MCP enabled" "pass" "MCP integration enabled"
    else
        test_check "Host MCP enabled" "warn" "MCP integration not enabled"
    fi
else
    test_check "Host OpenCode config exists" "fail" "~/.opencode/opencode.json not found"
fi

# =============================================================================
# Test 3: Container Configuration
# =============================================================================
echo -e "${BLUE}[Test 3] Container Configuration${NC}"

if [ -f configs/opencode.devbob.json ]; then
    CONTAINER_PROJECT_ID=$(jq -r '.metabob.project_id // null' configs/opencode.devbob.json)
    CONTAINER_BASE_URL=$(jq -r '.metabob.base_url // null' configs/opencode.devbob.json)
    CONTAINER_API_KEY=$(jq -r '.metabob.api_key // null' configs/opencode.devbob.json)
    CONTAINER_MCP_ENV_URL=$(jq -r '.mcp.metabob.environment.METABOB_API_URL // null' configs/opencode.devbob.json)
    CONTAINER_MCP_ENV_KEY=$(jq -r '.mcp.metabob.environment.METABOB_API_KEY // null' configs/opencode.devbob.json)
    
    # Check project_id
    if [ "$CONTAINER_PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]; then
        test_check "Container project_id set correctly" "pass" "project_id: $CONTAINER_PROJECT_ID"
    elif [ "$CONTAINER_PROJECT_ID" == "null" ]; then
        test_check "Container project_id set" "fail" "project_id is not set (CRITICAL)"
    else
        test_check "Container project_id matches expected" "warn" "Expected: $EXPECTED_PROJECT_ID, Got: $CONTAINER_PROJECT_ID"
    fi
    
    # Check base_url
    if [ "$CONTAINER_BASE_URL" == "http://host.docker.internal:8080" ]; then
        test_check "Container base_url correct" "pass" "base_url: $CONTAINER_BASE_URL"
    else
        test_check "Container base_url correct" "warn" "Expected: http://host.docker.internal:8080, Got: $CONTAINER_BASE_URL"
    fi
    
    # Check MCP environment
    if [ "$CONTAINER_MCP_ENV_URL" != "null" ]; then
        test_check "Container MCP environment URL set" "pass" "METABOB_API_URL: $CONTAINER_MCP_ENV_URL"
    else
        test_check "Container MCP environment URL set" "fail" "MCP environment METABOB_API_URL not set"
    fi
    
    if [ "$CONTAINER_MCP_ENV_KEY" != "null" ]; then
        test_check "Container MCP environment API key set" "pass" "METABOB_API_KEY is set"
    else
        test_check "Container MCP environment API key set" "warn" "MCP environment METABOB_API_KEY not set"
    fi
else
    test_check "Container OpenCode config exists" "fail" "configs/opencode.devbob.json not found"
fi

# =============================================================================
# Test 4: Project ID Consistency
# =============================================================================
echo -e "${BLUE}[Test 4] Project ID Consistency${NC}"

if [ "$HOST_PROJECT_ID" == "$CONTAINER_PROJECT_ID" ] && [ "$HOST_PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]; then
    test_check "Project ID consistent across configs" "pass" "All configs use: $EXPECTED_PROJECT_ID"
else
    test_check "Project ID consistent" "fail" "Host: $HOST_PROJECT_ID, Container: $CONTAINER_PROJECT_ID, Expected: $EXPECTED_PROJECT_ID"
fi

# Check docker-compose env var
if [ -f docker-compose.yaml ]; then
    COMPOSE_PROJECT_ID=$(grep "METABOB_PROJECT_ID:" docker-compose.yaml | head -1 | sed 's/.*METABOB_PROJECT_ID: *//; s/ *$//' || echo "")
    if [ "$COMPOSE_PROJECT_ID" == "$EXPECTED_PROJECT_ID" ] || [ "$COMPOSE_PROJECT_ID" == "\${METABOB_PROJECT_ID:-$EXPECTED_PROJECT_ID}" ]; then
        test_check "Docker Compose project_id correct" "pass" "METABOB_PROJECT_ID: $COMPOSE_PROJECT_ID"
    else
        test_check "Docker Compose project_id correct" "warn" "Expected: $EXPECTED_PROJECT_ID, Got: $COMPOSE_PROJECT_ID"
    fi
fi

# =============================================================================
# Test 5: Container Connectivity (if running)
# =============================================================================
echo -e "${BLUE}[Test 5] Container Connectivity${NC}"

if docker ps | grep -q "devbob-opencode"; then
    # Test container can reach backend
    CONTAINER_CURL=$(docker exec devbob-opencode curl -s http://host.docker.internal:8080/ 2>/dev/null || echo "")
    if echo "$CONTAINER_CURL" | grep -q "ok"; then
        test_check "Container can reach backend" "pass" "host.docker.internal:8080 accessible"
    else
        test_check "Container can reach backend" "fail" "Cannot curl http://host.docker.internal:8080/"
    fi
    
    # Check metabob-cli version
    CLI_VERSION=$(docker exec devbob-opencode metabob-cli --version 2>/dev/null || echo "")
    if echo "$CLI_VERSION" | grep -q "1.8.0"; then
        test_check "Container metabob-cli installed" "pass" "Version: $CLI_VERSION"
    else
        test_check "Container metabob-cli installed" "fail" "metabob-cli not found or wrong version"
    fi
    
    # Check container env vars
    CONTAINER_ENV_PROJECT=$(docker exec devbob-opencode env | grep "METABOB_PROJECT_ID" | cut -d= -f2 || echo "")
    if [ "$CONTAINER_ENV_PROJECT" == "$EXPECTED_PROJECT_ID" ]; then
        test_check "Container env METABOB_PROJECT_ID" "pass" "METABOB_PROJECT_ID=$CONTAINER_ENV_PROJECT"
    else
        test_check "Container env METABOB_PROJECT_ID" "warn" "Expected: $EXPECTED_PROJECT_ID, Got: $CONTAINER_ENV_PROJECT"
    fi
else
    test_check "DevBob container running" "warn" "devbob-opencode not running - skipping connectivity tests"
fi

# =============================================================================
# Test 6: metabob-cli Host Connectivity
# =============================================================================
echo -e "${BLUE}[Test 6] Host metabob-cli${NC}"

if command -v metabob-cli &> /dev/null; then
    CLI_VERSION=$(metabob-cli --version 2>&1 || echo "error")
    if echo "$CLI_VERSION" | grep -q "1.8.0"; then
        test_check "Host metabob-cli installed" "pass" "Version: $CLI_VERSION"
    else
        test_check "Host metabob-cli version" "warn" "Unexpected version: $CLI_VERSION"
    fi
else
    test_check "Host metabob-cli installed" "warn" "metabob-cli not found in PATH"
fi

# =============================================================================
# Summary
# =============================================================================
echo -e "${CYAN}================================================================================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}================================================================================================${NC}"
echo ""
echo -e "${GREEN}Passed:   $PASSED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failed:   $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Configuration verification FAILED${NC}"
    echo ""
    echo "Critical issues found. Please run the fix script:"
    echo "  bash scripts/fix-backend-config.sh"
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration verification PASSED with warnings${NC}"
    echo ""
    echo "Non-critical issues found. Consider reviewing warnings above."
    echo ""
    exit 0
else
    echo -e "${GREEN}✅ Configuration verification PASSED${NC}"
    echo ""
    echo "All checks passed! Backend configuration is correct."
    echo ""
    exit 0
fi
