#!/usr/bin/env bash
#
# MiniBob-TUI Demo Script
# Demonstrates testing MiniBob-TUI with production package
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TUI_DIR="$PROJECT_ROOT/repos/minibob-tui"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MiniBob-TUI Production Package Demo${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Verify we're using production package
echo -e "${YELLOW}[1/5] Verifying production package installation...${NC}"
cd "$TUI_DIR"

if [ ! -d "node_modules/@metabob/minibob" ]; then
    echo -e "${RED}✗ @metabob/minibob not installed${NC}"
    echo -e "${YELLOW}Running: bun install${NC}"
    bun install
fi

# Check if it's a symlink (local) or real directory (production)
if [ -L "node_modules/@metabob/minibob" ]; then
    echo -e "${RED}✗ Using local file reference (symlink detected)${NC}"
    echo -e "${YELLOW}Please update package.json to use production version${NC}"
    exit 1
else
    VERSION=$(cat node_modules/@metabob/minibob/package.json | grep '"version"' | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
    echo -e "${GREEN}✓ Production package installed: @metabob/minibob@${VERSION}${NC}"
fi

echo ""

# Step 2: Test import resolution
echo -e "${YELLOW}[2/5] Testing import resolution...${NC}"

cat > /tmp/test-minibob-imports.ts <<'EOF'
import { MiniBob } from "@metabob/minibob";
import { getLogger } from "@metabob/minibob/logger";
import type { Impulse, Activity } from "@metabob/minibob/types";

const logger = getLogger("demo");
logger.info("✓ Imports resolved successfully");
process.exit(0);
EOF

if bun run /tmp/test-minibob-imports.ts > /tmp/import-test-output.txt 2>&1; then
    echo -e "${GREEN}✓ All imports work correctly${NC}"
else
    echo -e "${RED}✗ Import test failed${NC}"
    cat /tmp/import-test-output.txt
    exit 1
fi

rm /tmp/test-minibob-imports.ts
echo ""

# Step 3: Check for API keys
echo -e "${YELLOW}[3/5] Checking API keys...${NC}"

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}⚠  ANTHROPIC_API_KEY not set${NC}"
    echo -e "   Set it with: export ANTHROPIC_API_KEY=sk-ant-your-key"
    echo -e "   (Required for embedded mode)"
else
    echo -e "${GREEN}✓ ANTHROPIC_API_KEY configured${NC}"
fi

if [ -z "$METABOB_API_KEY" ]; then
    echo -e "${YELLOW}⚠  METABOB_API_KEY not set${NC}"
    echo -e "   Set it with: export METABOB_API_KEY=your-key"
    echo -e "   (Required for activity backend)"
else
    echo -e "${GREEN}✓ METABOB_API_KEY configured${NC}"
fi

echo ""

# Step 4: Show available test modes
echo -e "${YELLOW}[4/5] Available test modes:${NC}"
echo ""
echo -e "${BLUE}Mode 1: Import Test Only (no API keys needed)${NC}"
echo -e "  Just verifies production package imports work"
echo -e "  Already completed above ✓"
echo ""
echo -e "${BLUE}Mode 2: Embedded MiniBob + TUI (requires ANTHROPIC_API_KEY)${NC}"
echo -e "  Command: ${GREEN}bun run start --embedded --dev${NC}"
echo -e "  Shows: Complete TUI with MiniBob running in-process"
echo -e "  Try goals like:"
echo -e "    - 'Run ls -la and show the files'"
echo -e "    - 'Create a test file with some content'"
echo -e "    - 'Show git status'"
echo ""
echo -e "${BLUE}Mode 3: Remote Mode - MiniBob Daemon + TUI Client${NC}"
echo -e "  Terminal 1: ${GREEN}cd ../minibob && bun run index.ts --daemon${NC}"
echo -e "  Terminal 2: ${GREEN}cd ../minibob-tui && bun run start --endpoint http://localhost:8080${NC}"
echo -e "  Shows: TUI connected to standalone MiniBob instance"
echo ""

# Step 5: Demonstrate simple test
echo -e "${YELLOW}[5/5] Quick demonstration:${NC}"
echo ""

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${YELLOW}Skipping live demo (ANTHROPIC_API_KEY not set)${NC}"
    echo ""
    echo -e "${BLUE}To run live demo:${NC}"
    echo -e "  1. export ANTHROPIC_API_KEY=sk-ant-your-key"
    echo -e "  2. cd $TUI_DIR"
    echo -e "  3. bun run start --embedded --dev"
    echo -e "  4. Type a goal like: ${GREEN}Run echo 'Hello from MiniBob-TUI'${NC}"
else
    echo -e "${GREEN}API key found! Ready for live demo.${NC}"
    echo ""
    echo -e "${BLUE}To start MiniBob-TUI:${NC}"
    echo -e "  ${GREEN}cd $TUI_DIR${NC}"
    echo -e "  ${GREEN}bun run start --embedded --dev${NC}"
    echo ""
    echo -e "${BLUE}Example goals to try:${NC}"
    echo -e "  1. ${GREEN}Run ls -la and show the files${NC}"
    echo -e "  2. ${GREEN}Create a test directory called 'demo' and put 3 files in it${NC}"
    echo -e "  3. ${GREEN}Use tui_emit to display a success message${NC}"
    echo -e "  4. ${GREEN}Use tui_observe to show me the current TUI regions${NC}"
    echo ""
fi

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Demo preparation complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Documentation:${NC}"
echo -e "  - Testing guide: ${BLUE}docs/guides/TESTING_MINIBOB_TUI.md${NC}"
echo -e "  - Quick start: ${BLUE}docs/guides/TERMINAL_VESSEL_QUICK_START.md${NC}"
echo -e "  - Sequence diagrams: ${BLUE}docs/architecture/MINIBOB_TUI_SEQUENCE_DIAGRAMS.md${NC}"
echo ""

echo -e "${YELLOW}Key Insights:${NC}"
echo -e "  • MiniBob-TUI now uses ${GREEN}@metabob/minibob@${VERSION}${NC} (production package)"
echo -e "  • All command outputs appear as ${BLUE}impulse regions${NC} in the TUI"
echo -e "  • ${BLUE}6 TUI tools${NC} available for activities to interact with UI"
echo -e "  • No terminal vessel needed for most use cases - ${GREEN}built-in bash tool${NC} works great!"
echo ""
