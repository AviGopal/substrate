#!/bin/bash

# Monitor Dashboard Development Progress
# Tracks autonomous loop execution and dashboard creation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="/tmp/claude-1000/-home-avi-documents-work-exp-repo-metabob-devbob/tasks/b6f9af6.output"
RESULTS_DIR="$PROJECT_DIR/results/dashboard-development"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

clear

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Dashboard Development - Autonomous Loop Monitor           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if autonomous loop is running
if ! ps aux | grep -q "[b]6f9af6"; then
    if [ -f "$OUTPUT_FILE" ]; then
        echo -e "${GREEN}✓ Autonomous loop completed${NC}"
        echo ""
        echo "Output file: $OUTPUT_FILE"
        echo ""

        # Show summary
        if grep -q "Activity completed" "$OUTPUT_FILE"; then
            echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${GREEN}  Execution Summary${NC}"
            echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            grep -A 3 "Activity completed" "$OUTPUT_FILE" | tail -3
        fi
    else
        echo -e "${YELLOW}⚠ Autonomous loop not running and no output file found${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}⟳ Autonomous loop is running...${NC}"
    echo ""
fi

# Show recent activity
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Recent Activity (last 20 lines)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
tail -20 "$OUTPUT_FILE"
echo ""

# Check for results
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Results Directory${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -d "$RESULTS_DIR" ]; then
    echo "  Location: $RESULTS_DIR"
    echo "  Files created:"
    find "$RESULTS_DIR" -type f -printf "    %p (%s bytes)\n" 2>/dev/null || echo "    No files yet"
else
    echo "  Directory not created yet: $RESULTS_DIR"
fi
echo ""

# Check dashboard directory
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Dashboard Files${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -d "$PROJECT_DIR/dashboard" ]; then
    echo "  ✓ Dashboard directory exists"
    echo ""
    echo "  Components:"
    find "$PROJECT_DIR/dashboard/src/components" -name "*.tsx" 2>/dev/null | sed 's/^/    /' || echo "    No components yet"
    echo ""
    echo "  Hooks:"
    find "$PROJECT_DIR/dashboard/src/hooks" -name "*.ts" 2>/dev/null | sed 's/^/    /' || echo "    No hooks yet"
else
    echo "  Dashboard directory not created yet"
fi
echo ""

# Show execution metrics
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Execution Metrics${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if grep -q "Duration:" "$OUTPUT_FILE" 2>/dev/null; then
    echo "  $(grep "Duration:" "$OUTPUT_FILE" | tail -1)"
fi

if grep -q "Cost:" "$OUTPUT_FILE" 2>/dev/null; then
    echo "  $(grep "Cost:" "$OUTPUT_FILE" | tail -1)"
fi

if grep -q "Tokens:" "$OUTPUT_FILE" 2>/dev/null; then
    echo "  $(grep "Tokens:" "$OUTPUT_FILE" | tail -1)"
fi

echo ""

# Check for errors
if grep -qi "error\|failed\|exception" "$OUTPUT_FILE" 2>/dev/null; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Potential Issues Detected${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    grep -i "error\|failed\|exception" "$OUTPUT_FILE" | tail -5 | sed 's/^/  /'
    echo ""
fi

# Show commands
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Available Commands${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Watch mode:"
echo "    watch -n 10 $0"
echo ""
echo "  Tail output:"
echo "    tail -f $OUTPUT_FILE"
echo ""
echo "  View results:"
echo "    ls -lah $RESULTS_DIR"
echo ""
echo "  Check dashboard build:"
echo "    cd $PROJECT_DIR/dashboard && bun run build"
echo ""
