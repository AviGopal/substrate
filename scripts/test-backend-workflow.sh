#!/bin/bash
# =============================================================================
# Backend Configuration Complete Workflow Test
# =============================================================================
# Complete workflow that:
#   1. Runs verification (before)
#   2. Applies fixes
#   3. Runs verification (after)
#   4. Traces logs for 30 seconds
#   5. Tests metabob-cli functionality
#
# Usage:
#   ./scripts/test-backend-workflow.sh
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

echo -e "${MAGENTA}================================================================================================${NC}"
echo -e "${MAGENTA}Backend Configuration Complete Workflow Test${NC}"
echo -e "${MAGENTA}================================================================================================${NC}"
echo ""

# =============================================================================
# Step 1: Verification (Before)
# =============================================================================
echo -e "${CYAN}[Step 1/5] Running verification BEFORE fixes...${NC}"
echo ""

if bash scripts/verify-backend-config.sh; then
    echo -e "${GREEN}✓ Verification passed - configuration already correct!${NC}"
    echo ""
    echo -e "${YELLOW}No fixes needed. Proceeding to log trace test...${NC}"
    SKIP_FIXES=true
else
    echo -e "${YELLOW}⚠ Verification found issues - will apply fixes${NC}"
    SKIP_FIXES=false
fi
echo ""
sleep 2

# =============================================================================
# Step 2: Apply Fixes (if needed)
# =============================================================================
if [ "$SKIP_FIXES" == "false" ]; then
    echo -e "${CYAN}[Step 2/5] Applying configuration fixes...${NC}"
    echo ""
    
    if bash scripts/fix-backend-config.sh; then
        echo -e "${GREEN}✓ Fixes applied successfully${NC}"
    else
        echo -e "${RED}✗ Failed to apply fixes${NC}"
        exit 1
    fi
    echo ""
    sleep 2
else
    echo -e "${CYAN}[Step 2/5] Skipping fixes (configuration already correct)${NC}"
    echo ""
fi

# =============================================================================
# Step 3: Verification (After)
# =============================================================================
echo -e "${CYAN}[Step 3/5] Running verification AFTER fixes...${NC}"
echo ""

if bash scripts/verify-backend-config.sh; then
    echo -e "${GREEN}✓ Verification passed - configuration is correct!${NC}"
else
    echo -e "${RED}✗ Verification failed after applying fixes${NC}"
    echo ""
    echo "Please review the output above and check:"
    echo "  - configs/opencode.devbob.json"
    echo "  - docker-compose.yaml"
    echo "  - Container status (docker ps)"
    exit 1
fi
echo ""
sleep 2

# =============================================================================
# Step 4: Trace Logs
# =============================================================================
echo -e "${CYAN}[Step 4/5] Tracing backend connectivity logs for 30 seconds...${NC}"
echo ""
echo -e "${YELLOW}This will monitor logs from all containers to verify connectivity${NC}"
echo ""
sleep 2

bash scripts/trace-backend-connectivity.sh 30

echo ""
echo -e "${GREEN}✓ Log trace complete${NC}"
echo ""
sleep 2

# =============================================================================
# Step 5: Test metabob-cli Functionality
# =============================================================================
echo -e "${CYAN}[Step 5/5] Testing metabob-cli functionality...${NC}"
echo ""

# Test host metabob-cli
echo -e "${BLUE}Testing host metabob-cli:${NC}"
if command -v metabob-cli &> /dev/null; then
    echo -n "  Version: "
    metabob-cli --version || echo "Failed"
    echo -n "  Config: "
    metabob-cli config 2>/dev/null | head -1 || echo "Failed"
else
    echo -e "${YELLOW}  metabob-cli not found on host${NC}"
fi
echo ""

# Test container metabob-cli
echo -e "${BLUE}Testing container metabob-cli:${NC}"
if docker ps | grep -q "devbob-opencode"; then
    echo -n "  Version: "
    docker exec devbob-opencode metabob-cli --version || echo "Failed"
    echo -n "  Backend connectivity: "
    if docker exec devbob-opencode curl -s http://host.docker.internal:8080/ | grep -q "ok"; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
    fi
else
    echo -e "${YELLOW}  devbob-opencode container not running${NC}"
fi
echo ""

# =============================================================================
# Final Summary
# =============================================================================
echo -e "${MAGENTA}================================================================================================${NC}"
echo -e "${MAGENTA}Workflow Complete!${NC}"
echo -e "${MAGENTA}================================================================================================${NC}"
echo ""
echo -e "${GREEN}✅ Backend configuration workflow completed successfully${NC}"
echo ""
echo "Summary:"
echo "  1. ✓ Initial verification ran"
if [ "$SKIP_FIXES" == "false" ]; then
    echo "  2. ✓ Configuration fixes applied"
else
    echo "  2. ⊘ Fixes skipped (already correct)"
fi
echo "  3. ✓ Post-fix verification passed"
echo "  4. ✓ Log trace completed (30s)"
echo "  5. ✓ metabob-cli functionality tested"
echo ""
echo "Next steps:"
echo "  - Review log traces in: /tmp/devbob-trace-*/"
echo "  - Test OpenCode MCP integration"
echo "  - Register and execute activity templates"
echo "  - Test activity template sharing between host and containers"
echo ""
