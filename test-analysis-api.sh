#!/bin/bash
# Test script for metabob-analysis-api endpoints

set -e

API_HOST="api.metabob.local"
SESSION_ID="test-validation-session-$(date +%s)"

echo "================================================"
echo "Testing metabob-analysis-api Endpoints"
echo "Session: $SESSION_ID"
echo "================================================"
echo ""

# Test 1: Health endpoint
echo "1. Testing GET /health..."
RESPONSE=$(curl -s -w "\n%{http_code}" "http://$API_HOST/health")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Health check passed"
  echo "   Response: $BODY" | head -c 100
  echo ""
else
  echo "   ✗ Health check failed (Status: $STATUS)"
  echo "   Response: $BODY"
  exit 1
fi
echo ""

# Test 2: Priority issues endpoint
echo "2. Testing GET /v2/analysis/priority..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-Session-ID: $SESSION_ID" \
  "http://$API_HOST/v2/analysis/priority?limit=5")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Priority endpoint passed"
  echo "   Response preview:"
  echo "$BODY" | jq -r '.issues | length' 2>/dev/null && echo "   Issues count: $(echo "$BODY" | jq -r '.issues | length')"
else
  echo "   ✗ Priority endpoint failed (Status: $STATUS)"
  echo "   Response: $BODY"
fi
echo ""

# Test 3: Search endpoint
echo "3. Testing POST /v2/analysis/search..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-Session-ID: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"query":"memory leak","limit":5}' \
  "http://$API_HOST/v2/analysis/search")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Search endpoint passed"
  echo "   Response preview:"
  echo "$BODY" | jq -r '.results | length' 2>/dev/null && echo "   Results count: $(echo "$BODY" | jq -r '.results | length')"
else
  echo "   ✗ Search endpoint failed (Status: $STATUS)"
  echo "   Response: $BODY"
fi
echo ""

# Test 4: Annotations endpoint
echo "4. Testing POST /v2/analysis/annotations..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-Session-ID: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"component_id":"test.ts::function::main::1","content":"Test annotation","type":"design_decision"}' \
  "http://$API_HOST/v2/analysis/annotations")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Annotations endpoint passed"
  echo "   Annotation created: $(echo "$BODY" | jq -r '.annotation_id' 2>/dev/null)"
else
  echo "   ✗ Annotations endpoint failed (Status: $STATUS)"
  echo "   Response: $BODY"
fi
echo ""

# Test 5: Co-change suggestions endpoint
echo "5. Testing POST /v2/analysis/cochange/suggest..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-Session-ID: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"changed_files":["src/auth.ts"],"limit":3,"confidence_threshold":0.5}' \
  "http://$API_HOST/v2/analysis/cochange/suggest")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Co-change endpoint passed"
  echo "   Suggestions count: $(echo "$BODY" | jq -r '.suggestions | length' 2>/dev/null)"
else
  echo "   ✗ Co-change endpoint failed (Status: $STATUS)"
  echo "   Response: $BODY"
fi
echo ""

# Test 6: Impact analysis endpoint
echo "6. Testing POST /v2/analysis/impact..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-Session-ID: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"changed_files":["src/auth.ts"],"max_depth":3}' \
  "http://$API_HOST/v2/analysis/impact")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Impact analysis endpoint passed"
  echo "   Risk level: $(echo "$BODY" | jq -r '.risk_level' 2>/dev/null)"
else
  echo "   ✗ Impact analysis endpoint failed (Status: $STATUS)"
  echo "   Response: $BODY"
fi
echo ""

# Test 7: Spec generation endpoint
echo "7. Testing POST /v2/analysis/specs/generate..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-Session-ID: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"goal":"Implement authentication","context":"User login system","max_depth":3}' \
  "http://$API_HOST/v2/analysis/specs/generate")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Spec generation endpoint passed"
  echo "   Complexity: $(echo "$BODY" | jq -r '.estimated_complexity' 2>/dev/null)"
else
  echo "   ✗ Spec generation endpoint failed (Status: $STATUS)"
  echo "   Response: $BODY"
fi
echo ""

# Test 8: Mark problem complete endpoint
echo "8. Testing PUT /v2/analysis/problems/:id/complete..."
PROBLEM_ID="problem:test-123"
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
  -H "X-Session-ID: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"resolution_summary":"Fixed the issue","fixed_in_commit":"abc123"}' \
  "http://$API_HOST/v2/analysis/problems/$PROBLEM_ID/complete")
STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$STATUS" = "200" ]; then
  echo "   ✓ Problem complete endpoint passed"
  echo "   Problem resolved: $(echo "$BODY" | jq -r '.problem.status' 2>/dev/null)"
else
  echo "   ✗ Problem complete endpoint failed (Status: $STATUS)"
  echo "   Response: $BODY"
fi
echo ""

echo "================================================"
echo "All endpoint tests completed!"
echo "================================================"
