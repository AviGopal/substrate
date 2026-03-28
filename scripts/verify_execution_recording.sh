#!/bin/bash
# Verify Activity Execution Recording
#
# This script verifies that the activity execution recording system is working:
# 1. CLI has valid session token
# 2. Backend accepts recording requests
# 3. Executions are stored and retrievable
# 4. Database contains execution records

set -e

echo "================================================================"
echo "ACTIVITY EXECUTION RECORDING VERIFICATION"
echo "================================================================"
echo ""

# Load token
if [ ! -f ".session_token_working.txt" ]; then
    echo "❌ Error: .session_token_working.txt not found"
    echo "   Run fix_cli_session.py first"
    exit 1
fi

TOKEN=$(cat .session_token_working.txt)
BACKEND="http://localhost:8080"

# Test 1: Check CLI config
echo "[1/5] Checking CLI configuration..."
CLI_CONFIG=~/.metabob/config.json
if [ ! -f "$CLI_CONFIG" ]; then
    echo "❌ CLI config not found: $CLI_CONFIG"
    exit 1
fi

HAS_TOKEN=$(cat "$CLI_CONFIG" | jq -r '.session_token != null and .session_token != ""')
if [ "$HAS_TOKEN" != "true" ]; then
    echo "❌ CLI config missing session_token"
    exit 1
fi
echo "✅ CLI config has valid session_token"

# Test 2: Test session validation
echo ""
echo "[2/5] Testing session validation..."
SESSION_RESPONSE=$(curl -s -X POST "$BACKEND/v2/session" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session_id // empty')
if [ -z "$SESSION_ID" ]; then
    echo "❌ Session validation failed"
    echo "   Response: $SESSION_RESPONSE"
    exit 1
fi
echo "✅ Session valid: $SESSION_ID"

# Test 3: Record test execution
echo ""
echo "[3/5] Recording test execution..."
EXEC_ID="exec_verify_$(date +%s)"
RECORD_RESPONSE=$(curl -s -X POST "$BACKEND/v2/activities/record/start" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"template_id\":\"verification-test\",\"variables\":{},\"session_id\":\"verify-session\",\"execution_id\":\"$EXEC_ID\"}")

RECORDED=$(echo "$RECORD_RESPONSE" | jq -r '.recorded // false')
if [ "$RECORDED" != "true" ]; then
    echo "❌ Recording failed"
    echo "   Response: $RECORD_RESPONSE"
    exit 1
fi
echo "✅ Execution recorded: $EXEC_ID"

# Test 4: Retrieve executions via API
echo ""
echo "[4/5] Retrieving executions via API..."
sleep 1  # Brief delay for consistency
EXEC_RESPONSE=$(curl -s "$BACKEND/v2/activities/executions?limit=100" \
    -H "Authorization: Bearer $TOKEN")

EXEC_COUNT=$(echo "$EXEC_RESPONSE" | jq '.executions | length')
if [ "$EXEC_COUNT" == "null" ] || [ "$EXEC_COUNT" -lt 1 ]; then
    echo "❌ No executions found via API"
    echo "   Response: $EXEC_RESPONSE"
    exit 1
fi
echo "✅ API returned $EXEC_COUNT executions"

# Test 5: Verify in database
echo ""
echo "[5/5] Verifying database storage..."
DB_RESPONSE=$(curl -s -X POST "http://localhost:8000/sql" \
    -u "root:root" \
    -H "Accept: application/json" \
    -d "USE NS metabob; USE DB metabob; SELECT COUNT() as count FROM activity_executions GROUP ALL;")

DB_COUNT=$(echo "$DB_RESPONSE" | jq -r '.[-1].result[0].count // 0')
if [ "$DB_COUNT" -lt 1 ]; then
    echo "❌ No executions found in database"
    echo "   Response: $DB_RESPONSE"
    exit 1
fi
echo "✅ Database contains $DB_COUNT total executions (across all orgs)"

# Summary
echo ""
echo "================================================================"
echo "✅ ALL TESTS PASSED - EXECUTION RECORDING WORKING"
echo "================================================================"
echo ""
echo "Summary:"
echo "  - CLI config: Valid session token"
echo "  - Session: $SESSION_ID"
echo "  - Test execution: $EXEC_ID recorded successfully"
echo "  - API executions: $EXEC_COUNT visible to current session"
echo "  - Database total: $DB_COUNT executions (all orgs)"
echo ""
echo "Next steps:"
echo "  1. Run an actual activity: opencode activity ..."
echo "  2. Verify it appears in: curl $BACKEND/v2/activities/executions"
echo "  3. Test gradient analysis endpoints"
echo ""
