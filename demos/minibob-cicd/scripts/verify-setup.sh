#!/bin/bash

# Verify Autonomous CI/CD Setup
# Checks that all components are in place and ready to use

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check() {
    local description="$1"
    local command="$2"

    printf "%-60s" "  $description..."

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        return 1
    fi
}

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Autonomous CI/CD Setup Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Checking activities..."
check "enforce-error-handling-activity.json exists" \
    "test -f '$PROJECT_DIR/activities/autonomous-loop/enforce-error-handling-activity.json'"

check "validate-enforcement-activity.json exists" \
    "test -f '$PROJECT_DIR/activities/autonomous-loop/validate-enforcement-activity.json'"

check "autonomous-code-quality-loop.json exists" \
    "test -f '$PROJECT_DIR/activities/autonomous-loop/autonomous-code-quality-loop.json'"

check "Activities are valid JSON" \
    "jq empty '$PROJECT_DIR/activities/autonomous-loop'/*.json"

echo ""
echo "Checking chaos scenarios..."
check "chaos-scenarios.json exists" \
    "test -f '$PROJECT_DIR/chaos/chaos-scenarios.json'"

check "chaos-scenarios.json is valid JSON" \
    "jq empty '$PROJECT_DIR/chaos/chaos-scenarios.json'"

check "At least 6 scenarios defined" \
    "[ \$(jq '.scenarios | length' '$PROJECT_DIR/chaos/chaos-scenarios.json') -ge 6 ]"

check "chaos/results directory exists" \
    "test -d '$PROJECT_DIR/chaos/results'"

check "chaos/fault-reports directory exists" \
    "test -d '$PROJECT_DIR/chaos/fault-reports'"

echo ""
echo "Checking schedules..."
check "autonomous-development-schedule.json exists" \
    "test -f '$PROJECT_DIR/schedules/autonomous-development-schedule.json'"

check "Schedule file is valid JSON" \
    "jq empty '$PROJECT_DIR/schedules/autonomous-development-schedule.json'"

check "At least 6 schedules defined" \
    "[ \$(jq '.schedules | length' '$PROJECT_DIR/schedules/autonomous-development-schedule.json') -ge 6 ]"

echo ""
echo "Checking workflows..."
check "autonomous-cicd-workflow.yml exists" \
    "test -f '$PROJECT_DIR/workflows/autonomous-cicd-workflow.yml'"

check "Workflow has quality-enforcement job" \
    "grep -q 'quality-enforcement' '$PROJECT_DIR/workflows/autonomous-cicd-workflow.yml'"

check "Workflow has chaos-testing job" \
    "grep -q 'chaos-testing' '$PROJECT_DIR/workflows/autonomous-cicd-workflow.yml'"

echo ""
echo "Checking scripts..."
check "run-scheduler.sh exists and is executable" \
    "test -x '$PROJECT_DIR/scripts/run-scheduler.sh'"

check "run-chaos-test.sh exists and is executable" \
    "test -x '$PROJECT_DIR/scripts/run-chaos-test.sh'"

check "monitor-results.sh exists and is executable" \
    "test -x '$PROJECT_DIR/scripts/monitor-results.sh'"

check "setup-git-hooks.sh exists and is executable" \
    "test -x '$PROJECT_DIR/scripts/setup-git-hooks.sh'"

echo ""
echo "Checking directories..."
check "results directory exists" \
    "test -d '$PROJECT_DIR/results'"

check "activities/autonomous-loop/variants directory exists" \
    "test -d '$PROJECT_DIR/activities/autonomous-loop' || mkdir -p '$PROJECT_DIR/activities/autonomous-loop/variants'"

check "logs directory exists" \
    "test -d '$PROJECT_DIR/logs' || mkdir -p '$PROJECT_DIR/logs'"

echo ""
echo "Checking documentation..."
check "AUTONOMOUS_CICD_README.md exists" \
    "test -f '$PROJECT_DIR/AUTONOMOUS_CICD_README.md'"

check "AUTONOMOUS_QUICKSTART.md exists" \
    "test -f '$PROJECT_DIR/AUTONOMOUS_QUICKSTART.md'"

check "SETUP_COMPLETE.md exists" \
    "test -f '$PROJECT_DIR/SETUP_COMPLETE.md'"

echo ""
echo "Checking dependencies..."
check "jq is installed" \
    "command -v jq"

check "minibob is installed" \
    "command -v minibob"

check "git is installed" \
    "command -v git"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED))
echo "  Total Checks: $TOTAL_CHECKS"
echo -e "  ${GREEN}Passed: $CHECKS_PASSED${NC}"

if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed: $CHECKS_FAILED${NC}"
    echo ""
    echo -e "${YELLOW}Some checks failed. Please review the errors above.${NC}"
    exit 1
else
    echo -e "  ${GREEN}Failed: 0${NC}"
    echo ""
    echo -e "${GREEN}✓ All checks passed! Autonomous CI/CD system is ready.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Register activities: minibob doctor tutor activities/autonomous-loop/*.json"
    echo "  2. Run quality loop: minibob --single \"Execute autonomous-code-quality-loop on repository .\""
    echo "  3. Run chaos test: ./scripts/run-chaos-test.sh invalid-input-data"
    echo "  4. See AUTONOMOUS_QUICKSTART.md for more"
    echo ""
fi

exit 0
