#!/bin/bash

# Chaos Testing Script for MiniBob Activities
# Injects faults, detects failures, creates variants, and validates recovery

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CHAOS_FILE="$PROJECT_DIR/chaos/chaos-scenarios.json"
RESULTS_DIR="$PROJECT_DIR/chaos/results"
FAULTS_DIR="$PROJECT_DIR/chaos/fault-reports"
VARIANTS_DIR="$PROJECT_DIR/activities/autonomous-loop/variants"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $*"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] !${NC} $*"
}

log_phase() {
    echo -e "${MAGENTA}[$(date '+%H:%M:%S')] ▶${NC} $*"
}

# Ensure directories exist
mkdir -p "$RESULTS_DIR" "$FAULTS_DIR" "$VARIANTS_DIR"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed"
    exit 1
fi

# Check if chaos file exists
if [ ! -f "$CHAOS_FILE" ]; then
    log_error "Chaos scenarios file not found: $CHAOS_FILE"
    exit 1
fi

# Get available scenarios
list_scenarios() {
    echo "Available chaos scenarios:"
    echo ""
    jq -r '.scenarios[] | "  \(.id) - \(.name) [\(.severity)]"' "$CHAOS_FILE"
    echo ""
    echo "Use: $0 <scenario-id> or $0 all"
}

# Inject chaos for a specific test case
inject_chaos() {
    local scenario_id="$1"
    local test_case="$2"
    local activity="$3"
    local inject_data="$4"

    log_phase "Injecting chaos: $scenario_id / $test_case"

    # Parse injection parameters
    local repo_path=$(echo "$inject_data" | jq -r '.repository_path // empty')
    local target_file=$(echo "$inject_data" | jq -r '.target_file // empty')
    local delete_file=$(echo "$inject_data" | jq -r '.delete_file // empty')
    local corrupt_json=$(echo "$inject_data" | jq -r '.file_content // empty')

    # Apply fault injection based on type
    if [ -n "$delete_file" ]; then
        log "  Deleting file: $delete_file"
        if [ -f "$delete_file" ]; then
            mv "$delete_file" "${delete_file}.backup"
        fi
    fi

    if [ -n "$corrupt_json" ]; then
        log "  Creating corrupted JSON file"
        local specs_file=$(echo "$inject_data" | jq -r '.specifications_file // "/tmp/corrupted-specs.json"')
        echo "$corrupt_json" > "$specs_file"
    fi

    # Build activity execution command with injected faults
    local cmd="minibob --single \"Execute $activity"

    if [ -n "$repo_path" ]; then
        cmd="$cmd on repository $repo_path"
    fi

    if [ -n "$target_file" ]; then
        cmd="$cmd with target_file $target_file"
    fi

    cmd="$cmd\""

    # Execute activity with fault injection
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local result_file="$RESULTS_DIR/${scenario_id}-${test_case}-${timestamp}.json"

    log "  Executing activity: $activity"
    if eval "$cmd" > "$result_file" 2>&1; then
        log_warning "  Activity succeeded despite chaos injection (unexpected)"
        echo "success" > "${result_file}.status"

        # Cleanup injected faults
        cleanup_injections "$inject_data"

        return 0
    else
        log_error "  Activity failed as expected"
        echo "failed" > "${result_file}.status"

        # Cleanup injected faults
        cleanup_injections "$inject_data"

        return 1
    fi
}

# Cleanup injected faults
cleanup_injections() {
    local inject_data="$1"

    local delete_file=$(echo "$inject_data" | jq -r '.delete_file // empty')

    if [ -n "$delete_file" ] && [ -f "${delete_file}.backup" ]; then
        log "  Restoring deleted file"
        mv "${delete_file}.backup" "$delete_file"
    fi
}

# Detect faults from execution failure
detect_fault() {
    local scenario_id="$1"
    local test_case="$2"
    local result_file="$3"

    log_phase "Detecting fault patterns"

    # Extract error information from result
    local error_msg=""
    if [ -f "$result_file" ]; then
        error_msg=$(grep -o "Error:.*" "$result_file" || echo "Unknown error")
    fi

    # Create fault report
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local fault_file="$FAULTS_DIR/${scenario_id}-${test_case}-${timestamp}.json"

    # Load expected behavior and recovery strategy
    local scenario=$(jq -c ".scenarios[] | select(.id == \"$scenario_id\")" "$CHAOS_FILE")
    local case_data=$(echo "$scenario" | jq -c ".test_cases[] | select(.case == \"$test_case\")")

    local expected=$(echo "$case_data" | jq -r '.expected_behavior')
    local recovery=$(echo "$case_data" | jq -r '.recovery_strategy')
    local activity=$(echo "$case_data" | jq -r '.activity')

    cat > "$fault_file" <<EOF
{
  "scenario_id": "$scenario_id",
  "test_case": "$test_case",
  "activity": "$activity",
  "timestamp": "$timestamp",
  "error_message": "$error_msg",
  "expected_behavior": "$expected",
  "recovery_strategy": "$recovery",
  "result_file": "$result_file",
  "status": "fault_detected"
}
EOF

    log_success "Fault report created: $fault_file"
    echo "$fault_file"
}

# Create improved variant from fault report
create_variant() {
    local fault_file="$1"
    local auto_recover="${2:-true}"

    log_phase "Creating improved activity variant"

    if [ ! -f "$fault_file" ]; then
        log_error "Fault file not found: $fault_file"
        return 1
    fi

    local activity=$(jq -r '.activity' "$fault_file")
    local recovery_strategy=$(jq -r '.recovery_strategy' "$fault_file")

    log "  Target activity: $activity"
    log "  Recovery strategy: $recovery_strategy"

    # Use MiniBob to create improved variant
    local cmd="minibob --single \"Create improved activity variant for $activity that fixes the fault: $recovery_strategy. Save to $VARIANTS_DIR/${activity}-improved-$(date +%Y%m%d-%H%M%S).json\""

    if eval "$cmd"; then
        log_success "Variant created successfully"

        # Find the newly created variant
        local variant_file=$(ls -t "$VARIANTS_DIR"/*.json 2>/dev/null | head -1)

        if [ -n "$variant_file" ]; then
            log "  Variant file: $variant_file"

            # Update fault report with variant path
            local updated_fault=$(jq --arg variant "$variant_file" '. + {variant_created: $variant, status: "variant_created"}' "$fault_file")
            echo "$updated_fault" > "$fault_file"

            echo "$variant_file"
            return 0
        fi
    fi

    log_error "Variant creation failed"
    return 1
}

# Test variant against chaos scenario
test_variant() {
    local variant_file="$1"
    local scenario_id="$2"
    local test_case="$3"

    log_phase "Testing variant against chaos scenario"

    if [ ! -f "$variant_file" ]; then
        log_error "Variant file not found: $variant_file"
        return 1
    fi

    # Get test case injection data
    local scenario=$(jq -c ".scenarios[] | select(.id == \"$scenario_id\")" "$CHAOS_FILE")
    local case_data=$(echo "$scenario" | jq -c ".test_cases[] | select(.case == \"$test_case\")")
    local inject_data=$(echo "$case_data" | jq -c '.inject')
    local activity=$(jq -r '.id' "$variant_file")

    log "  Testing variant: $(basename "$variant_file")"

    # Re-inject the same chaos
    if inject_chaos "$scenario_id" "$test_case" "$activity" "$inject_data"; then
        log_success "Variant passed chaos test!"
        return 0
    else
        log_error "Variant still fails under chaos"
        return 1
    fi
}

# Deploy successful variant
deploy_variant() {
    local variant_file="$1"

    log_phase "Deploying successful variant"

    # Register with MiniBob backend
    if minibob doctor tutor "$variant_file"; then
        log_success "Variant registered with backend"
        log "  Available for Thompson Sampling selection"
        return 0
    else
        log_error "Variant registration failed"
        return 1
    fi
}

# Run complete chaos workflow for a scenario
run_scenario() {
    local scenario_id="$1"
    local auto_recover="${2:-true}"

    log_phase "Running chaos scenario: $scenario_id"

    # Get scenario details
    local scenario=$(jq -c ".scenarios[] | select(.id == \"$scenario_id\")" "$CHAOS_FILE")

    if [ -z "$scenario" ]; then
        log_error "Scenario not found: $scenario_id"
        return 1
    fi

    local name=$(echo "$scenario" | jq -r '.name')
    local severity=$(echo "$scenario" | jq -r '.severity')

    log "  Name: $name"
    log "  Severity: $severity"

    # Run each test case
    local test_cases=$(echo "$scenario" | jq -c '.test_cases[]')
    local total=0
    local failures=0
    local recovered=0

    while IFS= read -r test_case_obj; do
        total=$((total + 1))

        local case_name=$(echo "$test_case_obj" | jq -r '.case')
        local activity=$(echo "$test_case_obj" | jq -r '.activity')
        local inject=$(echo "$test_case_obj" | jq -c '.inject')

        echo ""
        log "Test Case $total: $case_name"

        # Phase 1: Inject chaos
        if inject_chaos "$scenario_id" "$case_name" "$activity" "$inject"; then
            log_warning "Activity passed (no fault detected)"
            continue
        fi

        failures=$((failures + 1))

        # Phase 2: Detect fault
        local timestamp=$(date +%Y%m%d-%H%M%S)
        local result_file="$RESULTS_DIR/${scenario_id}-${case_name}-${timestamp}.json"
        local fault_file=$(detect_fault "$scenario_id" "$case_name" "$result_file")

        if [ "$auto_recover" != "true" ]; then
            log_warning "Auto-recovery disabled, skipping variant creation"
            continue
        fi

        # Phase 3: Create variant
        local variant_file=$(create_variant "$fault_file" "true")

        if [ -z "$variant_file" ]; then
            log_error "Recovery failed: could not create variant"
            continue
        fi

        # Phase 4: Test variant
        if test_variant "$variant_file" "$scenario_id" "$case_name"; then
            # Phase 5: Deploy variant
            if deploy_variant "$variant_file"; then
                recovered=$((recovered + 1))
                log_success "Recovery complete for test case: $case_name"
            fi
        fi

    done <<< "$test_cases"

    echo ""
    echo "═══════════════════════════════════════════════════════"
    log_phase "Chaos Test Summary: $scenario_id"
    echo "  Total test cases: $total"
    echo "  Failures detected: $failures"
    echo "  Successfully recovered: $recovered"
    echo "  Recovery rate: $(awk "BEGIN {printf \"%.1f%%\", ($recovered/$failures)*100}")"
    echo "═══════════════════════════════════════════════════════"
}

# Run all scenarios
run_all() {
    local auto_recover="${1:-true}"

    log_phase "Running ALL chaos scenarios"

    local scenarios=$(jq -r '.scenarios[].id' "$CHAOS_FILE")

    while IFS= read -r scenario_id; do
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        run_scenario "$scenario_id" "$auto_recover"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        sleep 2
    done <<< "$scenarios"
}

# Auto-recover mode (triggered by scheduler)
auto_recover_mode() {
    log_phase "Auto-recover mode: analyzing recent faults"

    # Find latest fault report without variant
    local latest_fault=$(ls -t "$FAULTS_DIR"/*.json 2>/dev/null | head -1)

    if [ -z "$latest_fault" ]; then
        log "No recent faults found"
        exit 0
    fi

    local status=$(jq -r '.status' "$latest_fault")

    if [ "$status" = "variant_created" ] || [ "$status" = "recovered" ]; then
        log "Latest fault already has variant"
        exit 0
    fi

    log "Processing fault: $(basename "$latest_fault")"

    # Create and test variant
    local variant_file=$(create_variant "$latest_fault" "true")

    if [ -n "$variant_file" ]; then
        local scenario_id=$(jq -r '.scenario_id' "$latest_fault")
        local test_case=$(jq -r '.test_case' "$latest_fault")

        if test_variant "$variant_file" "$scenario_id" "$test_case"; then
            deploy_variant "$variant_file"
            log_success "Auto-recovery complete"
        fi
    fi
}

# Main command dispatcher
case "${1:-}" in
    list)
        list_scenarios
        ;;
    all)
        auto_recover="${2:-true}"
        run_all "$auto_recover"
        ;;
    auto-recover)
        auto_recover_mode
        ;;
    --no-recovery)
        if [ -z "${2:-}" ]; then
            log_error "Usage: $0 --no-recovery <scenario-id>"
            exit 1
        fi
        run_scenario "$2" "false"
        ;;
    "")
        list_scenarios
        exit 0
        ;;
    *)
        auto_recover="${2:-true}"
        run_scenario "$1" "$auto_recover"
        ;;
esac
