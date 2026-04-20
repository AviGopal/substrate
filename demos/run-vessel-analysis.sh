#!/bin/bash
# Observable Vessel Self-Improvement Demonstration
# Shows MiniBob analyzing and improving itself

set -e

echo "═══════════════════════════════════════════════════════"
echo "  MiniBob Vessel Self-Improvement Demonstration"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "This demonstrates a REAL vessel (MiniBob) analyzing itself"
echo "through activity execution. Watch as MiniBob:"
echo "  1. Scans its own activity files"
echo "  2. Analyzes determinism vs LLM usage"
echo "  3. Identifies optimization patterns"
echo "  4. Creates concrete improvement recommendations"
echo ""
echo "Press Enter to start..."
read

echo ""
echo ">>> Executing vessel self-analysis activity..."
echo ""

cd repos/minibob

# Execute the local self-analysis activity
bun run index.ts --single "Execute the local vessel self-analysis activity defined in ../../demos/vessel-self-analysis-local.json. Scan activities, analyze patterns, and create an improvement report in /tmp/vessel-analysis/" --budget 5

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Analysis Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo ">>> Results:"
echo ""

# Find and display the generated report
REPORT=$(ls -t /tmp/vessel-analysis/improvement-report-*.md 2>/dev/null | head -1)

if [ -f "$REPORT" ]; then
    echo "✓ Improvement report created: $REPORT"
    echo ""
    echo ">>> Report Contents:"
    echo "───────────────────────────────────────────────────────"
    cat "$REPORT"
    echo "───────────────────────────────────────────────────────"
    echo ""
    echo "✓ Report saved for later review"
else
    echo "⚠ Report not found. Checking /tmp/vessel-analysis/..."
    ls -lh /tmp/vessel-analysis/ 2>/dev/null || echo "Directory not created"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Key Observations"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "What just happened:"
echo "  ✓ MiniBob executed an activity on ITSELF"
echo "  ✓ Scanned its own activity templates"
echo "  ✓ Analyzed its own architecture"
echo "  ✓ Identified concrete improvements"
echo "  ✓ Created actionable recommendations"
echo ""
echo "This demonstrates 'Activities All The Way Down':"
echo "  → Meta-operations ARE activities"
echo "  → Vessel improvement IS activity execution"
echo "  → Self-analysis IS just another task"
echo ""
echo "Next steps:"
echo "  1. Review the improvement report above"
echo "  2. Execute recommended bootstrap activities"
echo "  3. Observe Thompson Sampling learn which works best"
echo "  4. Watch deterministic ratio increase over time"
echo ""
echo "═══════════════════════════════════════════════════════"
