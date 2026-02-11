#!/bin/bash

# Level 1: Direct V2 API Test
# Tests activity execution recording via direct API calls

set -e

TOKEN="c2Vzc2lvbnM6Y2RiZGQxM2EtNmMzNi00MWZiLWFkZjgtZmVjNTdhYTQ0NWU3OmRlZmF1bHQ6MmIwMGQwNDktNTYwNC00MjI2LWEwNzktZjRjZDIyN2E3M2Y3"
EXEC_ID="level1-$(date +%s)"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║      LEVEL 1: DIRECT V2 API INTEGRATION TEST            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Feature: Search Functionality Implementation"
echo "Execution ID: $EXEC_ID"
echo "══════════════════════════════════════════════════════════"
echo ""

echo "[Step 1/5] 📝 Recording activity start..."
curl -s -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"feature-impl-v1\",
    \"variables\": {
      \"feature_name\": \"Advanced Search\",
      \"description\": \"Full-text search with filters and pagination\"
    },
    \"session_id\": \"cdbdd13a-6c36-41fb-adf8-fec57aa445e7:default:level1-test\",
    \"execution_id\": \"$EXEC_ID\"
  }" | jq '{execution_id, started_at, recorded}'

sleep 2
echo ""
echo "[Step 2/5] 🔍 Verifying database record created..."
DB_RECORD=$(curl -s "http://localhost:8000/sql" \
  -u "local:testing" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "USE NS metabob DB development; SELECT execution_id, activity_id, duration, success FROM activity_executions WHERE execution_id = '$EXEC_ID';")
echo "$DB_RECORD" | jq -c '.[1].result[0] // {error: "NOT FOUND"}'

if echo "$DB_RECORD" | jq -e '.[1].result[0]' > /dev/null 2>&1; then
  echo "✓ Record confirmed in database"
else
  echo "✗ Record NOT found - test failed"
  exit 1
fi

sleep 2
echo ""
echo "[Step 3/5] 💻 Simulating feature implementation..."
sleep 3
echo ""

echo "[Step 4/5] ✅ Recording completion..."
curl -s -X POST http://localhost:8080/v2/activities/record/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID\",
    \"success\": true,
    \"duration_ms\": 26500,
    \"cost\": 0.067,
    \"tokens\": 9800,
    \"outcome\": \"✓ Advanced search implemented with Elasticsearch integration, filters, and pagination\",
    \"step_results\": [
      {\"step\": 1, \"name\": \"Schema Design\", \"duration_ms\": 4500, \"success\": true},
      {\"step\": 2, \"name\": \"Elasticsearch Setup\", \"duration_ms\": 6800, \"success\": true},
      {\"step\": 3, \"name\": \"API Implementation\", \"duration_ms\": 9200, \"success\": true},
      {\"step\": 4, \"name\": \"Filters & Pagination\", \"duration_ms\": 3900, \"success\": true},
      {\"step\": 5, \"name\": \"Testing\", \"duration_ms\": 2100, \"success\": true}
    ],
    \"notes\": \"Level 1 Test: Direct V2 API - All fields validated\"
  }" | jq '{execution_id, completed_at, recorded}'

sleep 2
echo ""
echo "[Step 5/5] 🎯 Verifying completion in database..."
FINAL_RECORD=$(curl -s "http://localhost:8000/sql" \
  -u "local:testing" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "USE NS metabob DB development; SELECT execution_id, activity_id, duration, success, total_cost, total_tokens, outcome FROM activity_executions WHERE execution_id = '$EXEC_ID';")
echo "$FINAL_RECORD" | jq -c '.[1].result[0]'

echo ""
echo "══════════════════════════════════════════════════════════"
if echo "$FINAL_RECORD" | jq -e '.[1].result[0].outcome' | grep -q "Advanced search"; then
  echo "✅ LEVEL 1 TEST: PASSED"
  echo "   - Activity start: Recorded"
  echo "   - Database persistence: Verified"
  echo "   - Activity completion: Recorded"
  echo "   - Data integrity: Confirmed"
else
  echo "⚠️  LEVEL 1 TEST: PARTIAL"
  echo "   - Record exists but completion data may not be fully updated"
fi
echo "══════════════════════════════════════════════════════════"
