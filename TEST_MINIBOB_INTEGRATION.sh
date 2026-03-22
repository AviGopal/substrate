#!/bin/bash
set -e

echo "=== MiniBob Library Integration Test ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "1. Checking backend health..."
if curl -s http://localhost:8081/health | grep -q '"status":"healthy"'; then
    echo -e "   ${GREEN}✓${NC} Backend healthy"
else
    echo -e "   ${RED}✗${NC} Backend not reachable"
    exit 1
fi

echo ""
echo "2. Testing MiniBob GoalProcessor..."
node test-goal-processor.mjs > /tmp/goal-test.log 2>&1
if grep -q "✅ Got 3 recommendations" /tmp/goal-test.log; then
    echo -e "   ${GREEN}✓${NC} GoalProcessor gets recommendations from backend"
else
    echo -e "   ${RED}✗${NC} GoalProcessor failed"
    cat /tmp/goal-test.log
    exit 1
fi

echo ""
echo "3. Checking MiniBob build..."
if [ -f "repos/minibob/dist/lib.js" ]; then
    echo -e "   ${GREEN}✓${NC} MiniBob package built"
else
    echo -e "   ${RED}✗${NC} MiniBob package not built"
    exit 1
fi

echo ""
echo -e "${GREEN}=== All Checks Passed! ===${NC}"
echo ""
echo "Architecture Summary:"
echo "  ┌──────────────────────────────────────────┐"
echo "  │           OpenCode Session               │"
echo "  │  - Creates executor                      │"
echo "  │  - Initializes MCP (once)                │"
echo "  │  - Calls goalProcessor.executeGoal()     │"
echo "  └──────────────────────────────────────────┘"
echo "                     ↓"
echo "  ┌──────────────────────────────────────────┐"
echo "  │      MiniBob GoalProcessor               │"
echo "  │  - Gets recommendations from backend     │"
echo "  │  - Executes activities                   │"
echo "  │  - Manages impulse lifecycle             │"
echo "  │  - Tracks costs                          │"
echo "  │  - Checks completion                     │"
echo "  └──────────────────────────────────────────┘"
echo ""
echo "Ready to test in OpenCode session!"
echo ""
echo "Test command:"
echo "  goal({ goal: 'Add a test function', context: {}, maxActivities: 1 })"
echo ""
echo "Expected:"
echo "  - MCP initialized on first call"
echo "  - Backend returns recommendations"
echo "  - Activity executes"
echo "  - Trace stored in backend"
