#!/bin/bash
#
# Activity System Runtime Validation Harness
# 
# Purpose: Validate that all 8 lifecycle log patterns are visible in kubectl logs
#          when executing an activity in the DevBob pod.
#
# Specification: Activity System Runtime Validation with Complete Log Confirmation
#
# Expected Patterns (8 total):
#   1. Activity.*starting - Activity initialization with template metadata
#   2. Memory agent initializing - Context gathering start
#   3. Memory agent gathered.*impulses - Context gathering completion
#   4. Task starting: - Task execution start
#   5. Task completed: - Task execution completion with metrics
#   6. storage write confirmed - Persistence layer writes
#   7. Git commit created: - Git operations for activity
#   8. Activity completed: - Final activity summary with full metrics
#
# Usage: ./activity-system-runtime-validation-harness.sh [POD_NAME] [NAMESPACE]
#

set -e

# Configuration
POD="${1:-devbob-794b69b4f4-rhnwg}"
NAMESPACE="${2:-metabob}"
TIMESTAMP=$(date +%s)
LOG_FILE="validation-logs-${TIMESTAMP}.log"
REPORT_FILE="validation-report-${TIMESTAMP}.json"
TIMEOUT=180  # 3 minutes for activity execution

# Lifecycle log patterns to validate
declare -A PATTERNS=(
  ["activity_start"]="Activity.*starting"
  ["memory_init"]="Memory agent initializing"
  ["memory_complete"]="Memory agent gathered.*impulses"
  ["task_start"]="Task starting:"
  ["task_complete"]="Task completed:"
  ["storage_write"]="storage write confirmed"
  ["git_commit"]="Git commit created:"
  ["activity_complete"]="Activity completed:"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Main validation function
run_validation() {
  log_info "Starting Activity System Runtime Validation"
  log_info "Pod: ${POD}"
  log_info "Namespace: ${NAMESPACE}"
  log_info "Log file: ${LOG_FILE}"
  echo ""

  # Step 1: Verify pod is running
  log_info "Step 1/7: Verifying pod status..."
  if ! kubectl get pod -n "$NAMESPACE" "$POD" &>/dev/null; then
    log_error "Pod ${POD} not found in namespace ${NAMESPACE}"
    exit 1
  fi
  
  POD_STATUS=$(kubectl get pod -n "$NAMESPACE" "$POD" -o jsonpath='{.status.phase}')
  if [ "$POD_STATUS" != "Running" ]; then
    log_error "Pod is not running (status: ${POD_STATUS})"
    exit 1
  fi
  log_info "Pod is running ✓"
  echo ""

  # Step 2: Start log capture in background
  log_info "Step 2/7: Starting log capture..."
  kubectl logs -n "$NAMESPACE" "$POD" -f > "$LOG_FILE" 2>&1 &
  LOG_PID=$!
  log_info "Log capture started (PID: ${LOG_PID})"
  sleep 2
  echo ""

  # Step 3: Execute test activity
  log_info "Step 3/7: Executing test activity..."
  log_info "Command: opencode run 'Analyze the validation test and create a summary file'"
  
  ACTIVITY_START=$(date +%s)
  
  # Execute activity with timeout
  timeout "$TIMEOUT" kubectl exec -n "$NAMESPACE" "$POD" -- \
    sh -c 'echo "Analyze the test directory structure and create a summary file named analysis.txt" | opencode run' \
    > activity-execution.log 2>&1 || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
      log_warn "Activity execution timed out after ${TIMEOUT} seconds"
    else
      log_warn "Activity execution exited with code ${EXIT_CODE}"
    fi
  }
  
  ACTIVITY_END=$(date +%s)
  DURATION=$((ACTIVITY_END - ACTIVITY_START))
  log_info "Activity execution completed (${DURATION}s)"
  echo ""

  # Step 4: Wait for logs to flush
  log_info "Step 4/7: Waiting for logs to flush..."
  sleep 5
  echo ""

  # Step 5: Stop log capture
  log_info "Step 5/7: Stopping log capture..."
  kill $LOG_PID 2>/dev/null || true
  sleep 2
  
  # Also capture final state
  kubectl logs -n "$NAMESPACE" "$POD" --tail=1000 >> "$LOG_FILE" 2>&1 || true
  
  LOG_LINES=$(wc -l < "$LOG_FILE")
  log_info "Captured ${LOG_LINES} log lines"
  echo ""

  # Step 6: Validate lifecycle patterns
  log_info "Step 6/7: Validating lifecycle log patterns..."
  echo ""
  
  FOUND_COUNT=0
  TOTAL_PATTERNS=8
  
  declare -A RESULTS
  
  for key in "${!PATTERNS[@]}"; do
    pattern="${PATTERNS[$key]}"
    
    if grep -qE "$pattern" "$LOG_FILE"; then
      RESULTS[$key]="FOUND"
      FOUND_COUNT=$((FOUND_COUNT + 1))
      echo -e "  ${GREEN}✓${NC} Pattern '$key': ${pattern}"
    else
      RESULTS[$key]="MISSING"
      echo -e "  ${RED}✗${NC} Pattern '$key': ${pattern}"
    fi
  done
  
  echo ""
  log_info "Patterns found: ${FOUND_COUNT}/${TOTAL_PATTERNS}"
  echo ""

  # Step 7: Generate validation report
  log_info "Step 7/7: Generating validation report..."
  
  # Create JSON report
  cat > "$REPORT_FILE" << EOF
{
  "timestamp": ${TIMESTAMP},
  "specification": "Activity System Runtime Validation with Complete Log Confirmation",
  "pod": "${POD}",
  "namespace": "${NAMESPACE}",
  "execution": {
    "duration": ${DURATION},
    "timeout": ${TIMEOUT},
    "logLines": ${LOG_LINES}
  },
  "validation": {
    "totalPatterns": ${TOTAL_PATTERNS},
    "patternsFound": ${FOUND_COUNT},
    "patternsMissing": $((TOTAL_PATTERNS - FOUND_COUNT)),
    "results": {
      "activity_start": "${RESULTS[activity_start]:-MISSING}",
      "memory_init": "${RESULTS[memory_init]:-MISSING}",
      "memory_complete": "${RESULTS[memory_complete]:-MISSING}",
      "task_start": "${RESULTS[task_start]:-MISSING}",
      "task_complete": "${RESULTS[task_complete]:-MISSING}",
      "storage_write": "${RESULTS[storage_write]:-MISSING}",
      "git_commit": "${RESULTS[git_commit]:-MISSING}",
      "activity_complete": "${RESULTS[activity_complete]:-MISSING}"
    }
  },
  "files": {
    "logFile": "${LOG_FILE}",
    "executionLog": "activity-execution.log",
    "reportFile": "${REPORT_FILE}"
  }
}
EOF

  log_info "Report saved to: ${REPORT_FILE}"
  echo ""

  # Final result
  echo "=========================================="
  if [ $FOUND_COUNT -eq $TOTAL_PATTERNS ]; then
    echo -e "${GREEN}✓ VALIDATION PASSED${NC}"
    echo "All ${TOTAL_PATTERNS} lifecycle log patterns are visible"
    echo "=========================================="
    echo ""
    echo "Activity system runtime validation is COMPLETE with full observability."
    echo ""
    return 0
  else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo "Missing $((TOTAL_PATTERNS - FOUND_COUNT)) lifecycle log patterns"
    echo "=========================================="
    echo ""
    echo "Debugging information:"
    echo ""
    echo "1. Check captured logs:"
    echo "   cat ${LOG_FILE}"
    echo ""
    echo "2. Review activity execution:"
    echo "   cat activity-execution.log"
    echo ""
    echo "3. Sample of captured logs (first 50 lines):"
    head -50 "$LOG_FILE"
    echo ""
    echo "4. Search for specific patterns:"
    for key in "${!PATTERNS[@]}"; do
      if [ "${RESULTS[$key]}" == "MISSING" ]; then
        pattern="${PATTERNS[$key]}"
        echo "   grep -E '${pattern}' ${LOG_FILE}"
      fi
    done
    echo ""
    return 1
  fi
}

# Execute validation
run_validation

# Exit with appropriate code
if [ $? -eq 0 ]; then
  exit 0
else
  exit 1
fi
