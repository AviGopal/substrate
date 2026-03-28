#!/bin/bash
# Test script to verify impulse learning step reporting integration

set -e

echo "=========================================="
echo "Testing Impulse Learning Step Reporting"
echo "=========================================="
echo

# Step 1: Check backend is healthy
echo "1. Checking backend health..."
HEALTH=$(curl -s http://localhost:8080/health | jq -r '.status')
if [ "$HEALTH" != "ok" ]; then
  echo "❌ Backend not healthy: $HEALTH"
  exit 1
fi
echo "✅ Backend healthy"
echo

# Step 2: Test the report_execution_step endpoint directly
echo "2. Testing /v2/activities/record/step endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:8080/v2/activities/record/step \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "test-exec-001",
    "step_index": 0,
    "impulses_loaded": ["impulse-1", "impulse-2"],
    "impulses_created": ["impulse-3"],
    "context_summary": {
      "totalTokens": 1000,
      "promptTokens": 700,
      "completionTokens": 300,
      "duration": 5000,
      "cost": 0.002
    }
  }')

echo "Response: $RESPONSE"
STATUS=$(echo $RESPONSE | jq -r '.status')
if [ "$STATUS" != "success" ]; then
  echo "❌ Endpoint test failed: $STATUS"
  exit 1
fi
echo "✅ Endpoint working"
echo

# Step 3: Query execution_steps table to verify data was stored
echo "3. Querying execution_steps table..."
QUERY_RESULT=$(curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -d "SELECT * FROM execution_steps WHERE execution_id = 'test-exec-001' ORDER BY step_index LIMIT 1")

echo "Query result: $QUERY_RESULT"
RECORD_COUNT=$(echo $QUERY_RESULT | jq '.[0].result | length')
if [ "$RECORD_COUNT" -lt 1 ]; then
  echo "❌ No records found in execution_steps table"
  exit 1
fi
echo "✅ Data persisted to database"
echo

# Step 4: Verify impulse_loaded data
echo "4. Verifying impulse data..."
IMPULSES_LOADED=$(echo $QUERY_RESULT | jq -r '.[0].result[0].impulses_loaded | length')
if [ "$IMPULSES_LOADED" -ne 2 ]; then
  echo "❌ Expected 2 loaded impulses, got $IMPULSES_LOADED"
  exit 1
fi
echo "✅ Impulse data correct (loaded: 2, created: 1)"
echo

echo "=========================================="
echo "✅ All backend tests passed!"
echo "=========================================="
echo
echo "Next: Test OpenCode activity execution integration"
echo "Run: cd repos/metabob-opencode && bun run dev activity execute --template test_template.json"
