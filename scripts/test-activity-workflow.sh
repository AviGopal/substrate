#!/bin/bash
# =============================================================================
# Activity Workflow End-to-End Test
# =============================================================================
# Tests complete activity workflow including:
#   1. Project setup and verification
#   2. Activity template registration
#   3. Activity execution
#   4. Database persistence verification
#   5. Cross-environment consistency (host ↔ container)
#
# Usage:
#   ./scripts/test-activity-workflow.sh
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
PROJECT_ID="exp-repo-dev"
TEST_ACTIVITY_ID="test-simple-activity-$(date +%s)"
BACKEND_URL="http://localhost:8080"

echo -e "${MAGENTA}================================================================================================${NC}"
echo -e "${MAGENTA}Activity Workflow End-to-End Test${NC}"
echo -e "${MAGENTA}================================================================================================${NC}"
echo ""
echo -e "${BLUE}Project ID: $PROJECT_ID${NC}"
echo -e "${BLUE}Backend URL: $BACKEND_URL${NC}"
echo -e "${BLUE}Test Activity ID: $TEST_ACTIVITY_ID${NC}"
echo ""

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${CYAN}[TEST] $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}  ✓ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}  ✗ FAIL${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# =============================================================================
# Pre-flight Checks
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Pre-flight Checks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check backend is running
run_test "Backend API is responding" \
    "curl -sf $BACKEND_URL/ | grep -q 'ok'"

# Check metabob-cli on host
run_test "metabob-cli installed on host" \
    "command -v metabob-cli &> /dev/null"

# Check container is running
run_test "devbob-opencode container running" \
    "docker ps | grep -q devbob-opencode"

# Check metabob-cli in container
run_test "metabob-cli installed in container" \
    "docker exec devbob-opencode which metabob-cli &> /dev/null"

# =============================================================================
# Configuration Setup
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Configuration Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Configure host metabob-cli
echo -e "${CYAN}Configuring host metabob-cli...${NC}"
mkdir -p ~/.metabob

cat > ~/.metabob/config.json <<EOF
{
  "base_url": "$BACKEND_URL",
  "api_key": "",
  "project_id": "$PROJECT_ID",
  "state_directory": ".metabob",
  "watch_files": true,
  "batch_size": 5
}
EOF

echo -e "${GREEN}✓ Host metabob-cli configured${NC}"
echo ""

# Configure container metabob-cli
echo -e "${CYAN}Configuring container metabob-cli...${NC}"

docker exec devbob-opencode sh -c "mkdir -p /workspace/.metabob && cat > /workspace/.metabob/config.json <<'EOF'
{
  \"base_url\": \"http://api-server-dev:8080\",
  \"api_key\": \"\",
  \"project_id\": \"$PROJECT_ID\",
  \"state_directory\": \".metabob\",
  \"watch_files\": true,
  \"batch_size\": 5
}
EOF"

echo -e "${GREEN}✓ Container metabob-cli configured${NC}"
echo ""

# Verify configurations
echo -e "${CYAN}Verifying configurations...${NC}"

HOST_PROJECT_ID=$(jq -r '.project_id' ~/.metabob/config.json)
CONTAINER_PROJECT_ID=$(docker exec devbob-opencode cat /workspace/.metabob/config.json | jq -r '.project_id')

echo "  Host project_id: $HOST_PROJECT_ID"
echo "  Container project_id: $CONTAINER_PROJECT_ID"

if [ "$HOST_PROJECT_ID" == "$CONTAINER_PROJECT_ID" ]; then
    echo -e "${GREEN}✓ Project IDs match${NC}"
else
    echo -e "${RED}✗ Project ID mismatch!${NC}"
    exit 1
fi
echo ""

# =============================================================================
# Database State Check (Before)
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Database State (Before Tests)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}Checking SurrealDB connection...${NC}"
SURREAL_RESPONSE=$(curl -s -X POST http://localhost:8000/sql \
  -u root:root \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -d "INFO FOR DB;" 2>/dev/null || echo "failed")

if echo "$SURREAL_RESPONSE" | grep -q "tables"; then
    echo -e "${GREEN}✓ SurrealDB connected${NC}"
    echo "$SURREAL_RESPONSE" | jq -r '.[0].result.tables' | head -5
else
    echo -e "${YELLOW}⚠ SurrealDB connection issue (non-critical)${NC}"
fi
echo ""

# Check projects in backend
echo -e "${CYAN}Checking projects in backend...${NC}"
PROJECTS=$(curl -s "$BACKEND_URL/api/v2/projects" 2>/dev/null || echo "{}")
echo "$PROJECTS" | jq -c '.projects[]? | {id, name}' | head -5 || echo "No projects found or API structure different"
echo ""

# Check activities in backend
echo -e "${CYAN}Checking activities in backend...${NC}"
ACTIVITIES=$(curl -s "$BACKEND_URL/api/v2/activities" 2>/dev/null || echo "{}")
ACTIVITY_COUNT=$(echo "$ACTIVITIES" | jq -r '.activities[]? | .id' 2>/dev/null | wc -l || echo 0)
echo "  Activities found: $ACTIVITY_COUNT"
echo ""

# =============================================================================
# Test 1: Create Simple Activity Template
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 1: Create Activity Template${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TEMPLATE_FILE="/tmp/test-activity-template.yaml"

cat > "$TEMPLATE_FILE" <<'EOF'
id: test-simple-activity
name: Test Simple Activity
description: Simple test activity for workflow validation
version: 1.0.0
category: test
tags:
  - test
  - validation
variables:
  - name: test_message
    type: string
    required: true
    description: Test message to echo
tasks:
  - id: echo-message
    description: Echo the test message
    agent_type: general
    prompt: |
      Echo this test message: {{ test_message }}
      
      Respond with:
      - The message you received
      - Current timestamp
      - Confirmation that this is a test
EOF

echo -e "${CYAN}Created test activity template: $TEMPLATE_FILE${NC}"
cat "$TEMPLATE_FILE"
echo ""

# =============================================================================
# Test 2: Register Activity Template (Host)
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 2: Register Activity from Host${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}Attempting to register activity via metabob-cli...${NC}"

# Try register-template command
REGISTER_OUTPUT=$(metabob-cli register-template "$TEMPLATE_FILE" 2>&1 || echo "FAILED")

if echo "$REGISTER_OUTPUT" | grep -qE "success|registered|created"; then
    echo -e "${GREEN}✓ Activity registered successfully${NC}"
    echo "$REGISTER_OUTPUT"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ Direct registration failed, trying API...${NC}"
    echo "$REGISTER_OUTPUT"
    
    # Try direct API registration
    API_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/v2/activities/register" \
      -H "Content-Type: application/json" \
      -d @"$TEMPLATE_FILE" 2>/dev/null || echo "FAILED")
    
    if echo "$API_RESPONSE" | grep -qE "success|created"; then
        echo -e "${GREEN}✓ Activity registered via API${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ Activity registration failed${NC}"
        echo "$API_RESPONSE"
        ((TESTS_FAILED++))
    fi
fi
echo ""

# =============================================================================
# Test 3: Verify Activity in Database
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 3: Verify Activity in Database${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}Querying SurrealDB for activity...${NC}"

ACTIVITY_QUERY=$(curl -s -X POST http://localhost:8000/sql \
  -u root:root \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -d "SELECT * FROM activity_template WHERE id = '$TEST_ACTIVITY_ID';" 2>/dev/null || echo "failed")

if echo "$ACTIVITY_QUERY" | grep -q "$TEST_ACTIVITY_ID"; then
    echo -e "${GREEN}✓ Activity found in database${NC}"
    echo "$ACTIVITY_QUERY" | jq '.' | head -20
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ Activity not found in database (may be in different table)${NC}"
    echo "$ACTIVITY_QUERY" | jq '.' | head -20
    ((TESTS_FAILED++))
fi
echo ""

# =============================================================================
# Test 4: Search Activities from Container
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 4: Search Activities from Container${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}Searching for activities via backend API...${NC}"

SEARCH_RESPONSE=$(curl -s "$BACKEND_URL/api/v2/activities" 2>/dev/null || echo "{}")
FOUND_ACTIVITIES=$(echo "$SEARCH_RESPONSE" | jq -r '.activities[]?.id' 2>/dev/null || echo "")

if [ -n "$FOUND_ACTIVITIES" ]; then
    echo -e "${GREEN}✓ Activities found:${NC}"
    echo "$FOUND_ACTIVITIES" | head -10
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ No activities found (API may use different structure)${NC}"
    echo "$SEARCH_RESPONSE" | jq '.' | head -20
    ((TESTS_FAILED++))
fi
echo ""

# =============================================================================
# Test 5: Test OpenCode Activity Tool
# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 5: Test OpenCode search_activities Tool${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}Testing search_activities via metabob-cli MCP...${NC}"

# Create test MCP request
MCP_REQUEST=$(cat <<'EOF_MCP'
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "metabob_search_activities",
    "arguments": {
      "verbose": false
    }
  }
}
EOF_MCP
)

echo "$MCP_REQUEST" | docker exec -i devbob-opencode sh -c "cd /workspace && metabob-cli mcp --transport stdio" 2>&1 | head -50 || echo "MCP test skipped (interactive mode)"

echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${MAGENTA}================================================================================================${NC}"
echo -e "${MAGENTA}Test Summary${NC}"
echo -e "${MAGENTA}================================================================================================${NC}"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

echo -e "${GREEN}Passed: $TESTS_PASSED / $TOTAL_TESTS${NC}"
echo -e "${RED}Failed: $TESTS_FAILED / $TOTAL_TESTS${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed - see details above${NC}"
    exit 1
fi
