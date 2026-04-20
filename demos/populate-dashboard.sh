#!/bin/bash
# Populate Dashboard with Real Activity Executions
# Runs several simple activities to generate execution traces

set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "  Populating Dashboard with Activity Executions"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "This will run several activities through MiniBob to generate"
echo "real execution traces and update Thompson Sampling scores."
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""

MINIBOB_DIR="../repos/minibob"

if [ ! -f "$MINIBOB_DIR/index.ts" ]; then
    echo "Error: MiniBob not found at $MINIBOB_DIR"
    exit 1
fi

cd "$MINIBOB_DIR"

# Function to run an activity
run_activity() {
    local description=$1
    local goal=$2

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: $description"
    echo "Goal: $goal"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Run MiniBob with timeout
    timeout 60 bun run index.ts --single "$goal" 2>&1 || {
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            echo "⚠ Activity timed out after 60s"
        else
            echo "⚠ Activity failed with exit code $exit_code"
        fi
    }

    echo ""
    sleep 2
}

# Run several simple activities
echo "Starting activity executions..."
echo ""

# 1. Simple status check
run_activity "System Status Check" "show me the current system status"

# 2. List files
run_activity "List Repository Files" "show me the main files in this repository"

# 3. Simple test
run_activity "Check TypeScript Config" "check if we have a tsconfig.json file"

echo "═══════════════════════════════════════════════════════════════════"
echo "  Activity Executions Complete"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "✓ Ran 3 activities"
echo ""
echo "Now check the operational dashboard to see the results:"
echo "  cd ../demos"
echo "  ./run-ops-dashboard.sh"
echo ""
echo "You should see:"
echo "  • Executions (24h) > 0"
echo "  • Recent executions with actual activities"
echo "  • Thompson scores starting to diverge from 50%"
echo ""
