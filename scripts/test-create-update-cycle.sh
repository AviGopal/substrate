#!/bin/bash
# Test the full create-then-update cycle

set -e

TEMPLATE_ID="cycle-test-$(date +%s)"
API_URL="http://localhost:8080"

echo "Testing Create-Update Cycle for: $TEMPLATE_ID"
echo ""

# Call 1: Should CREATE new record
echo "[1] First call (should CREATE)..."
curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{"metrics": {"total_executions": 1, "success_rate": 1.0}}' | jq -r '.status'

sleep 2
echo ""
echo "Checking logs after first call..."
docker logs --tail 30 metabob-rpc-api 2>&1 | grep -E "Creating metrics|Created record|get_metrics" | tail -5
echo ""

# Call 2: Should UPDATE existing record
echo "[2] Second call (should UPDATE existing)..."
curl -s -X POST "$API_URL/v2/activities/templates/$TEMPLATE_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{"metrics": {"total_executions": 2, "success_rate": 1.0}}' | jq -r '.status'

sleep 2
echo ""
echo "Checking logs after second call..."
docker logs --tail 30 metabob-rpc-api 2>&1 | grep -E "Creating metrics|get_metrics|Successfully updated" | tail -8
echo ""

# Verify: Should have only ONE record for this template
echo "[3] Verifying only ONE record exists..."
COUNT=$(curl -s -X POST http://localhost:8000/sql \
  -u root:root \
  -H "Content-Type: text/plain" \
  -H "Surreal-NS: metabob" \
  -H "Surreal-DB: metabob" \
  -d "SELECT * FROM template_metrics WHERE variant_id = '$TEMPLATE_ID';" \
  | jq '.[0].result | length')

echo "Records found: $COUNT"
echo ""

if [ "$COUNT" = "1" ]; then
  echo "✅ SUCCESS: Only 1 record (UPDATE worked)"
  curl -s -X POST http://localhost:8000/sql \
    -u root:root \
    -H "Content-Type: text/plain" \
    -H "Surreal-NS: metabob" \
    -H "Surreal-DB: metabob" \
    -d "SELECT variant_id, total_executions, thompson_alpha, thompson_beta FROM template_metrics WHERE variant_id = '$TEMPLATE_ID';" \
    | jq '.[0].result[0]'
else
  echo "❌ FAILED: Found $COUNT records (should be 1)"
  echo "This means UPDATE is not working - creating duplicates instead"
  curl -s -X POST http://localhost:8000/sql \
    -u root:root \
    -H "Content-Type: text/plain" \
    -H "Surreal-NS: metabob" \
    -H "Surreal-DB: metabob" \
    -d "SELECT id, variant_id, total_executions FROM template_metrics WHERE variant_id = '$TEMPLATE_ID';" \
    | jq '.[0].result'
fi
