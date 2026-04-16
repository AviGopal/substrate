#!/bin/bash
# Complete Terminal Vessel Demo

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Terminal Vessel + Human Interface Demo              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}Step 1: Start Terminal Vessel${NC}"
echo "Starting vessel on port 9137..."
bun run src/index.ts --port 9137 > /tmp/terminal-vessel.log 2>&1 &
VESSEL_PID=$!
sleep 2

# Check if vessel started
if curl -s http://localhost:9137/health > /dev/null; then
    echo -e "${GREEN}✓ Terminal vessel running (PID: $VESSEL_PID)${NC}"
else
    echo "❌ Failed to start terminal vessel"
    exit 1
fi

echo ""
echo -e "${CYAN}Step 2: Inspect State Space${NC}"
./cli/state-space-inspector.ts

echo ""
echo -e "${CYAN}Step 3: Spawn a Terminal${NC}"
./cli/terminal-cli.ts spawn shell
echo ""

echo -e "${YELLOW}Note: Terminal was spawned. Use 'terminal-cli list' to see it.${NC}"
echo ""

echo -e "${CYAN}Step 4: List All Terminals${NC}"
./cli/terminal-cli.ts list

echo ""
echo -e "${GREEN}Demo Complete!${NC}"
echo ""
echo "The terminal vessel is still running. To use it:"
echo "  - Send commands: ./cli/terminal-cli.ts send <id> \"command\""
echo "  - View state: ./cli/terminal-cli.ts state <id>"
echo "  - Interactive: ./cli/terminal-cli.ts interactive <id>"
echo ""
echo "To stop the vessel:"
echo "  kill $VESSEL_PID"
echo ""
echo "Vessel logs: tail -f /tmp/terminal-vessel.log"
