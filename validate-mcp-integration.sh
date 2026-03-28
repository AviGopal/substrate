#!/bin/bash
set -e

echo "=== MiniBob MCP Integration Validation ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check MiniBob backend is running
echo "1. Checking MiniBob backend..."
if curl -s http://localhost:8081/health | grep -q '"status":"healthy"'; then
    echo -e "   ${GREEN}✓${NC} MiniBob backend is healthy"
else
    echo -e "   ${RED}✗${NC} MiniBob backend is not reachable"
    exit 1
fi

# 2. Check MiniBob package is built
echo ""
echo "2. Checking MiniBob package build..."
if [ -f "repos/minibob/dist/lib.js" ]; then
    echo -e "   ${GREEN}✓${NC} MiniBob package is built"
else
    echo -e "   ${RED}✗${NC} MiniBob package not built"
    echo "   Run: cd repos/minibob && npm run build"
    exit 1
fi

# 3. Test MCP client initialization
echo ""
echo "3. Testing MCP client initialization..."
node test-mcp-init.mjs > /tmp/mcp-test.log 2>&1
if grep -q "isMCPEnabled(): true" /tmp/mcp-test.log; then
    echo -e "   ${GREEN}✓${NC} MCP client initializes correctly"
else
    echo -e "   ${RED}✗${NC} MCP client initialization failed"
    cat /tmp/mcp-test.log
    exit 1
fi

# 4. Test recommendActivities
echo ""
echo "4. Testing recommendActivities..."
if grep -q "Got [0-9]* recommendations" /tmp/mcp-test.log; then
    RECS=$(grep "Got.*recommendations" /tmp/mcp-test.log | sed 's/.*Got \([0-9]*\).*/\1/')
    echo -e "   ${GREEN}✓${NC} Backend returned $RECS activity recommendations"
else
    echo -e "   ${RED}✗${NC} recommendActivities failed"
    exit 1
fi

# 5. Check OpenCode config
echo ""
echo "5. Checking OpenCode config..."
if grep -q '"url": "http://localhost:8081"' .opencode/opencode.json; then
    echo -e "   ${GREEN}✓${NC} OpenCode configured with minibob.url"
else
    echo -e "   ${RED}✗${NC} OpenCode config missing minibob.url"
    exit 1
fi

# 6. Check OpenCode integration code
echo ""
echo "6. Checking OpenCode integration code..."
if grep -q 'config.minibob?.url' repos/metabob-opencode/packages/opencode/src/minibob-integration/index.ts; then
    echo -e "   ${GREEN}✓${NC} OpenCode uses config.minibob.url"
else
    echo -e "   ${RED}✗${NC} OpenCode integration code incorrect"
    exit 1
fi

if grep -q 'await initializeMCP' repos/metabob-opencode/packages/opencode/src/minibob-integration/index.ts; then
    echo -e "   ${GREEN}✓${NC} OpenCode calls initializeMCP()"
else
    echo -e "   ${RED}✗${NC} OpenCode missing initializeMCP() call"
    exit 1
fi

echo ""
echo -e "${GREEN}=== All validations passed! ===${NC}"
echo ""
echo "Next steps:"
echo "  1. The goal tool will now automatically initialize MCP on first use"
echo "  2. When you call goal(), it will:"
echo "     - Initialize executor (line 438)"
echo "     - Call initialize() (line 218)"  
echo "     - Call initializeMCP() (line 92)"
echo "     - Execute goal loop and call recommendActivities()"
echo "  3. To test, restart your OpenCode session and use the goal tool"
echo ""
echo "Manual test:"
echo "  - Start OpenCode session"
echo "  - Use: goal({ goal: 'Add a test feature', context: {}, maxActivities: 1, maxCost: 1 })"
echo "  - Check logs for 'MiniBob MCP client initialized'"
echo "  - Verify activities execute"

