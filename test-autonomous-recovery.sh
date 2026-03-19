#!/bin/bash
# Simple test for autonomous recovery
# Test: Request a non-existent template and watch autonomous recovery create it

set -e

PROJECT_ROOT="/home/avi/documents/work/exp-repo/metabob-devbob"
OPENCODE_BIN="$PROJECT_ROOT/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode"
LOG_FILE="$PROJECT_ROOT/test-results/autonomous-recovery-test-$(date +%s).log"

mkdir -p "$PROJECT_ROOT/test-results"

echo "====================================================================="
echo "Autonomous Recovery Manual Test"
echo "====================================================================="
echo ""
echo "Test: Request template 'fix-authentication-timeout-bug'"
echo "Expected: Autonomous recovery creates template automatically"
echo ""
echo "Log file: $LOG_FILE"
echo ""

# Create a simple test prompt
TEST_PROMPT=$(cat <<'PROMPT'
Please use the activity template "fix-authentication-timeout-bug" to fix a timeout issue in the authentication module.

The bug is in src/auth/timeout.ts where requests timeout after 5 seconds instead of 30 seconds.

Variables:
- bugDescription: "Authentication requests timing out after 5s"
- file: "src/auth/timeout.ts"  
- expectedFix: "Increase timeout to 30 seconds"
PROMPT
)

echo "Executing test..."
echo "----------------"

# Run the test (this will trigger autonomous recovery if template doesn't exist)
"$OPENCODE_BIN" --log-level=debug <<< "$TEST_PROMPT" 2>&1 | tee "$LOG_FILE"

echo ""
echo "====================================================================="
echo "Analyzing results..."
echo "====================================================================="
echo ""

# Check for autonomous recovery indicators
if grep -q "goal inferred" "$LOG_FILE" || grep -q "GoalInferenceEngine" "$LOG_FILE"; then
    echo "✅ Goal inference triggered"
else
    echo "❌ Goal inference NOT detected"
fi

if grep -q "template created" "$LOG_FILE" || grep -q "create_activity_goal_seeking" "$LOG_FILE"; then
    echo "✅ Template creation attempted"
else
    echo "❌ Template creation NOT detected"
fi

if grep -q "autonomous recovery" "$LOG_FILE"; then
    echo "✅ Autonomous recovery activated"
else
    echo "❌ Autonomous recovery NOT activated"
fi

echo ""
echo "Full log saved to: $LOG_FILE"
echo "Review the log for detailed trace of autonomous recovery flow"
