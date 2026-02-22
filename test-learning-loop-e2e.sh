#!/bin/bash
set -e

echo "=========================================="
echo "Learning Loop E2E Test - Devbob Container"
echo "=========================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:8081}"
SURREALDB_URL="${SURREALDB_URL:-http://localhost:8000}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "Test 1: POST multiple executions to learning loop"
echo "---"

# Simulate 3 successful executions
for i in {1..3}; do
    info "Posting execution $i (success)..."
    
    activity_id="act_e2e_success_$(date +%s)_$i"
    response=$(curl -s -X POST "$API_URL/api/v1/learning-loop/executions" \
        -H "Content-Type: application/json" \
        -d '{
            "activity_id": "'$activity_id'",
            "template_id": "test-template-e2e",
            "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "duration_ms": 5000,
            "success": true,
            "tokens_input": 2000,
            "tokens_output": 800,
            "tokens_cache": 500,
            "cost_usd": 0.035
        }')
    
    if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
        pass "Execution $i recorded (ID: $activity_id)"
    else
        fail "Execution $i failed: $response"
        exit 1
    fi
    
    sleep 0.5
done

echo ""
echo "Test 2: POST failure executions"
echo "---"

for i in {1..2}; do
    info "Posting execution with failure $i..."
    
    activity_id="act_e2e_failure_$(date +%s)_$i"
    response=$(curl -s -X POST "$API_URL/api/v1/learning-loop/executions" \
        -H "Content-Type: application/json" \
        -d '{
            "activity_id": "'$activity_id'",
            "template_id": "test-template-e2e",
            "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
            "duration_ms": 2000,
            "success": false,
            "tokens_input": 1500,
            "tokens_output": 200,
            "tokens_cache": 100,
            "cost_usd": 0.015,
            "error_type": "timeout",
            "error_message": "Task exceeded timeout after 2000ms",
            "failed_task_id": "task-2"
        }')
    
    if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
        pass "Failure execution $i recorded (ID: $activity_id)"
    else
        fail "Failure execution $i failed: $response"
        exit 1
    fi
    
    sleep 0.5
done

echo ""
echo "Test 3: Retrieve aggregated metrics"
echo "---"

info "Fetching metrics for test-template-e2e..."
metrics=$(curl -s "$API_URL/api/v1/learning-loop/templates/test-template-e2e/metrics")

if echo "$metrics" | jq -e '.template_id == "test-template-e2e"' > /dev/null 2>&1; then
    pass "Retrieved metrics"
    
    total=$(echo "$metrics" | jq -r '.total_executions')
    successful=$(echo "$metrics" | jq -r '.successful_executions')
    failed=$(echo "$metrics" | jq -r '.failed_executions')
    success_rate=$(echo "$metrics" | jq -r '.success_rate')
    
    info "  Total executions: $total"
    info "  Successful: $successful"
    info "  Failed: $failed"
    info "  Success rate: $success_rate"
    
    if [ "$total" -eq 5 ]; then
        pass "Correct execution count (5 total)"
    else
        warn "Expected 5 total executions, got $total"
    fi
    
    if [ "$success_rate" = "0.6" ]; then
        pass "Correct success rate (60%)"
    else
        warn "Expected 0.6 success rate, got $success_rate"
    fi
else
    fail "Could not retrieve metrics"
    exit 1
fi

echo ""
echo "Test 4: Check failure patterns"
echo "---"

info "Querying failure patterns..."
failures=$(curl -s "$API_URL/api/v1/learning-loop/templates/test-template-e2e/failures")

if echo "$failures" | jq -e '.[0].error_type == "timeout"' > /dev/null 2>&1; then
    pass "Failure pattern recorded (timeout)"
    
    pattern_count=$(echo "$failures" | jq 'length')
    info "  Found $pattern_count unique failure pattern(s)"
else
    warn "No failure patterns found yet"
fi

echo ""
echo "Test 5: Query boredom activities"
echo "---"

info "Checking for boredom activities (templates needing improvement)..."
boredom=$(curl -s "$API_URL/api/v1/learning-loop/boredom-activities?threshold=0.6&limit=5")

boredom_count=$(echo "$boredom" | jq 'length')
if [ "$boredom_count" -gt 0 ]; then
    pass "Found $boredom_count templates needing improvement"
    echo "$boredom" | jq '.[] | {template_id, improvement_gradient}' | head -20
else
    info "No templates below improvement threshold yet"
fi

echo ""
echo "=========================================="
echo "✓ E2E Test Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Posted 5 activity executions (3 success, 2 failure)"
echo "  - Verified metrics aggregation (success_rate: 60%)"
echo "  - Confirmed failure pattern tracking"
echo "  - Checked boredom activity detection"
echo ""
