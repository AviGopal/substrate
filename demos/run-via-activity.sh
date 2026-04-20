#!/bin/bash
# Run terminal vessel demonstrations as activities through MiniBob

echo "═══════════════════════════════════════════════════════════════════"
echo "  Running Terminal Vessel Demos as Activities"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "This demonstrates 'activities all the way down' - even the demos"
echo "about the system are executed as activities through the vessel."
echo ""
echo "Press Enter to continue..."
read

cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob

echo ""
echo ">>> Method 1: Run deduplication demo as activity"
echo ""
echo "Activity: demo:terminal-vessel"
echo "Variable: demo_type=deduplication"
echo ""

bun run index.ts --single "Execute the terminal vessel demonstration activity from ../../repos/minibob/activities/demo/terminal-vessel-demo.json with demo_type=deduplication"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Key Insight"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "What just happened:"
echo "  1. You invoked MiniBob with a goal"
echo "  2. MiniBob selected the terminal-vessel-demo activity"
echo "  3. Activity executed the TypeScript demonstration script"
echo "  4. Output captured as impulse"
echo "  5. Activity completed, trace recorded"
echo ""
echo "This shows:"
echo "  → Demonstrations ARE activities"
echo "  → Meta-operations flow through the vessel"
echo "  → Everything is observable and traceable"
echo "  → \"Activities all the way down\" in practice"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
