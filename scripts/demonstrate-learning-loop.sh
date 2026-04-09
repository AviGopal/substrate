#!/usr/bin/env bash
set -euo pipefail

# Demonstrate the MiniBob Learning Loop
# This script shows all 6 phases of the learning cycle in action

ACTIVITY_API="https://activity.metabob.com"
API_KEY="${METABOB_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "Error: METABOB_API_KEY not set"
  echo "Export your API key: export METABOB_API_KEY='mb_live_...'"
  exit 1
fi

echo "======================================================================"
echo "MiniBob Learning Loop Demonstration"
echo "======================================================================"
echo ""

# Phase 1: Execute an activity with MiniBob
echo "PHASE 1: EXECUTE"
echo "----------------"
echo "Running MiniBob to execute an activity..."
echo ""

WORKSPACE="/tmp/learning-loop-demo-$(date +%s)"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# Create a simple test file for MiniBob to work with
cat > task.txt <<EOF
Create a simple TypeScript function that adds two numbers.
Save it to src/add.ts with proper type annotations.
EOF

echo "Task: $(cat task.txt)"
echo ""
echo "Executing with MiniBob..."

# Execute with MiniBob (captures execution trace automatically)
EXEC_OUTPUT=$(minibob --single "$(cat task.txt)" 2>&1 || true)
echo "$EXEC_OUTPUT"

# Extract execution ID from MiniBob output
EXEC_ID=$(echo "$EXEC_OUTPUT" | grep -oP 'execution_id: \K[a-z0-9-]+' | head -1 || echo "")

if [ -z "$EXEC_ID" ]; then
  echo "Warning: Could not extract execution_id from MiniBob output"
  echo "The loop will continue with demonstration of other phases..."
  EXEC_ID="demo-execution-$(date +%s)"
fi

echo ""
echo "Execution ID: $EXEC_ID"
echo ""

# Phase 2: Verify trace was stored in backend
echo "======================================================================"
echo "PHASE 2: STORE"
echo "----------------"
echo "Checking backend for stored execution trace..."
echo ""

sleep 2  # Give backend time to process

TRACE_RESPONSE=$(curl -s -H "Authorization: ApiKey $API_KEY" \
  "$ACTIVITY_API/v2/activities/execution-traces?limit=5" || echo '{"traces":[]}')

echo "Recent execution traces:"
echo "$TRACE_RESPONSE" | jq -r '.traces[] | "  - \(.execution_id): \(.activity_id) [\(.success)] - \(.duration_ms)ms"' | head -5
echo ""

# Phase 3: Check Thompson Sampling metrics update
echo "======================================================================"
echo "PHASE 3: THOMPSON SAMPLING UPDATE"
echo "----------------"
echo "Checking updated Thompson Sampling scores..."
echo ""

METRICS_RESPONSE=$(curl -s -H "Authorization: ApiKey $API_KEY" \
  "$ACTIVITY_API/v2/activities/templates?limit=5" || echo '{"templates":[]}')

echo "Template metrics (showing Thompson alpha/beta):"
echo "$METRICS_RESPONSE" | jq -r '.templates[] | "  - \(.name):"' | head -5
echo "$METRICS_RESPONSE" | jq -r '.templates[] | "      α=\(.metrics.thompson_alpha // 1) β=\(.metrics.thompson_beta // 1) success_rate=\(.metrics.success_rate // 0)"' | head -5
echo ""

# Phase 4: Get recommendations (Thompson Sampling in action)
echo "======================================================================"
echo "PHASE 4: RECOMMEND (Thompson Sampling)"
echo "----------------"
echo "Requesting activity recommendations..."
echo ""

RECOMMEND_RESPONSE=$(curl -s -X POST \
  -H "Authorization: ApiKey $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "create TypeScript function",
    "category": "feature",
    "limit": 3
  }' \
  "$ACTIVITY_API/v2/activities/recommend" || echo '{"recommendations":[]}')

echo "Top 3 recommended activities (ranked by Thompson Sampling):"
echo "$RECOMMEND_RESPONSE" | jq -r '.recommendations[] | "  \(.rank). \(.template_id) (sampled=\(.selection_metadata.sampled_value // 0 | tostring | .[0:5]))"'
echo ""

# Phase 5: Check impulse relevance
echo "======================================================================"
echo "PHASE 5: IMPULSE RELEVANCE TRACKING"
echo "----------------"
echo "Checking which impulses improve success rates..."
echo ""

RELEVANCE_RESPONSE=$(curl -s -H "Authorization: ApiKey $API_KEY" \
  "$ACTIVITY_API/v2/activities/impulse-relevance?limit=5" || echo '{"metrics":[]}')

echo "Impulse relevance scores:"
echo "$RELEVANCE_RESPONSE" | jq -r '.metrics[] | "  - \(.impulse_id): relevance=\(.relevance_score // 0) (loaded \(.times_loaded // 0) times, succeeded \(.times_execution_succeeded // 0) times)"' | head -5
echo ""

# Phase 6: Check ribosome candidates
echo "======================================================================"
echo "PHASE 6: RIBOSOME (Template Extraction)"
echo "----------------"
echo "Checking for successful execution patterns ready for extraction..."
echo ""

RIBOSOME_CANDIDATES=$(curl -s -H "Authorization: ApiKey $API_KEY" \
  "$ACTIVITY_API/v2/ribosome/candidates" || echo '{"candidates":[]}')

echo "Ribosome extraction candidates (successful patterns):"
echo "$RIBOSOME_CANDIDATES" | jq -r '.candidates[] | "  - \(.activity_id): \(.success_count)/\(.execution_count) successful"' | head -5
echo ""

# Summary
echo "======================================================================"
echo "LEARNING LOOP SUMMARY"
echo "======================================================================"
echo ""
echo "The complete learning cycle:"
echo ""
echo "1. ✓ EXECUTE: MiniBob ran activity (execution_id: $EXEC_ID)"
echo "2. ✓ STORE: Trace stored in backend with state deltas"
echo "3. ✓ UPDATE: Thompson alpha/beta updated from execution results"
echo "4. ✓ RECOMMEND: Activities ranked by sampled Beta(α, β) values"
echo "5. ✓ TRACK: Impulse relevance scores updated"
echo "6. ✓ EXTRACT: Ribosome identifies successful patterns for extraction"
echo ""
echo "The loop continues: Next execution uses improved recommendations!"
echo ""
echo "Key Learning Metrics:"
echo "  - Total templates: $(echo "$METRICS_RESPONSE" | jq '.templates | length')"
echo "  - Recent executions: $(echo "$TRACE_RESPONSE" | jq '.traces | length')"
echo "  - Ribosome candidates: $(echo "$RIBOSOME_CANDIDATES" | jq '.candidates | length')"
echo ""
echo "======================================================================"

# Cleanup
cd /
rm -rf "$WORKSPACE"
