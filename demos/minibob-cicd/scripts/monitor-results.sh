#!/bin/bash

# Monitor and Report on Autonomous Execution Results
# Shows metrics, compliance trends, and activity performance

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$PROJECT_DIR/results"
CHAOS_DIR="$PROJECT_DIR/chaos"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed"
    exit 1
fi

# Show recent quality loop results
show_quality_results() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Quality Loop Results${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [ ! -d "$RESULTS_DIR/quality-loop" ]; then
        echo "No quality loop results found"
        return
    fi

    # Find latest summary
    local summary_file=$(ls -t "$RESULTS_DIR/quality-loop"/autonomous-loop-summary*.json 2>/dev/null | head -1)

    if [ -z "$summary_file" ]; then
        echo "No summary file found"
        return
    fi

    local status=$(jq -r '.status // "UNKNOWN"' "$summary_file")
    local compliance=$(jq -r '.final_compliance // "N/A"' "$summary_file")
    local regressions=$(jq -r '.regressions // 0' "$summary_file")
    local iterations=$(jq -r '.iterations_needed // 0' "$summary_file")
    local ready=$(jq -r '.ready_for_production // false' "$summary_file")

    echo ""
    echo "  Latest Execution: $(basename "$summary_file")"
    echo ""

    if [ "$status" = "SUCCESS" ]; then
        echo -e "  Status: ${GREEN}✓ SUCCESS${NC}"
    else
        echo -e "  Status: ${RED}✗ FAILED${NC}"
    fi

    if [ "$compliance" = "100%" ]; then
        echo -e "  Compliance: ${GREEN}$compliance${NC}"
    else
        echo -e "  Compliance: ${YELLOW}$compliance${NC}"
    fi

    if [ "$regressions" = "0" ]; then
        echo -e "  Regressions: ${GREEN}$regressions${NC}"
    else
        echo -e "  Regressions: ${RED}$regressions${NC}"
    fi

    echo "  Iterations: $iterations"

    if [ "$ready" = "true" ]; then
        echo -e "  Production Ready: ${GREEN}YES${NC}"
    else
        echo -e "  Production Ready: ${RED}NO${NC}"
    fi

    # Show phase breakdown if available
    local phases=$(jq -r '.phases_completed // 0' "$summary_file")
    if [ "$phases" != "0" ]; then
        echo ""
        echo "  Phases Completed: $phases/7"
    fi

    echo ""
}

# Show chaos testing metrics
show_chaos_metrics() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Chaos Testing Metrics${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [ ! -d "$CHAOS_DIR/fault-reports" ]; then
        echo "No chaos test results found"
        return
    fi

    local total_faults=$(find "$CHAOS_DIR/fault-reports" -name "*.json" | wc -l)

    if [ "$total_faults" = "0" ]; then
        echo "No faults detected yet"
        return
    fi

    echo ""
    echo "  Total Faults Detected: $total_faults"

    # Count variants created
    local variants_created=$(find "$CHAOS_DIR/fault-reports" -name "*.json" -exec jq -r 'select(.variant_created != null) | .variant_created' {} \; | wc -l)
    echo "  Variants Created: $variants_created"

    # Calculate variant creation rate
    if [ "$total_faults" -gt 0 ]; then
        local creation_rate=$(awk "BEGIN {printf \"%.1f%%\", ($variants_created/$total_faults)*100}")
        echo "  Variant Creation Rate: $creation_rate"
    fi

    # Show recent faults
    echo ""
    echo "  Recent Faults (last 5):"
    find "$CHAOS_DIR/fault-reports" -name "*.json" -printf "%T@ %p\n" | sort -rn | head -5 | while read -r timestamp file; do
        local scenario=$(jq -r '.scenario_id' "$file")
        local test_case=$(jq -r '.test_case' "$file")
        local status=$(jq -r '.status' "$file")

        if [ "$status" = "variant_created" ] || [ "$status" = "recovered" ]; then
            echo -e "    ${GREEN}✓${NC} $scenario / $test_case"
        else
            echo -e "    ${RED}✗${NC} $scenario / $test_case"
        fi
    done

    echo ""
}

# Show performance metrics from backend
show_performance_metrics() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Activity Performance (from backend)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Query activity API for metrics
    local api_url="${ACTIVITY_API_ENDPOINT:-https://activity.metabob.com}"

    echo ""
    echo "  Querying: $api_url"

    if ! command -v curl &> /dev/null; then
        echo "  curl not installed, skipping backend metrics"
        return
    fi

    # Fetch template metrics
    local response=$(curl -s "$api_url/v2/activities/templates?category=autonomous-loop" 2>/dev/null || echo "{}")

    local templates=$(echo "$response" | jq -r '.templates[]? | "\(.id)|\(.metrics.success_rate // 0)|\(.metrics.total_executions // 0)|\(.metrics.avg_cost_usd // 0)"' 2>/dev/null)

    if [ -z "$templates" ]; then
        echo "  No activity data available"
        return
    fi

    echo ""
    printf "  %-40s %12s %12s %12s\n" "Activity" "Success Rate" "Executions" "Avg Cost"
    echo "  ────────────────────────────────────────────────────────────────────────────────"

    while IFS='|' read -r id success_rate executions avg_cost; do
        local success_pct=$(awk "BEGIN {printf \"%.1f%%\", $success_rate * 100}")

        if (( $(echo "$success_rate >= 0.8" | bc -l) )); then
            printf "  ${GREEN}%-40s %12s %12s \$%10.2f${NC}\n" "$id" "$success_pct" "$executions" "$avg_cost"
        elif (( $(echo "$success_rate >= 0.5" | bc -l) )); then
            printf "  ${YELLOW}%-40s %12s %12s \$%10.2f${NC}\n" "$id" "$success_pct" "$executions" "$avg_cost"
        else
            printf "  ${RED}%-40s %12s %12s \$%10.2f${NC}\n" "$id" "$success_pct" "$executions" "$avg_cost"
        fi
    done <<< "$templates"

    echo ""
}

# Show compliance trends
show_compliance_trends() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Compliance Trends${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [ ! -d "$RESULTS_DIR/quality-loop" ]; then
        echo "No compliance data available"
        return
    fi

    # Get last 10 compliance results
    local summaries=$(ls -t "$RESULTS_DIR/quality-loop"/autonomous-loop-summary*.json 2>/dev/null | head -10)

    if [ -z "$summaries" ]; then
        echo "No compliance data found"
        return
    fi

    echo ""
    echo "  Last 10 Executions:"
    echo ""

    local count=0
    while IFS= read -r file; do
        count=$((count + 1))
        local timestamp=$(basename "$file" | sed 's/autonomous-loop-summary-//; s/.json//')
        local compliance=$(jq -r '.final_compliance // "N/A"' "$file")
        local status=$(jq -r '.status // "UNKNOWN"' "$file")

        local bar=""
        if [ "$compliance" != "N/A" ]; then
            local pct=${compliance%\%}
            local bars=$((pct / 10))
            bar=$(printf '█%.0s' $(seq 1 $bars))
        fi

        if [ "$compliance" = "100%" ]; then
            echo -e "  ${GREEN}$count. $timestamp: $compliance $bar${NC}"
        elif [ "$status" = "SUCCESS" ]; then
            echo -e "  ${YELLOW}$count. $timestamp: $compliance $bar${NC}"
        else
            echo -e "  ${RED}$count. $timestamp: $compliance $bar (FAILED)${NC}"
        fi
    done <<< "$summaries"

    echo ""
}

# Watch mode - continuously monitor
watch_mode() {
    while true; do
        clear
        echo ""
        echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║         Autonomous CI/CD Monitoring Dashboard                  ║${NC}"
        echo -e "${CYAN}║         Updated: $(date '+%Y-%m-%d %H:%M:%S')                        ║${NC}"
        echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""

        show_quality_results
        echo ""
        show_chaos_metrics
        echo ""
        show_compliance_trends

        echo ""
        echo -e "${BLUE}Press Ctrl+C to exit watch mode${NC}"
        sleep 10
    done
}

# Main command dispatcher
case "${1:-}" in
    --metrics|-m)
        show_performance_metrics
        ;;
    --compliance|-c)
        show_compliance_trends
        ;;
    --chaos)
        show_chaos_metrics
        ;;
    --watch|-w)
        watch_mode
        ;;
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  (none)           Show all monitoring data"
        echo "  --metrics, -m    Show activity performance metrics"
        echo "  --compliance, -c Show compliance trends"
        echo "  --chaos          Show chaos testing results"
        echo "  --watch, -w      Watch mode (refresh every 10s)"
        echo "  --help, -h       Show this help"
        ;;
    *)
        show_quality_results
        echo ""
        show_chaos_metrics
        echo ""
        show_compliance_trends
        ;;
esac
