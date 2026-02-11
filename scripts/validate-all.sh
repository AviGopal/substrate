#!/bin/bash
# =============================================================================
# Master Validation Script
# =============================================================================
# Purpose: Run all validation scripts and generate comprehensive report
# Usage: ./scripts/validate-all.sh [agent-name]
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Config
AGENT_NAME="${1:-devbob-opencode}"
OUTPUT_DIR="$PROJECT_ROOT/.validation-results/full-validation-$(date +%Y%m%d-%H%M%S)"
RESULTS=()

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}${BOLD}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

run_validation() {
    local name="$1"
    local script="$2"
    shift 2
    local args="$@"
    
    section "$name"
    
    echo "Running: $script $args"
    echo ""
    
    local start_time=$(date +%s)
    local exit_code=0
    
    if "$SCRIPT_DIR/$script" $args; then
        exit_code=0
        RESULTS+=("$name:PASSED")
        echo ""
        echo -e "${GREEN}✓ $name PASSED${NC}"
    else
        exit_code=$?
        RESULTS+=("$name:FAILED")
        echo ""
        echo -e "${RED}✗ $name FAILED (exit code: $exit_code)${NC}"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo "Duration: ${duration}s"
    
    return $exit_code
}

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Header
section "DevBob Full System Validation"

echo "Agent: $AGENT_NAME"
echo "Timestamp: $(date -Iseconds)"
echo "Output Directory: $OUTPUT_DIR"
echo ""
echo "This comprehensive validation will:"
echo "  1. Check backend health"
echo "  2. Verify agent connectivity"
echo "  3. Test activity execution flow"
echo "  4. Analyze Metabob bridge"
echo ""
echo "Press Ctrl+C to cancel, or wait 3 seconds to continue..."
sleep 3

# =============================================================================
# Validation 1: Backend Health
# =============================================================================
run_validation "Backend Health" "validate-backend-health.sh" || true

echo ""
read -p "Press Enter to continue to agent connectivity tests..."
echo ""

# =============================================================================
# Validation 2: Agent Connectivity
# =============================================================================

# Determine ACP port
case "$AGENT_NAME" in
    devbob-opencode) ACP_PORT=3004 ;;
    devbob-rpc-api) ACP_PORT=3001 ;;
    devbob-cli) ACP_PORT=3003 ;;
    devbob-dashboard) ACP_PORT=3002 ;;
    devbob-orchestrator) ACP_PORT=3005 ;;
    *) ACP_PORT=3004 ;;
esac

run_validation "Agent Connectivity" "validate-agent-connectivity.sh" "$AGENT_NAME" "$ACP_PORT" || true

echo ""
read -p "Press Enter to continue to activity execution tests..."
echo ""

# =============================================================================
# Validation 3: Activity Execution
# =============================================================================
run_validation "Activity Execution" "validate-activity-execution.sh" "$AGENT_NAME" || true

echo ""
read -p "Press Enter to continue to bridge analysis..."
echo ""

# =============================================================================
# Validation 4: Metabob Bridge
# =============================================================================
run_validation "Metabob Bridge" "validate-metabob-bridge.sh" "$AGENT_NAME" || true

# =============================================================================
# Generate Summary Report
# =============================================================================
section "Validation Summary Report"

PASSED_COUNT=0
FAILED_COUNT=0

echo "Results:"
echo ""

for result in "${RESULTS[@]}"; do
    IFS=':' read -r name status <<< "$result"
    
    if [ "$status" = "PASSED" ]; then
        echo -e "  ${GREEN}✓${NC} $name"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "  ${RED}✗${NC} $name"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Passed: ${GREEN}${PASSED_COUNT}${NC} / Failed: ${RED}${FAILED_COUNT}${NC} / Total: $((PASSED_COUNT + FAILED_COUNT))"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create summary JSON
cat > "$OUTPUT_DIR/validation-summary.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "agent": "$AGENT_NAME",
  "results": {
    "passed": $PASSED_COUNT,
    "failed": $FAILED_COUNT,
    "total": $((PASSED_COUNT + FAILED_COUNT))
  },
  "validations": [
$(for i in "${!RESULTS[@]}"; do
    result="${RESULTS[$i]}"
    IFS=':' read -r name status <<< "$result"
    echo "    {\"name\": \"$name\", \"status\": \"$status\"}"
    if [ $i -lt $((${#RESULTS[@]} - 1)) ]; then
        echo ","
    fi
done)
  ]
}
EOF

echo "Summary saved to: $OUTPUT_DIR/validation-summary.json"
echo ""

# Create detailed report
cat > "$OUTPUT_DIR/VALIDATION_REPORT.md" <<EOF
# DevBob Validation Report

**Generated**: $(date -Iseconds)  
**Agent**: $AGENT_NAME  
**Output Directory**: $OUTPUT_DIR

---

## Summary

- **Passed**: $PASSED_COUNT
- **Failed**: $FAILED_COUNT
- **Total**: $((PASSED_COUNT + FAILED_COUNT))

## Validation Results

$(for result in "${RESULTS[@]}"; do
    IFS=':' read -r name status <<< "$result"
    if [ "$status" = "PASSED" ]; then
        echo "- ✅ **$name**: PASSED"
    else
        echo "- ❌ **$name**: FAILED"
    fi
done)

---

## Validation Details

### 1. Backend Health
**Purpose**: Verify all backend services are running and responsive  
**Tests**: Redis, SurrealDB, Metabob RPC API, Docker services  
**Script**: \`scripts/validate-backend-health.sh\`

### 2. Agent Connectivity
**Purpose**: Verify agent can reach backend and expose ACP  
**Tests**: Container running, ACP port, config mounted, backend reachable  
**Script**: \`scripts/validate-agent-connectivity.sh\`

### 3. Activity Execution
**Purpose**: Trace activity execution through logs and session data  
**Tests**: Activity discovery, execution initiation, logs, session data, artifacts  
**Script**: \`scripts/validate-activity-execution.sh\`

### 4. Metabob Bridge
**Purpose**: Validate component tracking → impulse loading bridge  
**Tests**: Component tracking, impulse loading, correlation, data flow  
**Script**: \`scripts/validate-metabob-bridge.sh\`

---

## Next Steps

$(if [ $FAILED_COUNT -eq 0 ]; then
    echo "✅ All validations passed! System is functioning as expected."
    echo ""
    echo "- Review captured artifacts in individual validation directories"
    echo "- Proceed with activity execution testing"
    echo "- Begin instrumenting the bridge for data collection"
else
    echo "⚠️ Some validations failed. Review the failures:"
    echo ""
    for result in "${RESULTS[@]}"; do
        IFS=':' read -r name status <<< "$result"
        if [ "$status" = "FAILED" ]; then
            echo "- **$name**: Check script output for details"
        fi
    done
    echo ""
    echo "Common fixes:"
    echo "- Ensure backend is running: \`./devbob backend start\`"
    echo "- Ensure agent is running: \`./devbob agent start $AGENT_NAME\`"
    echo "- Check docker logs: \`docker logs $AGENT_NAME\`"
fi)

---

## Files Generated

Individual validation scripts generate detailed artifacts in:
- \`.validation-results/backend-health-*\`
- \`.validation-results/agent-connectivity-*\`
- \`.validation-results/activity-execution-*\`
- \`.validation-results/bridge-analysis-*\`

---

**Report Location**: $OUTPUT_DIR/VALIDATION_REPORT.md
EOF

echo "Detailed report saved to: $OUTPUT_DIR/VALIDATION_REPORT.md"
echo ""

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ ALL VALIDATIONS PASSED${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "System is functioning as expected."
    echo "Review artifacts in: $OUTPUT_DIR"
    exit 0
else
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠ SOME VALIDATIONS FAILED${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Review the report for details: $OUTPUT_DIR/VALIDATION_REPORT.md"
    exit 1
fi
