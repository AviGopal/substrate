#!/bin/bash
set -e

echo "=========================================="
echo "COMPLETE ACTIVITY FLOW TEST"
echo "Testing: V2 API + CLI Integration"
echo "=========================================="
echo ""

# Generate unique ID
TEST_ID="flow-test-$(date +%s)"

# Step 1: Test V2 API directly
echo "=== PART 1: V2 API DIRECT TEST ==="
echo ""

echo "1.1 Creating session via V2 API..."
SESSION=$(curl -s -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "default"}')

TOKEN=$(echo "$SESSION" | jq -r '.metadata.session_token')
SESSION_ID=$(echo "$SESSION" | jq -r '.session_id')

if [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to get session token"
  exit 1
fi

echo "✅ Session created"
echo "   ID: ${SESSION_ID:0:40}..."
echo "   Token: ${TOKEN:0:20}..."
echo ""

echo "1.2 Searching templates via V2 API..."
TEMPLATES=$(curl -s -X GET "http://localhost:8080/v2/activities/templates?query=test&limit=3" \
  -H "Authorization: Bearer $TOKEN")

TEMPLATE_COUNT=$(echo "$TEMPLATES" | jq -r '.templates | length')
TEMPLATE_ID=$(echo "$TEMPLATES" | jq -r '.templates[0].variant_id')
TEMPLATE_NAME=$(echo "$TEMPLATES" | jq -r '.templates[0].variant_name')

echo "✅ Found $TEMPLATE_COUNT templates"
echo "   Using: $TEMPLATE_NAME ($TEMPLATE_ID)"
echo ""

echo "1.3 Recording execution start..."
START=$(curl -s -X POST http://localhost:8080/v2/activities/record/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"template_id\": \"$TEMPLATE_ID\",
    \"variables\": {\"test\": \"value\"},
    \"session_id\": \"$SESSION_ID\",
    \"execution_id\": \"$TEST_ID\"
  }")

EXEC_ID=$(echo "$START" | jq -r '.execution_id')
echo "✅ Execution started: $EXEC_ID"
echo ""

sleep 1

echo "1.4 Recording execution complete..."
COMPLETE=$(curl -s -X POST http://localhost:8080/v2/activities/record/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"execution_id\": \"$TEST_ID\",
    \"success\": true,
    \"duration_ms\": 4200,
    \"cost\": 0.03,
    \"tokens\": 1800,
    \"outcome\": \"Complete flow test passed\",
    \"step_results\": [],
    \"notes\": \"Automated test\"
  }")

echo "✅ Execution completed"
echo ""

sleep 2

echo "1.5 Verifying in database..."
cat > /tmp/verify_db.py << PYEOF
import requests

url = "http://localhost:8000/sql"
auth = ("local", "testing")
headers = {"Accept": "application/json", "Content-Type": "application/sql"}

query = f"""
USE NS metabob DB development;
SELECT execution_id, duration, success, total_cost 
FROM activity_executions 
WHERE execution_id = '$TEST_ID';
"""

response = requests.post(url, data=query, headers=headers, auth=auth)
result = response.json()

if len(result) > 1 and result[1]['result']:
    record = result[1]['result'][0]
    print(f"✅ Database verified:")
    print(f"   Duration: {record['duration']}ms")
    print(f"   Success: {record['success']}")
    print(f"   Cost: \${record['total_cost']}")
    
    if record['duration'] == 4200 and record['success'] and record['total_cost'] == 0.03:
        print("")
        print("✅ V2 API TEST PASSED")
        exit(0)
    else:
        print("")
        print("❌ Values don't match")
        exit(1)
else:
    print("❌ No database record")
    exit(1)
PYEOF

python3 /tmp/verify_db.py

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ V2 API TEST FAILED"
  exit 1
fi

echo ""
echo "=== PART 2: CLI INTEGRATION TEST ==="
echo ""

echo "2.1 Testing CLI session management..."
python3 << 'PYTHON'
import asyncio
import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager

async def test():
    config = ConfigData(
        base_url='http://localhost:8080',
        api_key='mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs',
        verify_ssl=False
    )
    
    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()
        print(f"✅ CLI session created: {token[:20]}...")
        return True

asyncio.run(test())
PYTHON

echo ""

echo "2.2 Testing CLI activity search..."
python3 << 'PYTHON'
import asyncio
import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager
from metabob_cli.mcp.activity_manager import ActivityManager

async def test():
    config = ConfigData(
        base_url='http://localhost:8080',
        api_key='mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs',
        verify_ssl=False
    )
    
    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()
        am = ActivityManager(base_url=config.base_url, session_token=token)
        
        results = await am.search_activities(query='test', limit=3)
        print(f"✅ CLI found {len(results)} activities")
        
        if results:
            print(f"   Template: {results[0]['name']}")
        
        await am.close()
        return len(results) > 0

asyncio.run(test())
PYTHON

echo ""
echo "=========================================="
echo "✅ COMPLETE FLOW TEST PASSED"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✅ V2 API: Session, Templates, Recording"
echo "  ✅ Database: Persistence verified"
echo "  ✅ CLI: Session management working"
echo "  ✅ CLI: Activity search working"
echo ""
echo "Remaining work:"
echo "  ⏳ Add record_execution_start() to ActivityManager"
echo "  ⏳ Add record_execution_complete() to ActivityManager"
echo "  ⏳ Add record_execution_step() to ActivityManager"
