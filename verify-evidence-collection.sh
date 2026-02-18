#!/bin/bash
# Verification script for correctness validation system
# Run this after restarting OpenCode to verify changes are active

set -e

ACTIVITY_DIR="$HOME/.local/share/opencode/storage/activity"
REPO_DIR="/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode"

echo "================================================"
echo "Correctness Validation - Verification Script"
echo "================================================"
echo ""

# Check 1: Verify code changes are present
echo "✓ Check 1: Verify code changes in files"
if grep -q "executionEvidence" "$REPO_DIR/packages/opencode/src/tool/activity.ts"; then
    echo "  ✅ Evidence initialization code present in activity.ts"
else
    echo "  ❌ Evidence initialization code NOT FOUND"
    exit 1
fi

if [ -f "$REPO_DIR/packages/opencode/src/session/activity-correctness.ts" ]; then
    echo "  ✅ Verdict computation module exists (activity-correctness.ts)"
else
    echo "  ❌ Verdict computation module NOT FOUND"
    exit 1
fi

# Check 2: Find the most recent activity
echo ""
echo "✓ Check 2: Find most recent activity"
LATEST_ACTIVITY=$(ls -t "$ACTIVITY_DIR"/*.json 2>/dev/null | head -1)
if [ -z "$LATEST_ACTIVITY" ]; then
    echo "  ❌ No activities found in $ACTIVITY_DIR"
    exit 1
fi
echo "  ✅ Latest activity: $(basename $LATEST_ACTIVITY)"

# Check 3: Verify evidence fields exist
echo ""
echo "✓ Check 3: Check for evidence fields"
HAS_EXEC_EVIDENCE=$(cat "$LATEST_ACTIVITY" | grep -c '"executionEvidence"' || true)
HAS_WORK_ARTIFACTS=$(cat "$LATEST_ACTIVITY" | grep -c '"workArtifacts"' || true)
HAS_VERDICT=$(cat "$LATEST_ACTIVITY" | grep -c '"correctnessVerdict"' || true)

if [ "$HAS_EXEC_EVIDENCE" -gt 0 ]; then
    echo "  ✅ executionEvidence field present"
else
    echo "  ⚠️  executionEvidence field MISSING (may be from old session)"
fi

if [ "$HAS_WORK_ARTIFACTS" -gt 0 ]; then
    echo "  ✅ workArtifacts field present"
else
    echo "  ⚠️  workArtifacts field MISSING (may be from old session)"
fi

if [ "$HAS_VERDICT" -gt 0 ]; then
    echo "  ✅ correctnessVerdict field present"
else
    echo "  ⚠️  correctnessVerdict field MISSING (may be from old session)"
fi

# Check 4: Display evidence content
echo ""
echo "✓ Check 4: Evidence content summary"
if command -v jq &> /dev/null; then
    echo "  Sessions spawned: $(cat "$LATEST_ACTIVITY" | jq '.executionEvidence.sessionsSpawned | length' 2>/dev/null || echo 'N/A')"
    echo "  Files changed: $(cat "$LATEST_ACTIVITY" | jq '.workArtifacts.filesChanged | length' 2>/dev/null || echo 'N/A')"
    echo "  Verdict: $(cat "$LATEST_ACTIVITY" | jq -r '.correctnessVerdict.verdict' 2>/dev/null || echo 'N/A')"
    echo "  Confidence: $(cat "$LATEST_ACTIVITY" | jq -r '.correctnessVerdict.confidence' 2>/dev/null || echo 'N/A')"
else
    echo "  (Install 'jq' for detailed summary)"
fi

# Check 5: Check OpenCode process age
echo ""
echo "✓ Check 5: OpenCode process status"
OPENCODE_PID=$(ps aux | grep "bun run.*opencode" | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$OPENCODE_PID" ]; then
    PROCESS_START=$(ps -p "$OPENCODE_PID" -o lstart= 2>/dev/null || echo "Unknown")
    echo "  Process PID: $OPENCODE_PID"
    echo "  Started: $PROCESS_START"
    
    # Check if started recently (within last hour)
    START_TIME=$(date -d "$PROCESS_START" +%s 2>/dev/null || echo 0)
    CURRENT_TIME=$(date +%s)
    AGE_HOURS=$(( (CURRENT_TIME - START_TIME) / 3600 ))
    
    if [ "$AGE_HOURS" -lt 1 ]; then
        echo "  ✅ Process is fresh (started within last hour)"
    else
        echo "  ⚠️  Process is $AGE_HOURS hours old (may have old code cached)"
        echo "     Consider restarting OpenCode"
    fi
else
    echo "  ⚠️  OpenCode process not found"
fi

# Summary
echo ""
echo "================================================"
echo "Summary"
echo "================================================"

if [ "$HAS_EXEC_EVIDENCE" -gt 0 ] && [ "$HAS_WORK_ARTIFACTS" -gt 0 ]; then
    echo "✅ SUCCESS: Evidence collection is working!"
    echo ""
    echo "Next steps:"
    echo "  1. Run more activities to collect evidence"
    echo "  2. Check for silent failures (verdict: 'suspicious' or 'incorrect')"
    echo "  3. Review CORRECTNESS_VALIDATION_READY_TO_TEST.md for details"
else
    echo "⚠️  WARNING: Evidence fields missing from latest activity"
    echo ""
    echo "This likely means:"
    echo "  - Activity was created before OpenCode restart"
    echo "  - OpenCode needs to be restarted to pick up changes"
    echo ""
    echo "To fix:"
    echo "  1. Restart OpenCode: kill $OPENCODE_PID && cd $REPO_DIR && npm run dev"
    echo "  2. Run a new test activity"
    echo "  3. Run this script again"
fi

echo ""
echo "For detailed information, see:"
echo "  - CORRECTNESS_VALIDATION_READY_TO_TEST.md"
echo "  - CORRECTNESS_VALIDATION_ROOT_CAUSE_FOUND.md"
echo ""
