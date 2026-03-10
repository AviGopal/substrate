#!/bin/bash
# Runtime validation for Activity System Complete Execution Lifecycle
# This version executes activity and captures output directly

POD_NAME="devbob-794b69b4f4-dxr4q"
NAMESPACE="metabob"
TEMPLATE_ID="trace-data-flow-single-feature"
LOG_FILE="./activity-runtime-logs-$(date +%s).txt"

echo "════════════════════════════════════════════════════════════"
echo "  Activity System Complete Execution Lifecycle - Runtime Test v2"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Pod: $POD_NAME"
echo "Namespace: $NAMESPACE"
echo "Template: $TEMPLATE_ID"
echo "Log file: $LOG_FILE"
echo ""

# Execute activity and capture ALL output (stdout + stderr)
echo "Executing activity..."
echo ""
echo "Command:"
echo "  kubectl exec -it -n $NAMESPACE $POD_NAME -- \\"
echo "    sh -c 'opencode run \"%$TEMPLATE_ID Validate lifecycle logs\" 2>&1'"
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""

kubectl exec -it -n $NAMESPACE $POD_NAME -- \
  sh -c "opencode run '%$TEMPLATE_ID Validate lifecycle logs' 2>&1" \
  | tee "$LOG_FILE"

EXEC_EXIT_CODE=$?

echo ""
echo "────────────────────────────────────────────────────────────"
echo "Activity execution completed with exit code: $EXEC_EXIT_CODE"
echo ""

# Analyze logs for expected patterns
echo "════════════════════════════════════════════════════════════"
echo "  Analyzing Lifecycle Logs"
echo "════════════════════════════════════════════════════════════"
echo ""

declare -a patterns=(
  "Activity:.*starting"
  "Memory agent initializing"
  "Memory agent gathered"
  "Task starting:"
  "Task completed:"
  "Git commit created:"
  "storage write confirmed"
  "Activity completed:"
)

declare -a descriptions=(
  "Activity Start Log"
  "Memory Agent Init"
  "Memory Agent Complete"
  "Task Start"
  "Task Complete"
  "Git Commit"
  "Storage Persistence"
  "Activity Complete"
)

passed=0
failed=0
missing_patterns=()

for i in "${!patterns[@]}"; do
  pattern="${patterns[$i]}"
  desc="${descriptions[$i]}"
  
  if grep -E "$pattern" "$LOG_FILE" >/dev/null 2>&1; then
    echo "✅ [$desc] Found"
    # Show first matching line (truncated)
    match=$(grep -E "$pattern" "$LOG_FILE" | head -1 | cut -c1-100)
    echo "   → $match"
    ((passed++))
  else
    echo "❌ [$desc] Missing pattern: $pattern"
    ((failed++))
    missing_patterns+=("$desc")
  fi
  echo ""
done

# Additional checks
echo "════════════════════════════════════════════════════════════"
echo "  Additional Checks"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check for errors
error_count=$(grep -ci "error\|failed\|exception" "$LOG_FILE" 2>/dev/null || echo "0")
if [ "$error_count" -gt 0 ]; then
  echo "⚠️  Found $error_count potential errors in logs"
  echo ""
  echo "Sample errors:"
  grep -i "error\|failed\|exception" "$LOG_FILE" | head -5 | sed 's/^/   /'
else
  echo "✅ No errors detected"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  RESULTS"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Lifecycle Logs: $passed / ${#patterns[@]} patterns found"
echo "Missing patterns: ${#missing_patterns[@]}"
echo ""

if [ ${#missing_patterns[@]} -gt 0 ]; then
  echo "Missing:"
  for missing in "${missing_patterns[@]}"; do
    echo "  - $missing"
  done
  echo ""
fi

echo "Full logs saved to: $LOG_FILE"
echo ""

if [ $failed -eq 0 ]; then
  echo "✅ VALIDATION PASSED - All lifecycle logs confirmed"
  exit 0
else
  echo "❌ VALIDATION FAILED - Some logs missing"
  echo ""
  echo "Debugging tips:"
  echo "  1. Check if activity actually ran:"
  echo "     grep -i 'activity' $LOG_FILE"
  echo "  2. Look for the 8 log patterns manually:"
  echo "     grep -E 'Activity.*starting|Task starting|Task completed|Activity completed' $LOG_FILE"
  echo "  3. Check if there were errors that prevented execution:"
  echo "     grep -i error $LOG_FILE"
  exit 1
fi
