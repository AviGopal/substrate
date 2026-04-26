#!/bin/bash

# Example workflow demonstrating Activity API diagnostic tool usage
# This script shows common diagnostic patterns for exploring and manipulating
# the Thompson Sampling learning system.

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Activity API Diagnostic Tool - Example Workflow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# ==============================================================================
# Workflow 1: Explore Thompson Sampling Recommendations
# ==============================================================================

echo "📋 WORKFLOW 1: Explore Thompson Sampling Recommendations"
echo "─────────────────────────────────────────────────────────────────────"
echo

echo "Step 1: Get recommendations for a task..."
echo "Command: bun diagnostic-activity-api.ts recommend 'fix authentication bug' --limit 3"
echo
bun diagnostic-activity-api.ts recommend "fix authentication bug" --limit 3

echo
read -p "Press Enter to continue..."
echo

echo "Step 2: Try with specific input shapes..."
echo "Command: bun diagnostic-activity-api.ts recommend 'analyze execution trace' --shapes activityExecutionTrace --limit 3"
echo
bun diagnostic-activity-api.ts recommend "analyze execution trace" --shapes activityExecutionTrace --limit 3

echo
read -p "Press Enter to continue..."
echo

# ==============================================================================
# Workflow 2: Adjust Thompson Sampling Weights
# ==============================================================================

echo
echo "📊 WORKFLOW 2: Adjust Thompson Sampling Weights"
echo "─────────────────────────────────────────────────────────────────────"
echo

echo "Step 1: List available templates..."
echo "Command: bun diagnostic-activity-api.ts list --limit 5"
echo
bun diagnostic-activity-api.ts list --limit 5

echo
read -p "Press Enter to continue..."
echo

echo "Step 2: Get details of a specific template..."
echo "(Using the first template from the list)"
echo
# Get the first template ID (this is a simplified example)
TEMPLATE_ID=$(bun diagnostic-activity-api.ts list --limit 1 2>/dev/null | grep -oP '\([^)]+\)' | head -1 | tr -d '()')

if [ -n "$TEMPLATE_ID" ]; then
    echo "Template ID: $TEMPLATE_ID"
    echo "Command: bun diagnostic-activity-api.ts template '$TEMPLATE_ID'"
    echo
    bun diagnostic-activity-api.ts template "$TEMPLATE_ID" || echo "Template details not available"
else
    echo "Could not extract template ID from list"
fi

echo
read -p "Press Enter to continue..."
echo

echo "Step 3: Provide positive feedback to boost a template..."
echo "(Simulated - not executing to avoid modifying production data)"
echo "Command: bun diagnostic-activity-api.ts feedback <template_id> positive 1 --reason 'works well'"
echo

echo
read -p "Press Enter to continue..."
echo

# ==============================================================================
# Workflow 3: Explore Composition Graph
# ==============================================================================

echo
echo "🔗 WORKFLOW 3: Explore Composition Graph"
echo "─────────────────────────────────────────────────────────────────────"
echo

echo "Step 1: Query composition edges for an activity..."
echo "Command: bun diagnostic-activity-api.ts composition acquire-codebase-context --limit 5"
echo
bun diagnostic-activity-api.ts composition acquire-codebase-context --limit 5 || echo "No composition edges found"

echo
read -p "Press Enter to continue..."
echo

echo "Step 2: View execution path (predecessors + successors)..."
echo "Command: bun diagnostic-activity-api.ts graph acquire-codebase-context"
echo
bun diagnostic-activity-api.ts graph acquire-codebase-context || echo "No graph data available"

echo
read -p "Press Enter to continue..."
echo

# ==============================================================================
# Workflow 4: Compare Recommendations with/without Shapes
# ==============================================================================

echo
echo "🔬 WORKFLOW 4: Compare Shape-Conditioned vs Global Recommendations"
echo "─────────────────────────────────────────────────────────────────────"
echo

echo "Step 1: Global recommendations (no shapes)..."
echo "Command: bun diagnostic-activity-api.ts recommend 'analyze code for bugs' --limit 3"
echo
bun diagnostic-activity-api.ts recommend "analyze code for bugs" --limit 3

echo
echo "Step 2: Shape-conditioned recommendations..."
echo "Command: bun diagnostic-activity-api.ts recommend 'analyze code for bugs' --shapes file_list,source_code --limit 3"
echo
bun diagnostic-activity-api.ts recommend "analyze code for bugs" --shapes file_list,source_code --limit 3

echo
read -p "Press Enter to continue..."
echo

# ==============================================================================
# Summary
# ==============================================================================

echo
echo "✅ WORKFLOW COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "You've explored:"
echo "  • Thompson Sampling recommendations"
echo "  • Template listing and details"
echo "  • Composition graph queries"
echo "  • Execution path visualization"
echo "  • Shape-conditioned scoring"
echo
echo "Next steps:"
echo "  • Use 'feedback' to adjust weights based on real executions"
echo "  • Monitor composition patterns over time"
echo "  • Compare score sources (shape_conditioned vs global)"
echo "  • Integrate with MiniBob for closed-loop learning"
echo
echo "For more examples, see: ACTIVITY_API_DIAGNOSTIC.md"
echo
