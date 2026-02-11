#!/bin/bash
# =============================================================================
# Validation Script: Activity Execution Flow
# =============================================================================
# Purpose: Trace activity execution through logs and session data
# Success Criteria:
#   - Activity template discovered via search
#   - Activity execution initiated
#   - Tasks executed in sequence
#   - Session data recorded
#   - Execution results captured
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
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
TOTAL=0

# Config
AGENT_NAME="${1:-devbob-opencode}"
ACTIVITY_ID="${2}"  # Optional: specific activity to test
OUTPUT_DIR="$PROJECT_ROOT/.validation-results/activity-execution-$(date +%Y%m%d-%H%M%S)"

test_start() {
    echo -e "${BLUE}[TEST]${NC} $1"
    TOTAL=$((TOTAL + 1))
}

test_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED=$((PASSED + 1))
}

test_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED=$((FAILED + 1))
}

test_info() {
    echo -e "       $1"
}

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Create output directory
mkdir -p "$OUTPUT_DIR"

section "Activity Execution Validation"

echo "Agent: $AGENT_NAME"
echo "Activity ID: ${ACTIVITY_ID:-auto-detect}"
echo "Timestamp: $(date -Iseconds)"
echo "Output Directory: $OUTPUT_DIR"
echo ""

# =============================================================================
# Pre-Flight: Check Prerequisites
# =============================================================================
section "Pre-Flight Checks"

test_start "Agent container is running"
if docker ps --format '{{.Names}}' | grep -q "^${AGENT_NAME}$"; then
    test_pass "Container $AGENT_NAME is running"
else
    test_fail "Container $AGENT_NAME is NOT running"
    echo ""
    echo "Start agent first: docker compose --profile $AGENT_NAME up -d"
    exit 1
fi

test_start "Backend API is accessible"
if curl -sf http://localhost:8080/health >/dev/null 2>&1; then
    test_pass "Backend API responding"
else
    test_fail "Backend API not accessible"
    echo ""
    echo "Start backend first: ./devbob backend start"
    exit 1
fi

# =============================================================================
# Step 1: Activity Discovery
# =============================================================================
section "Step 1: Activity Discovery"

test_start "Query available activities from backend"

ACTIVITIES_RESPONSE=$(curl -s http://localhost:8080/activities 2>/dev/null)
HTTP_CODE=$?

if [ $HTTP_CODE -eq 0 ]; then
    echo "$ACTIVITIES_RESPONSE" > "$OUTPUT_DIR/activities-list.json"
    
    if echo "$ACTIVITIES_RESPONSE" | jq -e . >/dev/null 2>&1; then
        test_pass "Activities endpoint returned valid JSON"
        
        ACTIVITY_COUNT=$(echo "$ACTIVITIES_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
        test_info "Found $ACTIVITY_COUNT activities"
        
        if [ "$ACTIVITY_COUNT" -gt 0 ]; then
            test_pass "Activities are registered in backend"
            
            # List some activities
            echo "$ACTIVITIES_RESPONSE" | jq -r '.[].id' | head -5 | while read -r id; do
                test_info "  • $id"
            done
            
            # Auto-select an activity if not specified
            if [ -z "$ACTIVITY_ID" ]; then
                ACTIVITY_ID=$(echo "$ACTIVITIES_RESPONSE" | jq -r '.[0].id' 2>/dev/null)
                test_info "Auto-selected: $ACTIVITY_ID"
            fi
        else
            test_fail "No activities registered in backend"
            test_info "Register activities first"
        fi
    else
        test_fail "Activities endpoint returned invalid JSON"
        echo "$ACTIVITIES_RESPONSE" > "$OUTPUT_DIR/activities-error.txt"
    fi
else
    test_fail "Failed to query activities endpoint"
    test_info "Check backend logs: docker logs metabob-rpc-api"
fi

echo ""

# =============================================================================
# Step 2: Initiate Activity Execution
# =============================================================================
section "Step 2: Activity Execution"

if [ -z "$ACTIVITY_ID" ]; then
    echo -e "${RED}Cannot proceed without activity ID${NC}"
    exit 1
fi

test_start "Initiate activity execution via ACP"

# Determine ACP port based on agent
case "$AGENT_NAME" in
    devbob-opencode) ACP_PORT=3004 ;;
    devbob-rpc-api) ACP_PORT=3001 ;;
    devbob-cli) ACP_PORT=3003 ;;
    devbob-dashboard) ACP_PORT=3002 ;;
    devbob-orchestrator) ACP_PORT=3005 ;;
    *) ACP_PORT=3004 ;;
esac

# Create activity execution request
ACTIVITY_REQUEST=$(cat <<EOF
{
  "activity_id": "$ACTIVITY_ID",
  "variables": {
    "description": "validation test run",
    "auto_execute": false
  },
  "reason": "Validation script testing"
}
EOF
)

echo "$ACTIVITY_REQUEST" > "$OUTPUT_DIR/activity-request.json"

# Try to initiate execution (this may vary based on ACP implementation)
test_info "Sending request to http://localhost:$ACP_PORT/activity"
test_info "Activity ID: $ACTIVITY_ID"

# Note: This is a placeholder - actual ACP endpoint may differ
EXECUTION_RESPONSE=$(curl -s -X POST "http://localhost:$ACP_PORT/activity" \
    -H "Content-Type: application/json" \
    -d "$ACTIVITY_REQUEST" 2>/dev/null || echo '{"error": "connection failed"}')

echo "$EXECUTION_RESPONSE" > "$OUTPUT_DIR/execution-response.json"

if echo "$EXECUTION_RESPONSE" | jq -e . >/dev/null 2>&1; then
    test_info "Response: $(echo "$EXECUTION_RESPONSE" | jq -c)"
    
    # Check if execution was accepted
    if echo "$EXECUTION_RESPONSE" | jq -e '.session_id // .execution_id // .id' >/dev/null 2>&1; then
        EXECUTION_ID=$(echo "$EXECUTION_RESPONSE" | jq -r '.session_id // .execution_id // .id')
        test_pass "Activity execution initiated"
        test_info "Execution ID: $EXECUTION_ID"
    else
        test_fail "Activity execution not initiated"
        test_info "Response may indicate error or unavailable endpoint"
    fi
else
    test_fail "Invalid response from ACP"
    test_info "ACP endpoint may not be implemented yet"
fi

echo ""

# =============================================================================
# Step 3: Monitor Execution Logs
# =============================================================================
section "Step 3: Execution Logs"

test_start "Capture agent logs during execution"

# Capture last 100 lines of logs
docker logs --tail 100 "$AGENT_NAME" > "$OUTPUT_DIR/agent-logs.txt" 2>&1

if [ -f "$OUTPUT_DIR/agent-logs.txt" ]; then
    LOG_SIZE=$(wc -l < "$OUTPUT_DIR/agent-logs.txt")
    test_pass "Captured $LOG_SIZE lines of logs"
    test_info "Logs saved to: $OUTPUT_DIR/agent-logs.txt"
    
    # Search for activity-related log entries
    if grep -q "activity" "$OUTPUT_DIR/agent-logs.txt" 2>/dev/null; then
        test_info "Found activity-related log entries"
        
        # Extract activity mentions
        grep -i "activity" "$OUTPUT_DIR/agent-logs.txt" | head -10 > "$OUTPUT_DIR/activity-log-excerpts.txt"
    fi
    
    # Search for errors
    if grep -qi "error\|fail\|exception" "$OUTPUT_DIR/agent-logs.txt" 2>/dev/null; then
        test_info "⚠ Found errors in logs"
        grep -i "error\|fail\|exception" "$OUTPUT_DIR/agent-logs.txt" | head -5 > "$OUTPUT_DIR/errors.txt"
    fi
else
    test_fail "Could not capture logs"
fi

echo ""

# =============================================================================
# Step 4: Query Session Data
# =============================================================================
section "Step 4: Session Data"

test_start "Query session data from backend"

SESSIONS_RESPONSE=$(curl -s "http://localhost:8080/sessions?agent=$AGENT_NAME&limit=5" 2>/dev/null)

if echo "$SESSIONS_RESPONSE" | jq -e . >/dev/null 2>&1; then
    echo "$SESSIONS_RESPONSE" > "$OUTPUT_DIR/sessions.json"
    
    SESSION_COUNT=$(echo "$SESSIONS_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
    test_pass "Retrieved $SESSION_COUNT sessions"
    
    if [ "$SESSION_COUNT" -gt 0 ]; then
        test_info "Latest session:"
        echo "$SESSIONS_RESPONSE" | jq -r '.[0] | {id: .id, timestamp: .created_at, status: .status}' 2>/dev/null | while read -r line; do
            test_info "  $line"
        done
    else
        test_info "No sessions found for this agent"
    fi
else
    test_fail "Could not retrieve session data"
    test_info "Backend may not have session endpoint implemented"
fi

echo ""

# =============================================================================
# Step 5: Check Activity Execution Results
# =============================================================================
section "Step 5: Execution Results"

test_start "Check for activity execution artifacts"

# Check inside container for execution artifacts
ARTIFACTS_FOUND=0

# Check .opencode/activities/
if docker exec "$AGENT_NAME" test -d "/workspace/repos/metabob-opencode/.opencode/activities" 2>/dev/null; then
    ARTIFACT_COUNT=$(docker exec "$AGENT_NAME" find "/workspace/repos/metabob-opencode/.opencode/activities" -type f 2>/dev/null | wc -l)
    
    if [ "$ARTIFACT_COUNT" -gt 0 ]; then
        test_pass "Found $ARTIFACT_COUNT activity artifacts"
        ARTIFACTS_FOUND=$((ARTIFACTS_FOUND + ARTIFACT_COUNT))
        
        # List artifacts
        docker exec "$AGENT_NAME" ls -lah "/workspace/repos/metabob-opencode/.opencode/activities" 2>/dev/null > "$OUTPUT_DIR/activity-artifacts-list.txt"
    else
        test_info "No activity artifacts found yet"
    fi
else
    test_info "Activity directory not found (may not be created yet)"
fi

# Check .opencode/impulses.json
if docker exec "$AGENT_NAME" test -f "/workspace/repos/metabob-opencode/.opencode/impulses.json" 2>/dev/null; then
    docker exec "$AGENT_NAME" cat "/workspace/repos/metabob-opencode/.opencode/impulses.json" 2>/dev/null > "$OUTPUT_DIR/impulses.json"
    
    if [ -f "$OUTPUT_DIR/impulses.json" ] && [ -s "$OUTPUT_DIR/impulses.json" ]; then
        IMPULSE_COUNT=$(jq '. | length' "$OUTPUT_DIR/impulses.json" 2>/dev/null || echo "0")
        test_pass "Found $IMPULSE_COUNT impulses"
        ARTIFACTS_FOUND=$((ARTIFACTS_FOUND + 1))
    fi
else
    test_info "No impulses file found yet"
fi

# Check .metabob/metadata
if docker exec "$AGENT_NAME" test -f "/workspace/.metabob/metadata" 2>/dev/null; then
    docker exec "$AGENT_NAME" cat "/workspace/.metabob/metadata" 2>/dev/null > "$OUTPUT_DIR/metabob-metadata.txt"
    test_pass "Found Metabob metadata"
    ARTIFACTS_FOUND=$((ARTIFACTS_FOUND + 1))
else
    test_info "No Metabob metadata found yet"
fi

if [ $ARTIFACTS_FOUND -gt 0 ]; then
    test_pass "Found $ARTIFACTS_FOUND artifact types"
else
    test_fail "No execution artifacts found"
    test_info "Activity may not have executed or files not in expected locations"
fi

echo ""

# =============================================================================
# Step 6: Component Tracking ↔ Impulse Bridge Analysis
# =============================================================================
section "Step 6: Component-Impulse Bridge"

test_start "Analyze component tracking to impulse flow"

COMPONENT_DATA="$OUTPUT_DIR/metabob-metadata.txt"
IMPULSE_DATA="$OUTPUT_DIR/impulses.json"

if [ -f "$COMPONENT_DATA" ] && [ -f "$IMPULSE_DATA" ]; then
    test_pass "Both component and impulse data available"
    
    # Analyze component data
    COMPONENT_COUNT=$(grep -c "component" "$COMPONENT_DATA" 2>/dev/null || echo "0")
    test_info "Component entries: $COMPONENT_COUNT"
    
    # Analyze impulse data
    IMPULSE_COUNT=$(jq '. | length' "$IMPULSE_DATA" 2>/dev/null || echo "0")
    test_info "Impulses loaded: $IMPULSE_COUNT"
    
    # Create bridge analysis report
    cat > "$OUTPUT_DIR/bridge-analysis.txt" <<EOF
Component Tracking → Impulse Bridge Analysis
==============================================

Component Data:
  File: $COMPONENT_DATA
  Entries: $COMPONENT_COUNT

Impulse Data:
  File: $IMPULSE_DATA
  Impulses: $IMPULSE_COUNT

Analysis:
  This represents the bridge between Metabob's component tracking
  and OpenCode's impulse system. The goal is to automatically
  determine which impulses to load based on component changes.

Next Steps:
  1. Instrument the bridge with logging
  2. Collect 50-100 execution samples
  3. Analyze which impulses lead to success
  4. Build recommendation model

EOF
    
    test_info "Bridge analysis saved to: $OUTPUT_DIR/bridge-analysis.txt"
    test_pass "Bridge data captured for analysis"
else
    test_fail "Bridge data incomplete"
    test_info "Need both component and impulse data for analysis"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
section "Validation Summary"

echo "Agent: $AGENT_NAME"
echo "Activity: ${ACTIVITY_ID:-none}"
echo "Total Tests: $TOTAL"
echo -e "Passed:      ${GREEN}$PASSED${NC}"
echo -e "Failed:      ${RED}$FAILED${NC}"
echo ""

echo "Output Directory: $OUTPUT_DIR"
echo "Files Generated:"
ls -1 "$OUTPUT_DIR" | while read -r file; do
    echo "  • $file"
done

echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Activity execution validation PASSED${NC}"
    echo ""
    echo "All validation checks passed. Review artifacts in:"
    echo "  $OUTPUT_DIR"
    exit 0
else
    echo -e "${YELLOW}⚠ Activity execution validation COMPLETED WITH FAILURES${NC}"
    echo ""
    echo "Some checks failed. This may be expected if:"
    echo "  - Activity execution is not yet implemented"
    echo "  - ACP endpoints are not available"
    echo "  - This is a baseline run before implementation"
    echo ""
    echo "Review artifacts in: $OUTPUT_DIR"
    exit 1
fi
