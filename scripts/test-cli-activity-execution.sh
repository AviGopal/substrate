#!/bin/bash
set -e

# Test CLI-based activity execution to capture context requirements tracing
# This script runs OpenCode in CLI mode to generate logs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_WORKSPACE="$PROJECT_ROOT/test-workspace/refactor-test"
OPENCODE_BIN="$PROJECT_ROOT/repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode"
LOG_DIR="$HOME/.local/share/opencode/logs"

echo "=========================================="
echo "CLI Activity Execution Test"
echo "Testing: Context Requirements Runtime Flow"
echo "=========================================="
echo ""

# 1. Clean old logs
echo "[1/5] Cleaning old logs..."
rm -f "$LOG_DIR"/opencode-*.log 2>/dev/null || true
echo "✓ Logs cleaned"
echo ""

# 2. Verify workspace
echo "[2/5] Verifying test workspace..."
cd "$TEST_WORKSPACE"
if [ ! -f "sample.ts" ]; then
    echo "✗ sample.ts not found!"
    exit 1
fi
echo "✓ Workspace ready: $(pwd)"
echo ""

# 3. Show activity prompt
echo "[3/5] Activity prompt:"
if [ -f ".opencode-prompt.md" ]; then
    cat .opencode-prompt.md | head -10
    echo "..."
else
    echo "✗ No prompt file found"
fi
echo ""

# 4. Instructions for manual execution
echo "[4/5] MANUAL EXECUTION REQUIRED:"
echo ""
echo "Run the following commands in a new terminal:"
echo ""
echo "  cd $TEST_WORKSPACE"
echo "  $OPENCODE_BIN"
echo ""
echo "Then in OpenCode CLI, execute:"
echo ""
echo '  activity({'
echo '    activityId: "refactor-72eb4607",'
echo '    variables: {'
echo '      target_file: "sample.ts",'
echo '      refactor_goal: "Convert to functional style",'
echo '      preserve_behavior: "true"'
echo '    },'
echo '    reason: "Test context requirements flow"'
echo '  })'
echo ""
echo "Or simply type your request and let the agent use the activity tool."
echo ""

# 5. Instructions for log analysis
echo "[5/5] After execution, analyze logs with:"
echo ""
echo "  grep 'CONTEXT_REQUIREMENTS_EXTRACTED' $LOG_DIR/opencode-*.log"
echo "  grep 'IMPULSE_CREATED' $LOG_DIR/opencode-*.log"
echo "  grep 'MEMORY_AGENT_COMPLETED' $LOG_DIR/opencode-*.log"
echo ""
echo "Or run:"
echo "  bash $SCRIPT_DIR/analyze-context-flow-logs.sh"
echo ""
echo "=========================================="
echo "Ready for CLI execution test"
echo "=========================================="
