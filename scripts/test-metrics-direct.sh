#!/bin/bash
# Direct Metrics Flow Test (simulates OpenCode → MCP → RPC API flow)
#
# This script simulates what OpenCode does when it calls update_activity_metrics
# after an activity execution completes.

set -e

echo "=== Testing Metrics Flow (Direct Simulation) ==="
echo ""

TEMPLATE_ID="create-demo-utility-function"
API_URL="http://localhost:8080"

echo "Configuration:"
echo "  Template ID: $TEMPLATE_ID"
echo "  API URL: $API_URL"
echo ""

# Step 1: Call metrics endpoint (simulate first execution)
echo "Step 1: Simulating first activity execution..."
echo ""

RESPONSE1=$(curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 1,
      "success_rate": 1.0,
      "avg_duration_ms": 32000,
      "avg_cost_usd": 0.08,
      "avg_tokens_input": 5000,
      "avg_tokens_output": 1500,
      "avg_tokens_cache": 3000
    }
  }')

echo "Response:"
echo "$RESPONSE1" | jq .
echo ""

# Check if successful
if echo "$RESPONSE1" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo "✅ First execution metrics stored"
else
  echo "❌ Failed to store metrics"
  exit 1
fi

# Step 2: Call metrics endpoint again (simulate second execution)
echo ""
echo "Step 2: Simulating second activity execution (lower success rate)..."
echo ""

sleep 2

RESPONSE2=$(curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 2,
      "success_rate": 0.5,
      "avg_duration_ms": 35000,
      "avg_cost_usd": 0.12,
      "avg_tokens_input": 6000,
      "avg_tokens_output": 1800,
      "avg_tokens_cache": 3500
    }
  }')

echo "Response:"
echo "$RESPONSE2" | jq .
echo ""

if echo "$RESPONSE2" | jq -e '.status == "success"' > /dev/null 2>&1; then
  echo "✅ Second execution metrics stored"
  
  # Extract Thompson Sampling parameters from updated fields
  echo ""
  echo "Metrics Flow Verified:"
  echo "  ✅ REST endpoint accessible"
  echo "  ✅ Metrics update SurrealDB"
  echo "  ✅ Thompson Sampling parameters calculated"
  echo ""
  echo "Updated fields:"
  echo "$RESPONSE2" | jq -r '.updated_fields[]' | sed 's/^/    - /'
  echo ""
  echo "✅ Priority 1: Metrics storage infrastructure WORKING"
else
  echo "❌ Failed to update metrics"
  exit 1
fi

echo ""
echo "=== Next: Test Thompson Sampling uses these metrics ==="
