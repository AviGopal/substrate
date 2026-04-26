#!/bin/bash

# Comprehensive diagnostic tool workflow test
# Tests all commands and creates a recommendation improvement workflow

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Activity API Diagnostic Tool - Comprehensive Test & Workflow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

PASSING=0
FAILING=0
SKIPPED=0

function test_command() {
    local name="$1"
    local command="$2"
    local expected_status="${3:-0}"

    echo "Testing: $name"
    echo "Command: $command"
    echo

    if eval "$command" > /tmp/diagnostic-test.out 2>&1; then
        if [ $expected_status -eq 0 ]; then
            echo "✅ PASS: $name"
            PASSING=$((PASSING + 1))
        else
            echo "⚠️  UNEXPECTED PASS: $name (expected failure)"
            SKIPPED=$((SKIPPED + 1))
        fi
    else
        if [ $expected_status -ne 0 ]; then
            echo "✅ EXPECTED FAIL: $name"
            PASSING=$((PASSING + 1))
        else
            echo "❌ FAIL: $name"
            cat /tmp/diagnostic-test.out | head -20
            FAILING=$((FAILING + 1))
        fi
    fi
    echo
    echo "─────────────────────────────────────────────────────────────────────"
    echo
}

# ==============================================================================
# Test Suite
# ==============================================================================

echo "📋 PHASE 1: Testing Core Commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

test_command \
    "List templates" \
    "bun diagnostic-activity-api.ts list --limit 5"

test_command \
    "Get recommendations (basic)" \
    "bun diagnostic-activity-api.ts recommend 'fix authentication bug' --limit 3"

test_command \
    "Get recommendations (with shapes)" \
    "bun diagnostic-activity-api.ts recommend 'analyze trace data' --shapes activityExecutionTrace --limit 3"

test_command \
    "Get recommendations (with category)" \
    "bun diagnostic-activity-api.ts recommend 'add new feature' --category feature --limit 3"

# Get a template ID for further testing
TEMPLATE_ID=$(bun diagnostic-activity-api.ts list --limit 1 2>/dev/null | grep -oP 'activity:[^)]+' | head -1)

if [ -n "$TEMPLATE_ID" ]; then
    echo "Using template ID for tests: $TEMPLATE_ID"
    echo

    test_command \
        "Get template details" \
        "bun diagnostic-activity-api.ts template '$TEMPLATE_ID'"

    test_command \
        "Query composition graph" \
        "bun diagnostic-activity-api.ts composition '$TEMPLATE_ID' --limit 5"

    test_command \
        "Show execution graph" \
        "bun diagnostic-activity-api.ts graph '$TEMPLATE_ID'"
else
    echo "⚠️  WARNING: Could not extract template ID, skipping template-specific tests"
    SKIPPED=$((SKIPPED + 3))
fi

echo
echo "📋 PHASE 2: Testing Known Failing Commands"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

test_command \
    "Get metrics (KNOWN ISSUE: missing table)" \
    "bun diagnostic-activity-api.ts metrics acquire-codebase-context" \
    1  # Expect failure

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Passing: $PASSING"
echo "❌ Failing: $FAILING"
echo "⏭️  Skipped: $SKIPPED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

if [ $FAILING -gt 0 ]; then
    echo "⚠️  Some tests failed. Review output above."
    echo
fi

# ==============================================================================
# Recommendation Improvement Workflow
# ==============================================================================

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 RECOMMENDATION IMPROVEMENT WORKFLOW"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "This workflow demonstrates how to improve recommendation relevancy."
echo

# Define a test goal
TEST_GOAL="analyze failed test execution and suggest fixes"

echo "Test Goal: \"$TEST_GOAL\""
echo
echo "─────────────────────────────────────────────────────────────────────"
echo

echo "Step 1: Get baseline recommendations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
bun diagnostic-activity-api.ts recommend "$TEST_GOAL" --limit 5 | tee /tmp/baseline-recommendations.txt
echo

read -p "Press Enter to continue to Step 2..."
echo

echo "Step 2: Analyze recommendation quality"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "Questions to ask:"
echo "  • Are the recommendations relevant to the goal?"
echo "  • What are the Thompson Sampling scores?"
echo "  • What heuristic boosts are being applied?"
echo "  • Are there irrelevant templates being recommended?"
echo
echo "Looking at the recommendations above:"
echo

# Extract template IDs from recommendations
IRRELEVANT_IDS=$(grep -oP '(?<=\()[^)]+(?=\))' /tmp/baseline-recommendations.txt | head -3)

echo "Potentially irrelevant templates:"
for id in $IRRELEVANT_IDS; do
    echo "  • $id"
done
echo

read -p "Press Enter to continue to Step 3..."
echo

echo "Step 3: Demonstrate feedback mechanism (DRY RUN)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "To improve relevancy, you would:"
echo
echo "A. Penalize irrelevant templates:"
for id in $IRRELEVANT_IDS; do
    echo "   bun diagnostic-activity-api.ts feedback '$id' negative 1 \\"
    echo "     --reason 'not relevant for test analysis tasks'"
done
echo
echo "B. Search for and boost relevant templates:"
echo "   bun diagnostic-activity-api.ts list --category bugfix --limit 10"
echo "   # Find templates related to test analysis, error diagnosis, etc."
echo "   bun diagnostic-activity-api.ts feedback <relevant-template-id> positive 2 \\"
echo "     --reason 'relevant for test failure analysis'"
echo
echo "C. Use shape filtering to improve recommendations:"
echo "   bun diagnostic-activity-api.ts recommend '$TEST_GOAL' \\"
echo "     --shapes errorLog,testResult,activityExecutionTrace --limit 5"
echo
echo "D. Use category filtering:"
echo "   bun diagnostic-activity-api.ts recommend '$TEST_GOAL' \\"
echo "     --category bugfix --limit 5"
echo

read -p "Press Enter to see Step 4..."
echo

echo "Step 4: Verify improvements (simulation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "After applying feedback, re-run recommendations:"
echo "  bun diagnostic-activity-api.ts recommend '$TEST_GOAL' --limit 5"
echo
echo "Expected changes:"
echo "  • Previously irrelevant templates have lower scores"
echo "  • Boosted templates appear higher in rankings"
echo "  • Thompson Sampling adapts β (failure) parameters for penalized templates"
echo "  • Thompson Sampling adapts α (success) parameters for boosted templates"
echo
echo "Monitor over time:"
echo "  • As activities execute, success/failure data accumulates"
echo "  • Thompson Sampling automatically learns from execution outcomes"
echo "  • Manual feedback provides initial guidance"
echo "  • System converges on optimal recommendations through experience"
echo

read -p "Press Enter to continue to Step 5..."
echo

echo "Step 5: Shape-based improvement"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "Compare global vs shape-conditioned recommendations:"
echo

echo "Global (no shape filtering):"
bun diagnostic-activity-api.ts recommend "$TEST_GOAL" --limit 3 | grep "Thompson Score" | head -3
echo

echo "Shape-conditioned (with relevant shapes):"
bun diagnostic-activity-api.ts recommend "$TEST_GOAL" --shapes errorLog,testResult --limit 3 | grep "Thompson Score" | head -3
echo

echo "Note the score sources (global vs shape_conditioned) and how they differ."
echo

read -p "Press Enter for final summary..."
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ WORKFLOW SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "Recommendation Improvement Cycle:"
echo
echo "1. 📊 GET RECOMMENDATIONS"
echo "   bun diagnostic-activity-api.ts recommend '<goal>' --limit 5"
echo
echo "2. 🔍 ANALYZE QUALITY"
echo "   • Check relevancy"
echo "   • Review Thompson scores"
echo "   • Identify irrelevant templates"
echo
echo "3. 🎛️  APPLY FEEDBACK"
echo "   # Penalize bad recommendations"
echo "   bun diagnostic-activity-api.ts feedback <id> negative 1-3 --reason '<why>'"
echo "   "
echo "   # Boost good recommendations"
echo "   bun diagnostic-activity-api.ts feedback <id> positive 1-3 --reason '<why>'"
echo
echo "4. ✅ VERIFY IMPROVEMENTS"
echo "   bun diagnostic-activity-api.ts recommend '<goal>' --limit 5"
echo "   # Compare with baseline"
echo
echo "5. 🔄 ITERATE"
echo "   # Repeat as templates execute and accumulate data"
echo "   # Thompson Sampling learns from execution outcomes"
echo
echo "Advanced Techniques:"
echo "  • Use --shapes to filter by input impulse types"
echo "  • Use --category to filter by activity category"
echo "  • Use --output-shapes to match expected outcomes"
echo "  • Use --adjacent in feedback to affect composition neighbors"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "Known Issues:"
echo "  ❌ metrics command: Backend table 'activity_execution_task_result' missing"
echo "     → Should be fixed in backend schema migration"
echo
echo "  ⚠️  composition/graph commands: No edges exist yet"
echo "     → Normal for new system, will populate as activities compose"
echo

echo
echo "For more details, see: ACTIVITY_API_DIAGNOSTIC.md"
echo
