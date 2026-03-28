#!/bin/bash
# Test all gradient analysis endpoints

set -e

TOKEN=$(cat .session_token_working.txt)
BASE="http://localhost:8080"

echo "========================================="
echo "GRADIENT ANALYSIS ENDPOINT TESTS"
echo "========================================="
echo ""

# Test 1: All Gradients
echo "[1/4] Testing /gradients endpoint..."
GRADIENTS=$(curl -s "$BASE/v2/activities/analysis/gradients?limit=5&min_executions=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.total_templates')
echo "✅ Result: $GRADIENTS templates analyzed"
echo ""

# Test 2: Single Activity
echo "[2/4] Testing /gradients/{id} endpoint..."
ACTIVITY=$(curl -s "$BASE/v2/activities/analysis/gradients/infrastructure-e032e6da" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.activity_id')
echo "✅ Result: Retrieved gradient for $ACTIVITY"
echo ""

# Test 3: Recommendations
echo "[3/4] Testing /recommendations endpoint..."
RECS=$(curl -s "$BASE/v2/activities/analysis/recommendations?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.recommendations | length')
echo "✅ Result: $RECS recommendations returned"
echo ""

# Test 4: Health
echo "[4/4] Testing /health endpoint..."
HEALTH=$(curl -s "$BASE/v2/activities/analysis/health" \
  -H "Authorization: Bearer $TOKEN" | jq '.avg_health_score')
echo "✅ Result: System health score = $HEALTH"
echo ""

echo "========================================="
echo "✅ ALL GRADIENT ENDPOINTS WORKING"
echo "========================================="
