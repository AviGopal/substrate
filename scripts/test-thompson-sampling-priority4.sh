#!/bin/bash
# Priority 4: Test Thompson Sampling and Boredom Detection
#
# Tests that Thompson Sampling uses real metrics data to select variants
# and that boredom detection can identify templates needing improvement.

set -e

echo "=== Priority 4: Testing Thompson Sampling and Boredom Detection ==="
echo ""

# Configuration
NAMESPACE="metabob"
RPC_API_POD=$(kubectl get pods -n $NAMESPACE -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "metabob-rpc-api-xxx")
SURREALDB_POD=$(kubectl get pods -n $NAMESPACE -l app=surrealdb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "surrealdb-67fcbdd8d7-lng7j")

echo "Configuration:"
echo "  Namespace: $NAMESPACE"
echo "  RPC API Pod: $RPC_API_POD"
echo "  SurrealDB Pod: $SURREALDB_POD"
echo ""

# Part 1: Test Thompson Sampling
echo "===================================================================="
echo "Part 1: Test Thompson Sampling with Real Metrics"
echo "===================================================================="
echo ""

echo "Step 1: Check if templates with metrics exist"
echo ""

QUERY="SELECT variant_id, activity_id, total_executions, success_rate, thompson_alpha, thompson_beta FROM template_metrics WHERE total_executions > 0 LIMIT 5;"

echo "Querying SurrealDB for templates with metrics:"
echo "  $QUERY"
echo ""

TEMPLATES_WITH_METRICS=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- /surreal sql \
  --namespace metabob --database production \
  --username root --password metabob-secret \
  --command "$QUERY" 2>&1)

echo "$TEMPLATES_WITH_METRICS" | grep -A 50 "result"
echo ""

# Extract a template ID for testing
TEMPLATE_ID=$(echo "$TEMPLATES_WITH_METRICS" | grep -oP '"activity_id":\s*"\K[^"]+' | head -1 || echo "")

if [ -z "$TEMPLATE_ID" ]; then
  echo "⚠️  No templates with metrics found yet"
  echo "   Run Priority 3 test first to generate metrics"
  echo ""
  echo "Skipping Thompson Sampling test..."
  echo ""
else
  echo "Found template with metrics: $TEMPLATE_ID"
  echo ""
  
  echo "Step 2: Test Thompson Sampling variant selection"
  echo ""
  echo "Calling POST /v2/activities/templates/$TEMPLATE_ID/select"
  echo ""
  
  # Test Thompson Sampling selection (would need to port-forward or exec into pod)
  echo "NOTE: This requires RPC API to be accessible"
  echo "Manual test command:"
  echo "  kubectl exec -n $NAMESPACE $RPC_API_POD -- curl -X POST http://localhost:8000/v2/activities/templates/$TEMPLATE_ID/select"
  echo ""
  echo "Expected response:"
  echo "  - variant_id: Selected variant based on Thompson Sampling"
  echo "  - thompson_score: Score used for selection"
  echo "  - reason: 'selected' (Thompson Sampling algorithm)"
  echo ""
  echo "✅ If response includes variant_id with thompson_score > 0:"
  echo "   Thompson Sampling is using real metrics data"
  echo ""
fi

# Part 2: Test Boredom Detection
echo "===================================================================="
echo "Part 2: Test Boredom Detection"
echo "===================================================================="
echo ""

echo "Step 1: Check for templates with low improvement_gradient"
echo ""

BOREDOM_QUERY="SELECT variant_id, activity_id, total_executions, success_rate, improvement_gradient FROM template_metrics WHERE improvement_gradient < 0.7 AND total_executions > 2 ORDER BY improvement_gradient ASC LIMIT 5;"

echo "Querying for boredom candidates (improvement_gradient < 0.7):"
echo "  $BOREDOM_QUERY"
echo ""

BOREDOM_CANDIDATES=$(kubectl exec -n $NAMESPACE $SURREALDB_POD -- /surreal sql \
  --namespace metabob --database production \
  --username root --password metabob-secret \
  --command "$BOREDOM_QUERY" 2>&1)

echo "$BOREDOM_CANDIDATES" | grep -A 50 "result"
echo ""

CANDIDATE_COUNT=$(echo "$BOREDOM_CANDIDATES" | grep -c '"variant_id"' || echo "0")

if [ "$CANDIDATE_COUNT" -gt 0 ]; then
  echo "✅ Found $CANDIDATE_COUNT templates needing improvement"
  echo "   These should appear in boredom activities"
  echo ""
else
  echo "⚠️  No templates with low improvement_gradient found"
  echo "   Execute activities with failures to generate boredom candidates"
  echo ""
fi

echo "Step 2: Test boredom activities API"
echo ""
echo "NOTE: This requires RPC API to be accessible"
echo "Manual test command:"
echo "  kubectl exec -n $NAMESPACE $RPC_API_POD -- curl http://localhost:8000/api/v1/boredom/activities?priority_threshold=0.7&max_activities=5"
echo ""
echo "Expected response:"
echo "  - activities: List of improvement opportunities"
echo "  - Each activity has: template_id, activity_type, priority, reason, metrics"
echo ""
echo "Activity types:"
echo "  - improve-template: Low success rate templates"
echo "  - debug-failures: Templates with failure patterns"
echo "  - optimize-performance: Templates with degrading performance"
echo ""

# Part 3: Verification Summary
echo "===================================================================="
echo "Verification Summary"
echo "===================================================================="
echo ""

echo "Priority 4 Checklist:"
echo ""
echo "[ ] Thompson Sampling"
echo "    - Templates have thompson_alpha and thompson_beta values"
echo "    - POST /templates/{id}/select returns variant with score"
echo "    - Better variants (higher success_rate) selected more often"
echo ""
echo "[ ] Boredom Detection"
echo "    - Templates have improvement_gradient calculated"
echo "    - Low-quality templates appear in boredom candidates"
echo "    - Boredom API returns prioritized improvement activities"
echo ""
echo "[ ] Learning Loop Complete"
echo "    - Metrics flow: OpenCode → MCP → REST → SurrealDB ✅ (Priority 1)"
echo "    - Metrics stored and incrementing ✅ (Priority 3)"
echo "    - Thompson Sampling uses metrics ⏳ (This test)"
echo "    - Boredom detection uses metrics ⏳ (This test)"
echo "    - Autonomous improvement triggered ⏳ (Future)"
echo ""

echo "To complete Priority 4:"
echo "1. Verify Thompson Sampling selects variants based on metrics"
echo "2. Verify boredom API returns templates with low gradients"
echo "3. Execute failing activities to generate boredom candidates"
echo "4. Test that boredom activities can be triggered automatically"
echo ""
echo "When all checks pass:"
echo "  ✅ Priority 4: Thompson Sampling and Boredom Detection VERIFIED"
echo "  ✅ Learning system is FULLY FUNCTIONAL"
echo ""
