#!/usr/bin/env bash
#
# Automated Validation Script
#
# Runs complete validation workflow:
# 1. Backend compatibility check
# 2. Rapid test suite (all scenarios)
# 3. Trace collection and validation
# 4. Metrics analysis
# 5. Validation gate checks
# 6. Report generation
#
# Usage:
#   ./sandbox/auto-validate.sh
#   ./sandbox/auto-validate.sh --check-backend
#   ./sandbox/auto-validate.sh --scenario simple
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINIBOB_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_DIR="$SCRIPT_DIR/workspace"
LOGS_DIR="$SCRIPT_DIR/logs"
REPORTS_DIR="$SCRIPT_DIR/reports"

BACKEND="${METABOB_ENDPOINT:-https://activity.metabob.com}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="$REPORTS_DIR/validation-$TIMESTAMP.json"
METRICS_FILE="$REPORTS_DIR/metrics-$TIMESTAMP.json"
TEXT_REPORT="$REPORTS_DIR/report-$TIMESTAMP.txt"

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Header
print_header() {
    echo ""
    echo "========================================================================"
    echo " MiniBob Automated Validation"
    echo "========================================================================"
    echo " Timestamp: $(date)"
    echo " Backend: $BACKEND"
    echo " Workspace: $WORKSPACE_DIR"
    echo "========================================================================"
    echo ""
}

# Check backend connectivity
check_backend() {
    log_info "Checking backend connectivity..."

    # Health check
    if ! curl -sf "$BACKEND/health" > /dev/null; then
        log_error "Backend health check failed"
        return 1
    fi
    log_success "Backend health: OK"

    # Authentication check
    if [ -z "$METABOB_API_KEY" ]; then
        log_error "METABOB_API_KEY not set"
        return 1
    fi

    local auth_response
    auth_response=$(curl -sf -H "Authorization: ApiKey $METABOB_API_KEY" "$BACKEND/v2/activities/templates" 2>&1)
    if [ $? -ne 0 ]; then
        log_error "Authentication failed"
        return 1
    fi
    log_success "Authentication: OK"

    # API version check
    local version
    version=$(echo "$auth_response" | jq -r '.api_version // "v2"' 2>/dev/null || echo "v2")
    log_success "API version: $version"

    return 0
}

# Run test scenario
run_scenario() {
    local scenario=$1
    log_info "Running scenario: $scenario"

    local output_file="$REPORTS_DIR/scenario-$scenario-$TIMESTAMP.json"

    if ! bun "$SCRIPT_DIR/rapid-test.ts" --scenario "$scenario" --output "$output_file" 2>&1 | tee -a "$LOGS_DIR/validation.log"; then
        log_error "Scenario failed: $scenario"
        return 1
    fi

    log_success "Scenario completed: $scenario"
    echo "$output_file"
    return 0
}

# Collect traces
collect_traces() {
    local scenario_report=$1
    log_info "Collecting traces from: $scenario_report"

    local trace_file="$REPORTS_DIR/traces-$TIMESTAMP.json"

    if ! bun "$SCRIPT_DIR/trace-pipeline.ts" --batch "$scenario_report" --output "$trace_file" 2>&1 | tee -a "$LOGS_DIR/validation.log"; then
        log_error "Trace collection failed"
        return 1
    fi

    log_success "Traces collected"
    echo "$trace_file"
    return 0
}

# Analyze metrics
analyze_metrics() {
    local trace_file=$1
    log_info "Analyzing metrics from: $trace_file"

    if ! bun "$SCRIPT_DIR/validation-metrics.ts" --traces "$trace_file" --output "$METRICS_FILE" --report "$TEXT_REPORT" 2>&1 | tee -a "$LOGS_DIR/validation.log"; then
        log_error "Metrics analysis failed"
        return 1
    fi

    log_success "Metrics analyzed"
    return 0
}

# Validation gate: Resolver coverage
check_resolver_coverage() {
    log_info "Checking resolver coverage..."

    local coverage
    coverage=$(jq -r '.resolvers | length' "$METRICS_FILE" 2>/dev/null || echo "0")

    local expected=6  # bash, file, git, validation, llm, activity
    if [ "$coverage" -ge "$expected" ]; then
        log_success "Resolver coverage: $coverage/$expected"
        return 0
    else
        log_warning "Resolver coverage: $coverage/$expected (expected >= $expected)"
        return 1
    fi
}

# Validation gate: Trace submission
check_trace_submission() {
    log_info "Checking trace submission..."

    local submitted
    submitted=$(jq -r '.summary.succeeded' "$METRICS_FILE" 2>/dev/null || echo "0")

    if [ "$submitted" -gt 0 ]; then
        log_success "Traces submitted: $submitted"
        return 0
    else
        log_error "No traces submitted"
        return 1
    fi
}

# Validation gate: Success rate
check_success_rate() {
    log_info "Checking overall success rate..."

    local rate
    rate=$(jq -r '.summary.successRate' "$METRICS_FILE" 2>/dev/null || echo "0")

    local threshold=0.8
    if (( $(echo "$rate >= $threshold" | bc -l) )); then
        log_success "Success rate: $(echo "$rate * 100" | bc -l | xargs printf "%.1f")%"
        return 0
    else
        log_warning "Success rate: $(echo "$rate * 100" | bc -l | xargs printf "%.1f")% (expected >= $(echo "$threshold * 100" | bc -l | xargs printf "%.0f")%)"
        return 1
    fi
}

# Generate final report
generate_report() {
    log_info "Generating final report..."

    cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "backend": "$BACKEND",
  "scenarios_run": $(find "$REPORTS_DIR" -name "scenario-*-$TIMESTAMP.json" | wc -l),
  "validation_gates": {
    "backend_connectivity": $([[ $gate_backend_ok == "true" ]] && echo "true" || echo "false"),
    "resolver_coverage": $([[ $gate_coverage_ok == "true" ]] && echo "true" || echo "false"),
    "trace_submission": $([[ $gate_submission_ok == "true" ]] && echo "true" || echo "false"),
    "success_rate": $([[ $gate_success_ok == "true" ]] && echo "true" || echo "false")
  },
  "metrics_file": "$METRICS_FILE",
  "text_report": "$TEXT_REPORT",
  "logs": "$LOGS_DIR/validation.log"
}
EOF

    log_success "Report generated: $REPORT_FILE"

    # Display summary
    echo ""
    echo "========================================================================"
    echo " VALIDATION SUMMARY"
    echo "========================================================================"
    cat "$TEXT_REPORT" 2>/dev/null || echo "(No text report generated)"
    echo "========================================================================"
    echo ""
}

# Main
main() {
    local check_only=false
    local scenario_only=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --check-backend)
                check_only=true
                shift
                ;;
            --scenario)
                scenario_only="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --check-backend    Only check backend connectivity"
                echo "  --scenario NAME    Run only specified scenario"
                echo "  --help            Show this help"
                echo ""
                echo "Scenarios: simple, complex, bootstrap, resolver, state_navigation"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    print_header

    # Create directories
    mkdir -p "$WORKSPACE_DIR" "$LOGS_DIR" "$REPORTS_DIR"

    # Clear old log
    > "$LOGS_DIR/validation.log"

    # Check backend connectivity
    gate_backend_ok="false"
    if check_backend; then
        gate_backend_ok="true"
    else
        log_error "Backend connectivity check failed"
        exit 1
    fi

    if [ "$check_only" = true ]; then
        log_success "Backend check completed"
        exit 0
    fi

    # Determine scenarios to run
    local scenarios=()
    if [ -n "$scenario_only" ]; then
        scenarios=("$scenario_only")
    else
        scenarios=("simple" "complex" "bootstrap" "resolver" "state_navigation")
    fi

    # Run scenarios
    local scenario_reports=()
    for scenario in "${scenarios[@]}"; do
        if report_file=$(run_scenario "$scenario"); then
            scenario_reports+=("$report_file")
        else
            log_error "Scenario failed: $scenario"
        fi
    done

    if [ ${#scenario_reports[@]} -eq 0 ]; then
        log_error "No scenarios completed successfully"
        exit 1
    fi

    # Collect traces from all scenarios
    local trace_files=()
    for report in "${scenario_reports[@]}"; do
        if trace_file=$(collect_traces "$report"); then
            trace_files+=("$trace_file")
        fi
    done

    if [ ${#trace_files[@]} -eq 0 ]; then
        log_error "No traces collected"
        exit 1
    fi

    # Merge trace files (use first one for now)
    local merged_traces="${trace_files[0]}"

    # Analyze metrics
    if ! analyze_metrics "$merged_traces"; then
        log_error "Metrics analysis failed"
        exit 1
    fi

    # Run validation gates
    gate_coverage_ok="false"
    if check_resolver_coverage; then
        gate_coverage_ok="true"
    fi

    gate_submission_ok="false"
    if check_trace_submission; then
        gate_submission_ok="true"
    fi

    gate_success_ok="false"
    if check_success_rate; then
        gate_success_ok="true"
    fi

    # Generate report
    generate_report

    # Exit with appropriate code
    if [[ $gate_backend_ok == "true" ]] && \
       [[ $gate_coverage_ok == "true" ]] && \
       [[ $gate_submission_ok == "true" ]] && \
       [[ $gate_success_ok == "true" ]]; then
        log_success "All validation gates passed"
        exit 0
    else
        log_error "One or more validation gates failed"
        exit 1
    fi
}

# Run main
main "$@"
