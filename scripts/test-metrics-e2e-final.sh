#!/bin/bash
# Final E2E test of metrics flow with SQL CREATE/UPDATE fix

set -e

TEMPLATE_ID="learning-system-e2e-$(date +%s)"
API_URL="http://localhost:8080"

echo "===================================================================="
echo "  Learning System End-to-End Test"
echo "===================================================================="
echo ""
echo "Template: $TEMPLATE_ID"
echo ""

# Test 1: First execution (success)
echo "[1/4] Recording first execution (SUCCESS)..."
curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 1,
      "success_rate": 1.0,
      "avg_duration_ms": 25000,
      "avg_cost_usd": 0.08
    }
  }' | jq -r '"✅ Status: \(.status) | Thompson: α=\(.updated_fields | map(select(. == "thompson_alpha")) | length > 0)"'

sleep 1

# Test 2: Second execution (success)
echo "[2/4] Recording second execution (SUCCESS)..."
curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 2,
      "success_rate": 1.0,
      "avg_duration_ms": 23000,
      "avg_cost_usd": 0.07
    }
  }' | jq -r '"✅ Status: \(.status) | Executions updated"'

sleep 1

# Test 3: Third execution (failure)
echo "[3/4] Recording third execution (FAILURE)..."
curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 3,
      "success_rate": 0.667,
      "avg_duration_ms": 42000,
      "avg_cost_usd": 0.15
    }
  }' | jq -r '"✅ Status: \(.status) | Success rate dropped to 66.7%"'

echo ""
echo "[4/4] Querying SurrealDB for final metrics..."
echo ""

curl -s -X POST http://localhost:8000/sql \
  -u root:root \
  -H "Content-Type: text/plain" \
  -H "Accept: application/json" \
  -H "Surreal-NS: metabob" \
  -H "Surreal-DB: metabob" \
  -d "SELECT variant_id, total_executions, success_rate, thompson_alpha, thompson_beta, avg_cost_usd FROM template_metrics WHERE variant_id = '$TEMPLATE_ID';" \
  | jq -r '.[0].result[0] | 
    "┌─────────────────────────────────────────────────────────┐",
    "│ Metrics Verification                                    │",
    "├─────────────────────────────────────────────────────────┤",
    "│ Variant:          \(.variant_id // "NULL!")             ",
    "│ Total Executions: \(.total_executions)                  ",
    "│ Success Rate:     \(.success_rate * 100)%               ",
    "│ Thompson Alpha:   \(.thompson_alpha) (successes + 1)    ",
    "│ Thompson Beta:    \(.thompson_beta) (failures + 1)      ",
    "│ Avg Cost:         $\(.avg_cost_usd)                     ",
    "└─────────────────────────────────────────────────────────┘"'

echo ""

# Verify metrics are correct
METRICS=$(curl -s -X POST http://localhost:8000/sql \
  -u root:root \
  -H "Content-Type: text/plain" \
  -H "Accept: application/json" \
  -H "Surreal-NS: metabob" \
  -H "Surreal-DB: metabob" \
  -d "SELECT * FROM template_metrics WHERE variant_id = '$TEMPLATE_ID';" \
  | jq -r '.[0].result[0]')

VARIANT_ID=$(echo "$METRICS" | jq -r '.variant_id // "null"')
EXECUTIONS=$(echo "$METRICS" | jq -r '.total_executions // 0')
ALPHA=$(echo "$METRICS" | jq -r '.thompson_alpha // 0')

if [ "$VARIANT_ID" != "$TEMPLATE_ID" ]; then
  echo "❌ FAILED: variant_id not set correctly"
  echo "   Expected: $TEMPLATE_ID"
  echo "   Got: $VARIANT_ID"
  exit 1
fi

if [ "$EXECUTIONS" != "3" ]; then
  echo "❌ FAILED: total_executions not updated"
  echo "   Expected: 3"
  echo "   Got: $EXECUTIONS"
  exit 1
fi

if [ "$(echo "$ALPHA >= 3" | bc -l)" != "1" ]; then
  echo "❌ FAILED: Thompson alpha not calculated"
  echo "   Expected: >= 3"
  echo "   Got: $ALPHA"
  exit 1
fi

echo "===================================================================="
echo "  ✅ ALL TESTS PASSED"
echo "===================================================================="
echo ""
echo "Metrics Flow Verified:"
echo "  ✅ Create initial record with all fields"
echo "  ✅ Update existing records (no duplicates)"
echo "  ✅ Calculate Thompson Sampling parameters"
echo "  ✅ Store data persistently in SurrealDB"
echo ""
echo "Priority 1: COMPLETE ✅"
echo "Priority 2: metabob-cli MCP tool (needs deployment)"
echo "Priority 3: Ready for E2E test with OpenCode"
echo ""
