#!/usr/bin/env bash
set -euo pipefail

# Show Learning Metrics from Backend
# Demonstrates how Thompson Sampling and relevance scores improve over time

if [ -z "${METABOB_API_KEY:-}" ]; then
  echo "❌ Error: METABOB_API_KEY not set"
  exit 1
fi

API_ENDPOINT="${ACTIVITY_API_ENDPOINT:-https://activity.metabob.com}"

echo "================================================"
echo "  MiniBob Learning Metrics Dashboard"
echo "================================================"
echo ""

# Function to query backend
query_api() {
  local path=$1
  curl -s -H "Authorization: ApiKey $METABOB_API_KEY" \
    "${API_ENDPOINT}${path}"
}

# Thompson Sampling Parameters
echo "📊 Thompson Sampling Parameters (Activity Templates)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Fix test failure activity
echo "fix-test-failure-with-discovery:"
FIX_TEST=$(query_api "/v2/activities/templates/fix-test-failure-with-discovery" | jq -r '{
  alpha: .thompson_alpha,
  beta: .thompson_beta,
  success_rate: (.thompson_alpha / (.thompson_alpha + .thompson_beta) * 100 | floor),
  total_executions: (.thompson_alpha + .thompson_beta),
  confidence: (if (.thompson_alpha + .thompson_beta) > 10 then "high" elif (.thompson_alpha + .thompson_beta) > 5 then "medium" else "low" end)
}')
echo "  α (successes): $(echo $FIX_TEST | jq -r .alpha)"
echo "  β (failures):  $(echo $FIX_TEST | jq -r .beta)"
echo "  Success rate:  $(echo $FIX_TEST | jq -r .success_rate)%"
echo "  Executions:    $(echo $FIX_TEST | jq -r .total_executions)"
echo "  Confidence:    $(echo $FIX_TEST | jq -r .confidence)"
echo ""

# Discovery activities
echo "Discovery Activities (Loop 3):"
echo ""

for activity in scan-file-system scan-git-history scan-execution-traces; do
  echo "  $activity:"
  DISC=$(query_api "/v2/activities/templates/$activity" | jq -r '{
    alpha: .thompson_alpha,
    beta: .thompson_beta,
    useful_rate: (.thompson_alpha / (.thompson_alpha + .thompson_beta) * 100 | floor)
  }')
  echo "    α: $(echo $DISC | jq -r .alpha), β: $(echo $DISC | jq -r .beta), useful: $(echo $DISC | jq -r .useful_rate)%"
done
echo ""

# Impulse Relevance Scores
echo "📈 Impulse Relevance Scores (Loop 1)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RELEVANCE=$(query_api "/v2/activities/impulse-suggestions?goal_shape=bugfix&activity_id=fix-test-failure-with-discovery" | jq -r '.suggestions[] | {
  shape: .impulse_shape,
  relevance: (.relevance_score * 100 | floor),
  executions: .execution_count
}')

echo "Impulse Shape               Relevance   Executions"
echo "───────────────────────── ─────────── ────────────"
echo "$RELEVANCE" | jq -r '"\(.shape | . + (" " * (25 - length)))  \(.relevance)%      \(.executions)"'
echo ""

echo "Interpretation:"
echo "  > 80%: Always needed (high priority, high budget)"
echo "  60-80%: Often useful (medium priority)"
echo "  40-60%: Sometimes useful (low priority)"
echo "  < 40%: Rarely useful (skip or very low budget)"
echo ""

# Execution Metrics
echo "⚡ Execution Performance Trends"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

METRICS=$(query_api "/v2/activities/execution-traces?activity_id=fix-test-failure-with-discovery&limit=10" | jq -r '
{
  avg_duration: ([.traces[].duration] | add / length / 1000),
  avg_cost: ([.traces[].cost] | add / length),
  success_rate: (([.traces[] | select(.outcome == "success")] | length) / ([.traces[]] | length) * 100)
}')

echo "  Average Duration:  $(echo $METRICS | jq -r '.avg_duration | floor')s"
echo "  Average Cost:      $$(echo $METRICS | jq -r '.avg_cost | . * 100 | floor / 100')"
echo "  Success Rate:      $(echo $METRICS | jq -r '.success_rate | floor')%"
echo ""

# Learning Rate
echo "📚 Learning Rate Analysis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FIRST_5=$(query_api "/v2/activities/execution-traces?activity_id=fix-test-failure-with-discovery&limit=5&offset=0" | jq -r '
{
  avg_duration: ([.traces[].duration] | add / length / 1000),
  avg_cost: ([.traces[].cost] | add / length)
}')

LAST_5=$(query_api "/v2/activities/execution-traces?activity_id=fix-test-failure-with-discovery&limit=5&order=desc" | jq -r '
{
  avg_duration: ([.traces[].duration] | add / length / 1000),
  avg_cost: ([.traces[].cost] | add / length)
}')

FIRST_DURATION=$(echo $FIRST_5 | jq -r '.avg_duration')
LAST_DURATION=$(echo $LAST_5 | jq -r '.avg_duration')
DURATION_IMPROVEMENT=$(echo "scale=1; ($FIRST_DURATION - $LAST_DURATION) / $FIRST_DURATION * 100" | bc)

FIRST_COST=$(echo $FIRST_5 | jq -r '.avg_cost')
LAST_COST=$(echo $LAST_5 | jq -r '.avg_cost')
COST_IMPROVEMENT=$(echo "scale=1; ($FIRST_COST - $LAST_COST) / $FIRST_COST * 100" | bc)

echo "  First 5 executions:"
echo "    Avg duration: ${FIRST_DURATION}s"
echo "    Avg cost: \$${FIRST_COST}"
echo ""
echo "  Last 5 executions:"
echo "    Avg duration: ${LAST_DURATION}s"
echo "    Avg cost: \$${LAST_COST}"
echo ""
echo "  🎯 Improvement:"
echo "    Duration: ${DURATION_IMPROVEMENT}% faster"
echo "    Cost: ${COST_IMPROVEMENT}% cheaper"
echo ""

# Recovery Strategy Effectiveness
echo "🔄 Recovery Strategy Effectiveness (Variant Creation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RECOVERY=$(query_api "/v2/activities/recovery-strategies?activity_id=fix-test-failure-with-discovery" | jq -r '.strategies[] | {
  error_type: .error_type,
  strategy: .recovery_strategy,
  alpha: .thompson_alpha,
  beta: .thompson_beta,
  success_rate: (.thompson_alpha / (.thompson_alpha + .thompson_beta) * 100 | floor)
}')

echo "Error Type                     Strategy           Success Rate"
echo "────────────────────────────── ────────────────── ────────────"
echo "$RECOVERY" | jq -r '"\(.error_type | . + (" " * (30 - length))) \(.strategy | . + (" " * (18 - length))) \(.success_rate)%"'
echo ""

echo "================================================"
echo ""
echo "Dashboard URL: https://internal.metabob.com"
echo "API Explorer: $API_ENDPOINT/docs"
echo ""
echo "To run next scenario: ./scripts/run-scenario-2-warm-start.sh"
echo ""
