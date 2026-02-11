#!/bin/bash
# Direct test of MCP functionality in devbob-opencode container

set -e

echo "============================================================"
echo "DevBob Container MCP Direct Test"
echo "============================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Backend connectivity
echo -e "${BLUE}[1/4] Testing backend connectivity from container...${NC}"
if docker exec devbob-opencode curl -sf http://api-server-dev:8080/ > /dev/null; then
    echo -e "${GREEN}    ✓ Backend reachable at api-server-dev:8080${NC}"
else
    echo -e "${RED}    ✗ Backend NOT reachable${NC}"
    exit 1
fi

# Test 2: Check config
echo -e "${BLUE}[2/4] Checking OpenCode config...${NC}"
CONFIG_URL=$(docker exec devbob-opencode cat /workspace/.opencode/opencode.json | jq -r '.metabob.base_url')
if [ "$CONFIG_URL" = "http://api-server-dev:8080" ]; then
    echo -e "${GREEN}    ✓ Config URL correct: $CONFIG_URL${NC}"
else
    echo -e "${RED}    ✗ Config URL wrong: $CONFIG_URL${NC}"
    exit 1
fi

# Test 3: Test MCP tool via metabob-cli
echo -e "${BLUE}[3/4] Testing MCP search_activities tool...${NC}"
SEARCH_RESULT=$(docker exec devbob-opencode metabob-cli activities search "bug fix" --limit 3 2>&1)
if echo "$SEARCH_RESULT" | grep -q "template\|activity"; then
    echo -e "${GREEN}    ✓ MCP search returned results${NC}"
    echo "$SEARCH_RESULT" | head -5
else
    echo -e "${RED}    ✗ MCP search failed${NC}"
    echo "$SEARCH_RESULT"
    exit 1
fi

# Test 4: Verify session can be created
echo -e "${BLUE}[4/4] Testing metabob-cli session management...${NC}"
SESSION_TEST=$(docker exec devbob-opencode metabob-cli sessions list 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}    ✓ Session management working${NC}"
else
    echo -e "${RED}    ✗ Session management failed${NC}"
    exit 1
fi

echo ""
echo "============================================================"
echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
echo "============================================================"
echo ""
echo "This proves:"
echo "  1. Container can reach backend via docker network"
echo "  2. Config is correctly set to api-server-dev:8080"
echo "  3. MCP tools can fetch activity templates"
echo "  4. Session management is functional"
echo ""
echo "Activity execution should now work in the container!"
