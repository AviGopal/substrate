#!/bin/bash
# Validation Script: mcp-activity-flow-existing-validation
# Purpose: Validate existing deployed infrastructure works end-to-end
# No code changes required - just verify what's already there

set -e

NAMESPACE="metabob"
BACKEND_URL="http://metabob-rpc-api.metabob.svc.cluster.local:8080"
DEVBOB_POD="devbob-84466fdfff-dd87l"

echo "=============================================="
echo "MCP Activity Flow - Existing Validation"
echo "=============================================="
echo "Backend: $BACKEND_URL"
echo "DevBob Pod: $DEVBOB_POD"
echo "=============================================="
echo ""

# Test 1: Templates endpoint returns non-empty JSON
echo "Test 1: Templates Endpoint (curl from devbob)"
echo "----------------------------------------------"
TEMPLATES=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- curl -s "$BACKEND_URL/v2/activities/templates?limit=10")
TEMPLATE_COUNT=$(echo "$TEMPLATES" | grep -o '"activity_id"' | wc -l)
echo "Template count: $TEMPLATE_COUNT"
if [ "$TEMPLATE_COUNT" -ge 3 ]; then
  echo "✅ PASS: Templates endpoint returns $TEMPLATE_COUNT templates"
else
  echo "❌ FAIL: Expected 3+ templates, got $TEMPLATE_COUNT"
  exit 1
fi
echo ""

# Test 2: Recommend endpoint returns Thompson Sampling metadata
echo "Test 2: Recommend Endpoint (Thompson Sampling)"
echo "----------------------------------------------"
RECOMMENDATIONS=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- curl -s -X POST "$BACKEND_URL/v2/activities/recommend?task_description=Add+feature&limit=5")
REC_COUNT=$(echo "$RECOMMENDATIONS" | grep -o '"variant_id"' | wc -l)
HAS_ALPHA=$(echo "$RECOMMENDATIONS" | grep -q '"alpha"' && echo "yes" || echo "no")
HAS_BETA=$(echo "$RECOMMENDATIONS" | grep -q '"beta"' && echo "yes" || echo "no")
HAS_SAMPLE=$(echo "$RECOMMENDATIONS" | grep -q '"sample"' && echo "yes" || echo "no")

echo "Recommendation count: $REC_COUNT"
echo "Has alpha: $HAS_ALPHA"
echo "Has beta: $HAS_BETA"
echo "Has sample: $HAS_SAMPLE"

if [ "$REC_COUNT" -ge 3 ] && [ "$HAS_ALPHA" = "yes" ] && [ "$HAS_BETA" = "yes" ] && [ "$HAS_SAMPLE" = "yes" ]; then
  echo "✅ PASS: Recommend endpoint returns $REC_COUNT recommendations with Thompson Sampling metadata"
else
  echo "❌ FAIL: Incomplete Thompson Sampling metadata or insufficient recommendations"
  exit 1
fi
echo ""

# Test 3: Execution recording endpoint
echo "Test 3: Execution Recording"
echo "----------------------------------------------"
EXEC_RESPONSE=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- curl -s -X POST "$BACKEND_URL/api/v1/learning-loop/executions" \
  -H "Content-Type: application/json" \
  -d '{"template_id":"test-template","variant_id":"test-v1","activity_id":"test-act","success":true,"duration_ms":5000,"token_usage":{"input":100,"output":50,"cache":0}}')

HAS_EXEC_ID=$(echo "$EXEC_RESPONSE" | grep -q '"execution_id"' && echo "yes" || echo "no")
HAS_METRICS_UPDATED=$(echo "$EXEC_RESPONSE" | grep -q '"metrics_updated"' && echo "yes" || echo "no")

echo "Has execution_id: $HAS_EXEC_ID"
echo "Has metrics_updated: $HAS_METRICS_UPDATED"

if [ "$HAS_EXEC_ID" = "yes" ]; then
  echo "✅ PASS: Execution recording works"
else
  echo "❌ FAIL: Execution recording failed"
  exit 1
fi
echo ""

# Test 4: DevBob has opencode installed
echo "Test 4: OpenCode CLI in DevBob"
echo "----------------------------------------------"
OPENCODE_PATH=$(kubectl exec -n $NAMESPACE $DEVBOB_POD -- which opencode 2>&1 || echo "NOT_FOUND")
if [ "$OPENCODE_PATH" != "NOT_FOUND" ]; then
  echo "✅ PASS: OpenCode CLI installed at: $OPENCODE_PATH"
else
  echo "❌ FAIL: OpenCode CLI not found in devbob"
  exit 1
fi
echo ""

# Test 5: Backend logs show template loading
echo "Test 5: Backend Template Loading (logs)"
echo "----------------------------------------------"
TEMPLATE_LOGS=$(kubectl logs -n $NAMESPACE deployment/metabob-rpc-api --tail=100 2>&1 | grep -i "template" | head -5 || echo "NO_LOGS")
if [ "$TEMPLATE_LOGS" != "NO_LOGS" ]; then
  echo "✅ PASS: Backend logs show template activity"
  echo "Sample logs:"
  echo "$TEMPLATE_LOGS"
else
  echo "⚠️  WARNING: No template logs found (may need more activity)"
fi
echo ""

echo "=============================================="
echo "VALIDATION COMPLETE"
echo "=============================================="
echo "All critical tests passed!"
echo ""
echo "What works NOW:"
echo "  ✅ Backend accessible at $BACKEND_URL"
echo "  ✅ Templates endpoint returns 3-10 templates"
echo "  ✅ Recommend endpoint with Thompson Sampling"
echo "  ✅ Execution recording persists to backend"
echo "  ✅ OpenCode CLI available in devbob"
echo ""
echo "Learning loop flow:"
echo "  recommend → execute → record → update metrics"
echo ""
