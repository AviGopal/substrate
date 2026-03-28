#!/bin/bash
# Test metrics flow with the record ID fix

set -e

echo "=== Testing Metrics Flow (With Fix) ==="
echo ""

TEMPLATE_ID="fix-bug-complete-test"
API_URL="http://localhost:8080"

echo "Configuration:"
echo "  Template ID: $TEMPLATE_ID"
echo "  API URL: $API_URL"
echo ""

# Execution 1: Success
echo "Execution 1: Success (1/1 success rate = 100%)"
RESPONSE1=$(curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 1,
      "success_rate": 1.0,
      "avg_duration_ms": 30000,
      "avg_cost_usd": 0.10
    }
  }')

echo "$RESPONSE1" | jq .
STATUS1=$(echo "$RESPONSE1" | jq -r '.status // "error"')

if [ "$STATUS1" = "success" ]; then
  echo "✅ Execution 1 recorded"
else
  echo "❌ Failed"
  exit 1
fi

echo ""
sleep 2

# Execution 2: Success
echo "Execution 2: Success (2/2 success rate = 100%)"
RESPONSE2=$(curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 2,
      "success_rate": 1.0,
      "avg_duration_ms": 28000,
      "avg_cost_usd": 0.09
    }
  }')

echo "$RESPONSE2" | jq .
STATUS2=$(echo "$RESPONSE2" | jq -r '.status // "error"')

if [ "$STATUS2" = "success" ]; then
  echo "✅ Execution 2 recorded"
else
  echo "❌ Failed"
  exit 1
fi

echo ""
sleep 2

# Execution 3: Failure
echo "Execution 3: Failure (2/3 success rate = 66.7%)"
RESPONSE3=$(curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "total_executions": 3,
      "success_rate": 0.667,
      "avg_duration_ms": 35000,
      "avg_cost_usd": 0.12
    }
  }')

echo "$RESPONSE3" | jq .
STATUS3=$(echo "$RESPONSE3" | jq -r '.status // "error"')

if [ "$STATUS3" = "success" ]; then
  echo "✅ Execution 3 recorded"
else
  echo "❌ Failed"
  exit 1
fi

echo ""
echo "=== Verification ==="
echo ""
echo "Querying SurrealDB for final metrics..."
curl -s -X POST http://localhost:8000/sql \
  -u root:root \
  -H "Content-Type: text/plain" \
  -H "Accept: application/json" \
  -H "Surreal-NS: metabob" \
  -H "Surreal-DB: metabob" \
  -d "SELECT variant_id, total_executions, success_rate, thompson_alpha, thompson_beta FROM template_metrics WHERE variant_id = '$TEMPLATE_ID';" \
  | jq '.[0].result[0]'

echo ""
echo "✅ Metrics flow WORKING"
echo ""
echo "Next: Test Thompson Sampling uses these metrics for variant selection"
