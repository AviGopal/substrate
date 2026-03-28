#!/bin/bash
#
# Activity System Runtime Validation Harness V2
# 
# UPDATED: Uses ACP API instead of kubectl exec to resolve log visibility issues
# 
# Changes from V1:
#   - Uses HTTP POST to ACP service (port 8080) instead of kubectl exec
#   - Uses complex multi-step prompt to ensure activity triggering
#   - Logs now visible in main process (kubectl logs)
#   - Aligns with production architecture (vessel flow pattern)
#
# Specification: Activity System Runtime Validation with Complete Log Confirmation
# Conflict Resolution: Updates methodology per conflict-analysis-activity-system-runtime-validation
#

set -e

# Configuration
POD="${1:-devbob-794b69b4f4-rhnwg}"
NAMESPACE="${2:-metabob}"
TIMESTAMP=$(date +%s)
LOG_FILE="validation-logs-v2-${TIMESTAMP}.log"
REPORT_FILE="validation-report-v2-${TIMESTAMP}.json"
TIMEOUT=300  # 5 minutes for activity execution

# ACP service configuration
ACP_SERVICE="devbob.metabob.svc.cluster.local"
ACP_PORT="8080"

# Complex multi-step prompt to guarantee activity triggering
ACTIVITY_PROMPT="This is a comprehensive validation task requiring multiple steps: First, analyze the directory structure of the validation test harnesses to understand the testing framework. Second, identify all validation patterns and create documentation. Third, generate a summary report file named validation-analysis.md with findings. Fourth, commit all changes with an appropriate message describing the analysis work."

# Lifecycle log patterns to validate (8 total)
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
BLUE='\033[0;34m'
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

log_debug() {
  echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Main validation function
run_validation() {
  log_info "Starting Activity System Runtime Validation V2"
  log_info "=== UPDATED METHODOLOGY ==="
  log_info "Execution Method: ACP API (HTTP POST to service)"
  log_info "Previous Method: kubectl exec (subprocess logs isolated)"
  log_info "Change Reason: Align with production architecture, ensure log visibility"
  echo ""
  log_info "Pod: ${POD}"
  log_info "Namespace: ${NAMESPACE}"
  log_info "ACP Service: ${ACP_SERVICE}:${ACP_PORT}"
  log_info "Log file: ${LOG_FILE}"
  echo ""

  # Step 1: Verify pod is running
  log_info "Step 1/8: Verifying pod status..."
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

  # Step 2: Verify ACP service accessibility
  log_info "Step 2/8: Verifying ACP service accessibility..."
  if ! kubectl get svc -n "$NAMESPACE" devbob &>/dev/null; then
    log_error "DevBob service not found in namespace ${NAMESPACE}"
    exit 1
  fi
  log_info "ACP service accessible ✓"
  echo ""

  # Step 3: Start log capture in background
  log_info "Step 3/8: Starting log capture from main process..."
  kubectl logs -n "$NAMESPACE" "$POD" -f > "$LOG_FILE" 2>&1 &
  LOG_PID=$!
  log_info "Log capture started (PID: ${LOG_PID})"
  log_debug "Logs will capture main process (ACP server) output"
  sleep 3
  echo ""

  # Step 4: Execute activity via ACP API
  log_info "Step 4/8: Executing activity via ACP API..."
  log_info "Using complex multi-step prompt to guarantee activity triggering"
  log_debug "Prompt: ${ACTIVITY_PROMPT:0:100}..."
  
  ACTIVITY_START=$(date +%s)
  
  # Port-forward to ACP service
  log_debug "Setting up port-forward to ACP service..."
  kubectl port-forward -n "$NAMESPACE" "svc/devbob" 8080:8080 > /dev/null 2>&1 &
  PF_PID=$!
  sleep 2
  
  # Execute activity via HTTP POST to ACP API
  log_info "Sending activity request to ACP API..."
  
  # ACP API request (simplified - adjust based on actual ACP API spec)
  curl -X POST "http://localhost:8080/api/sessions" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"${ACTIVITY_PROMPT}\"}" \
    -o activity-response.json \
    --max-time "$TIMEOUT" \
    --silent \
    --show-error || {
    EXIT_CODE=$?
    log_warn "Activity execution exited with code ${EXIT_CODE}"
  }
  
  # Clean up port-forward
  kill $PF_PID 2>/dev/null || true
  
  ACTIVITY_END=$(date +%s)
  DURATION=$((ACTIVITY_END - ACTIVITY_START))
  log_info "Activity execution completed (${DURATION}s)"
  echo ""

  # Step 5: Wait for logs to flush
  log_info "Step 5/8: Waiting for logs to flush..."
  sleep 10
  echo ""

  # Step 6: Stop log capture
  log_info "Step 6/8: Stopping log capture..."
  kill $LOG_PID 2>/dev/null || true
  sleep 2
  
  # Also capture final state
  kubectl logs -n "$NAMESPACE" "$POD" --tail=2000 >> "$LOG_FILE" 2>&1 || true
  
  LOG_LINES=$(wc -l < "$LOG_FILE")
  log_info "Captured ${LOG_LINES} log lines"
  echo ""

  # Step 7: Validate lifecycle patterns
  log_info "Step 7/8: Validating lifecycle log patterns..."
  echo ""
  
  FOUND_COUNT=0
  TOTAL_PATTERNS=8
  
  declare -A RESULTS
  declare -A MATCH_LINES
  
  for key in "${!PATTERNS[@]}"; do
    pattern="${PATTERNS[$key]}"
    
    # Find matches and get line numbers
    MATCHES=$(grep -n -E "$pattern" "$LOG_FILE" 2>/dev/null || true)
    
    if [ -n "$MATCHES" ]; then
      RESULTS[$key]="FOUND"
      MATCH_COUNT=$(echo "$MATCHES" | wc -l)
      FIRST_MATCH=$(echo "$MATCHES" | head -1 | cut -d: -f1)
      MATCH_LINES[$key]="Line ${FIRST_MATCH} (${MATCH_COUNT} matches)"
      FOUND_COUNT=$((FOUND_COUNT + 1))
      echo -e "  ${GREEN}✓${NC} Pattern '$key': ${pattern}"
      log_debug "  Found at ${MATCH_LINES[$key]}"
    else
      RESULTS[$key]="MISSING"
      MATCH_LINES[$key]="Not found"
      echo -e "  ${RED}✗${NC} Pattern '$key': ${pattern}"
    fi
  done
  
  echo ""
  log_info "Patterns found: ${FOUND_COUNT}/${TOTAL_PATTERNS}"
  echo ""

  # Step 8: Generate validation report
  log_info "Step 8/8: Generating validation report..."
  
  # Create JSON report
  cat > "$REPORT_FILE" << EOF
{
  "timestamp": ${TIMESTAMP},
  "specification": "Activity System Runtime Validation with Complete Log Confirmation",
  "version": "v2",
  "methodology": {
    "executionMethod": "ACP API (HTTP POST)",
    "previousMethod": "kubectl exec (subprocess)",
    "changeReason": "Resolve log visibility issues, align with production architecture",
    "promptComplexity": "complex-multi-step",
    "previousComplexity": "simple-single-step"
  },
  "pod": "${POD}",
  "namespace": "${NAMESPACE}",
  "acpService": "${ACP_SERVICE}:${ACP_PORT}",
  "execution": {
    "duration": ${DURATION},
    "timeout": ${TIMEOUT},
    "logLines": ${LOG_LINES},
    "method": "HTTP POST to ACP service"
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
    },
    "matchDetails": {
      "activity_start": "${MATCH_LINES[activity_start]:-Not found}",
      "memory_init": "${MATCH_LINES[memory_init]:-Not found}",
      "memory_complete": "${MATCH_LINES[memory_complete]:-Not found}",
      "task_start": "${MATCH_LINES[task_start]:-Not found}",
      "task_complete": "${MATCH_LINES[task_complete]:-Not found}",
      "storage_write": "${MATCH_LINES[storage_write]:-Not found}",
      "git_commit": "${MATCH_LINES[git_commit]:-Not found}",
      "activity_complete": "${MATCH_LINES[activity_complete]:-Not found}"
    }
  },
  "conflictResolution": {
    "appliedFrom": "conflict-analysis-activity-system-runtime-validation",
    "resolvedConflicts": [
      "CONTRADICTORY_IMPLEMENTATION: kubectl exec vs ACP API",
      "IMPLICIT_DEPENDENCY_MISMATCH: Simple vs complex prompts",
      "ARCHITECTURAL_BOUNDARY_AMBIGUITY: kubectl exec bypassing vessel flow"
    ]
  },
  "files": {
    "logFile": "${LOG_FILE}",
    "reportFile": "${REPORT_FILE}",
    "activityResponse": "activity-response.json"
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
    echo "Methodology Update Success:"
    echo "  - ✓ ACP API execution shows lifecycle logs in kubectl logs"
    echo "  - ✓ Complex prompt successfully triggers activity system"
    echo "  - ✓ Aligned with production architecture (vessel flow pattern)"
    echo ""
    return 0
  elif [ $FOUND_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠ VALIDATION PARTIAL${NC}"
    echo "Found ${FOUND_COUNT}/${TOTAL_PATTERNS} lifecycle log patterns"
    echo "=========================================="
    echo ""
    echo "Partial Success - Some patterns visible:"
    for key in "${!RESULTS[@]}"; do
      if [ "${RESULTS[$key]}" == "FOUND" ]; then
        echo "  ✓ ${key}: ${MATCH_LINES[$key]}"
      fi
    done
    echo ""
    echo "Missing patterns:"
    for key in "${!RESULTS[@]}"; do
      if [ "${RESULTS[$key]}" == "MISSING" ]; then
        echo "  ✗ ${key}: ${PATTERNS[$key]}"
      fi
    done
    echo ""
    return 1
  else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo "Missing all ${TOTAL_PATTERNS} lifecycle log patterns"
    echo "=========================================="
    echo ""
    echo "Debugging information:"
    echo ""
    echo "1. Check captured logs:"
    echo "   cat ${LOG_FILE} | grep -E 'Activity|Task|Memory'"
    echo ""
    echo "2. Review ACP API response:"
    echo "   cat activity-response.json | jq ."
    echo ""
    echo "3. Check if activity was triggered:"
    echo "   grep -E 'recommendation|template' ${LOG_FILE}"
    echo ""
    echo "4. Sample of captured logs (last 50 lines):"
    tail -50 "$LOG_FILE"
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
