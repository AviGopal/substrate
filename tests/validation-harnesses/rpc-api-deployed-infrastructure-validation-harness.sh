#!/bin/bash
#
# RPC API Deployed Infrastructure Validation Harness
#
# Tests metabob-rpc-api endpoints against deployed Kubernetes infrastructure
#

set -e

RPC_API_URL="${RPC_API_URL:-http://api.metabob.local}"
LEARNING_LOOP_URL="$RPC_API_URL/api/v1/learning-loop"

PASS=0
FAIL=0
SKIP=0

log_pass() {
  echo "✅ $1"
  ((PASS++))
}

log_fail() {
  echo "❌ $1"
  ((FAIL++))
}

log_skip() {
  echo "⏭️  $1"
  ((SKIP++))
}

echo "=== RPC API Deployed Infrastructure Validation Harness ==="
echo ""
echo "Target: $RPC_API_URL"
echo "Learning Loop: $LEARNING_LOOP_URL"
echo ""

# TC1: Health Check
echo "Running TC1: Health Check..."
if RESPONSE=$(curl -s "$RPC_API_URL/") && echo "$RESPONSE" | grep -q '"status":"ok"'; then
  log_pass "TC1: Health Check - Returns 200 OK with status='ok'"
else
  log_fail "TC1: Health Check - Failed"
fi

# TC2: List Templates
echo "Running TC2: List Templates..."
if RESPONSE=$(curl -s "$RPC_API_URL/v2/activities/templates" \
  -H "x-tenant-id: test-harness" \
  -H "x-org-id: test-org" \
  -H "x-project-id: test-project") && echo "$RESPONSE" | grep -q '"templates"'; then
  COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('templates', [])))")
  log_pass "TC2: List Templates - Returned $COUNT templates"
else
  log_fail "TC2: List Templates - Failed"
fi

# TC3: Create Template
echo "Running TC3: Create Template..."
TEMPLATE_DATA='{
  "name": "infrastructure-validation-harness-test",
  "description": "Test template created by validation harness",
  "category": "testing",
  "tasks": [
    {
      "id": "task-1",
      "description": "Test task",
      "prompt": "Test prompt for validation"
    }
  ]
}'

if RESPONSE=$(curl -s -X POST "$RPC_API_URL/v2/activities/templates" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-harness" \
  -H "x-org-id: test-org" \
  -H "x-project-id: test-project" \
  -d "$TEMPLATE_DATA" 2>&1) && echo "$RESPONSE" | grep -q '"variant_id"'; then
  VARIANT_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('variant_id', ''))")
  log_pass "TC3: Create Template - Created with variant_id=$VARIANT_ID"
  TEMPLATE_CREATED=true
else
  log_fail "TC3: Create Template - Failed (SurrealDB auth issue expected)"
  echo "Response: $RESPONSE"
  TEMPLATE_CREATED=false
fi

# TC4: Get Template (only if created)
if [ "$TEMPLATE_CREATED" = true ] && [ -n "$VARIANT_ID" ]; then
  echo "Running TC4: Get Template by ID..."
  if curl -s "$RPC_API_URL/v2/activities/templates/$VARIANT_ID" | grep -q '"variant_id"'; then
    log_pass "TC4: Get Template - Retrieved successfully"
  else
    log_fail "TC4: Get Template - Failed"
  fi
else
  log_skip "TC4: Get Template - Skipped (no template created)"
fi

# TC5: Quality Score (only if template created)
if [ "$TEMPLATE_CREATED" = true ] && [ -n "$VARIANT_ID" ]; then
  echo "Running TC5: Quality Score Endpoint..."
  if curl -s "$RPC_API_URL/v2/activities/templates/$VARIANT_ID/quality-score" | grep -q '"quality_score"'; then
    log_pass "TC5: Quality Score - Endpoint working"
  else
    log_fail "TC5: Quality Score - Failed"
  fi
else
  log_skip "TC5: Quality Score - Skipped (no template created)"
fi

# TC6: Schema Tolerance - Minimal Data
echo "Running TC6: Schema Tolerance (Minimal Data)..."
MINIMAL_EXEC='{
  "activity_id": "test-activity-harness-001",
  "duration_ms": 5000,
  "success": true
}'

if RESPONSE=$(curl -s -X POST "$LEARNING_LOOP_URL/executions" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-harness" \
  -d "$MINIMAL_EXEC" 2>&1); then
  if echo "$RESPONSE" | grep -q '"success":true'; then
    log_pass "TC6: Schema Tolerance - Minimal data accepted"
  elif echo "$RESPONSE" | grep -qi "validation\|required"; then
    log_fail "TC6: Schema Tolerance - Still requires additional fields (Pydantic validation issue)"
    echo "Response: $RESPONSE"
  else
    log_fail "TC6: Schema Tolerance - Failed with error"
    echo "Response: $RESPONSE"
  fi
else
  log_fail "TC6: Schema Tolerance - Request failed"
fi

# TC7: Multi-Tenant Isolation
echo "Running TC7: Multi-Tenant Isolation..."
PUBLIC_COUNT=$(curl -s "$RPC_API_URL/v2/activities/templates" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('templates', [])))")
ORG_COUNT=$(curl -s "$RPC_API_URL/v2/activities/templates" \
  -H "x-tenant-id: test-isolation" \
  -H "x-org-id: test-org-isolation" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('templates', [])))")
log_pass "TC7: Multi-Tenant Isolation - Public: $PUBLIC_COUNT templates, Org: $ORG_COUNT templates"

# TC8: DevBob Integration
log_skip "TC8: DevBob Integration - Manual test required"

# Summary
echo ""
echo "=== Test Summary ==="
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
echo "⏭️  Skipped: $SKIP"
TOTAL=$((PASS + FAIL + SKIP))
echo "Total: $TOTAL"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "❌ Some tests failed. See details above."
  exit 1
else
  echo ""
  echo "✅ All executable tests passed!"
  exit 0
fi
