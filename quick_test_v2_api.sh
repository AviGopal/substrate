#!/bin/bash
# Quick test script to validate V2 API data flow
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║      V2 API Activity Recording - Quick Test              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Create session
echo "[1/5] Creating session..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "default"}')

TOKEN=$(echo "$SESSION_RESPONSE" | jq -r '.metadata.session_token')
echo "  ✓ Token: ${TOKEN:0:30}..."
echo ""

# Generate execution ID
EXEC_ID="quicktest-$(date +%s)"
echo "[2/5] Starting execution: $EXEC_ID"

# Start execution
curl -s -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"feature-impl-v1\",
    \"variables\": {\"feature_name\": \"Quick Test\"},
    \"session_id\": \"test:quicktest:1\",
    \"execution_id\": \"$EXEC_ID\"
  }" | jq -c '{execution_id, recorded}'

sleep 2
echo ""

# Verify database
echo "[3/5] Verifying database record..."
DB_RECORD=$(curl -s "http://localhost:8000/sql" \
  -u "local:testing" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "USE NS metabob DB development; SELECT execution_id, duration, success FROM activity_executions WHERE execution_id = '$EXEC_ID';")

if echo "$DB_RECORD" | grep -q "$EXEC_ID"; then
  echo "  ✓ Record found in database"
else
  echo "  ✗ Record NOT found"
  exit 1
fi

sleep 1
echo ""

# Complete execution
echo "[4/5] Completing execution..."
curl -s -X POST http://localhost:8080/v2/activities/record/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$EXEC_ID\",
    \"success\": true,
    \"duration_ms\": 12000,
    \"cost\": 0.03,
    \"tokens\": 4500,
    \"outcome\": \"Quick test completed\",
    \"step_results\": [],
    \"notes\": \"Automated validation test\"
  }" | jq -c '{execution_id, recorded}'

sleep 2
echo ""

# Verify completion
echo "[5/5] Verifying completion..."
FINAL=$(curl -s "http://localhost:8000/sql" \
  -u "local:testing" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "USE NS metabob DB development; SELECT execution_id, duration, success, total_cost FROM activity_executions WHERE execution_id = '$EXEC_ID';")

echo "$FINAL" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # SurrealDB returns array: [USE result, SELECT result]
    if len(data) > 1 and data[1].get('result'):
        rec = data[1]['result'][0] if data[1]['result'] else {}
        if rec.get('duration', 0) > 0:
            print(f\"  ✓ Duration updated: {rec['duration']}ms\")
            print(f\"  ✓ Success: {rec['success']}\")
            print(f\"  ✓ Cost: \${rec['total_cost']}\")
            print('')
            print('✅ TEST PASSED - Complete flow validated')
        else:
            print('  ⚠️  Record exists but not fully updated')
    else:
        print('  ✗ Record not found')
except Exception as e:
    print(f'  ⚠️  Parse error: {e}')
"

echo ""
echo "════════════════════════════════════════════════════════════"
