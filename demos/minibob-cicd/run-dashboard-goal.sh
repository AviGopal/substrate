#!/usr/bin/env bash
#
# Execute the goal: Build development state dashboard using goal-seeking
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "════════════════════════════════════════════════════════════"
echo "  Goal-Seeking Dashboard Development"
echo "════════════════════════════════════════════════════════════"
echo
echo "Giving MiniBob the goal to build a development state dashboard"
echo "using procedural activity composition."
echo
echo "Working directory: $PROJECT_ROOT"
echo
echo "MiniBob will:"
echo "  1. Discover available data sources (impulse state space)"
echo "  2. Create activities to fetch and process data"
echo "  3. Generate the dashboard HTML"
echo "  4. Extract successful execution into reusable template"
echo
echo "════════════════════════════════════════════════════════════"
echo

# Change to project root so MiniBob doesn't pollute demos/minibob-cicd
cd "$PROJECT_ROOT"

# The goal
GOAL="Create a development state dashboard that visualizes the impulse state space and goal-seeking execution.

The dashboard should show:

1. Available Shapes
   - Fetch from: https://activity.metabob.com/v2/shapes
   - Display: shape name, description, resolver type
   - Format: Table or card layout

2. Registered Activities
   - Fetch from: https://activity.metabob.com/v2/activities/templates
   - Display: activity name, category, success rate, Thompson Sampling score
   - Format: List with metrics

3. Recent Execution Traces
   - Fetch from: https://activity.metabob.com/v2/activities/execution-traces?limit=10
   - Display: execution flow, tasks executed, impulse resolutions
   - Format: Timeline or flow visualization

4. System Metrics
   - Calculate from traces: total executions, success rate, avg cost, avg latency
   - Calculate: ribosome extractions count, activities created via goal-seeking
   - Format: Metrics dashboard

Technical requirements:
- Generate HTML file at: demos/minibob-cicd/public/development-state.html
- Use modern CSS (flexbox/grid) for responsive layout
- Include JavaScript to auto-refresh data every 30 seconds
- Handle API errors gracefully (show cached data or error message)
- Use color-coded status badges (success=green, pending=yellow, error=red)

The dashboard demonstrates goal-seeking because it IS built via goal-seeking."

# Execute
echo "▶️  Executing goal via MiniBob..."
echo

minibob --single "$GOAL"

echo
echo "════════════════════════════════════════════════════════════"
echo "  Execution Complete"
echo "════════════════════════════════════════════════════════════"
echo

# Check results
DASHBOARD_PATH="demos/minibob-cicd/public/development-state.html"
if [ -f "$DASHBOARD_PATH" ]; then
    echo "✅ Dashboard generated: $DASHBOARD_PATH"
    echo
    echo "To view:"
    echo "  cd demos/minibob-cicd/public"
    echo "  python3 -m http.server 8000"
    echo "  open http://localhost:8000/development-state.html"
else
    echo "⚠️  Dashboard not generated at $DASHBOARD_PATH"
    echo "   Check execution log for errors"
fi

echo
echo "To deploy to GitHub Pages:"
echo "  git add $DASHBOARD_PATH"
echo "  git commit -m 'Add development state dashboard (generated via goal-seeking)'"
echo "  git push origin main"
echo
