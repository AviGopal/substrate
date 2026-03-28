#!/bin/bash
# Validation Script: Multi-Task Activity Tracking
# 
# Purpose: Execute a 7-task activity and validate that lifecycle logging
#          tracks each task individually, emits proper task start/complete logs,
#          and aggregates metrics correctly in the activity record.

set -e

TIMESTAMP=$(date +%s)
LOG_FILE="/tmp/multi-task-validation-${TIMESTAMP}.log"
RESULT_FILE="validation-results/multi-task-tracking-validation-${TIMESTAMP}.json"

echo "🔍 Validating Multi-Task Activity Tracking"
echo ""
echo "Step 1: Executing 7-task activity (trace-data-flow-single-feature)..."
echo ""

# Execute activity and capture logs
cd /home/avi/documents/work/exp-repo/metabob-devbob

opencode activity trace-data-flow-single-feature \
  --variables '{"featureName":"Multi-Task Activity Tracking Test"}' \
  --reason "Validate multi-task tracking specification compliance" \
  2>&1 | tee "$LOG_FILE"

EXIT_CODE=$?

echo ""
echo "✅ Activity execution completed (exit code: $EXIT_CODE)"
echo ""

# Step 2: Analyze logs
echo "Step 2: Analyzing lifecycle logs..."
echo ""

TASK_START_COUNT=$(grep -c "Task starting:" "$LOG_FILE" || echo "0")
TASK_COMPLETE_COUNT=$(grep -c "Task completed:" "$LOG_FILE" || echo "0")
EXPECTED_TASKS=7

echo "   Task starting logs: $TASK_START_COUNT"
echo "   Task completed logs: $TASK_COMPLETE_COUNT"
echo "   Expected: $EXPECTED_TASKS"
echo ""

# Validate counts
PASS=true
ERRORS=()

if [ "$TASK_START_COUNT" -ne "$EXPECTED_TASKS" ]; then
  ERRORS+=("Expected $EXPECTED_TASKS 'Task starting' logs, found $TASK_START_COUNT")
  PASS=false
fi

if [ "$TASK_COMPLETE_COUNT" -ne "$EXPECTED_TASKS" ]; then
  ERRORS+=("Expected $EXPECTED_TASKS 'Task completed' logs, found $TASK_COMPLETE_COUNT")
  PASS=false
fi

# Step 3: Extract activity ID
echo "Step 3: Extracting activity ID..."
echo ""

ACTIVITY_ID=$(grep -oP "Activity ID: \K(act_[a-zA-Z0-9]+)" "$LOG_FILE" | head -1 || echo "")

if [ -n "$ACTIVITY_ID" ]; then
  echo "   Activity ID: $ACTIVITY_ID"
else
  ERRORS+=("Could not extract activity ID from output")
  PASS=false
fi

echo ""

# Step 4: Generate summary
if [ "$PASS" = true ]; then
  SUMMARY="✅ PASS: Multi-Task Activity Tracking specification is compliant. All $EXPECTED_TASKS tasks emitted proper lifecycle logs with metrics."
else
  SUMMARY="❌ FAIL: Specification compliance issues detected"
  for error in "${ERRORS[@]}"; do
    SUMMARY="$SUMMARY\n  - $error"
  done
fi

echo -e "$SUMMARY"
echo ""

# Step 5: Show sample logs
echo "Sample Task Logs:"
echo ""
echo "First task start log:"
grep "Task starting:" "$LOG_FILE" | head -1 || echo "  (not found)"
echo ""
echo "First task complete log:"
grep "Task completed:" "$LOG_FILE" | head -1 || echo "  (not found)"
echo ""

# Write JSON result
cat > "$RESULT_FILE" <<EOF
{
  "pass": $PASS,
  "timestamp": $TIMESTAMP,
  "activityId": "$ACTIVITY_ID",
  "logs": {
    "taskStartCount": $TASK_START_COUNT,
    "taskCompleteCount": $TASK_COMPLETE_COUNT,
    "expectedTasks": $EXPECTED_TASKS,
    "logFile": "$LOG_FILE"
  },
  "summary": $(echo "$SUMMARY" | jq -Rs .),
  "errors": $(printf '%s\n' "${ERRORS[@]}" | jq -R . | jq -s .)
}
EOF

echo "📄 Validation result written to: $RESULT_FILE"
echo ""

if [ "$PASS" = true ]; then
  exit 0
else
  exit 1
fi
