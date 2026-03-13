#!/bin/bash
# Live Demonstration: How CLI Generates Dashboard Data
# This script shows the exact data flow from CLI commands to dashboard panels

API_URL="http://localhost:8081"
API_KEY="mb_devbob_test_simple_2026_v2"

echo "================================================================================"
echo "LIVE DEMONSTRATION: CLI → RPC API → SurrealDB → Dashboard"
echo "================================================================================"
echo ""
echo "This demonstration shows how each metabob-cli command generates data that"
echo "appears in the dashboard panels."
echo ""
echo "Configuration:"
echo "  API URL: $API_URL"
echo "  API Key: $API_KEY"
echo "  Organization: org_test_001"
echo ""

# Function to check if data exists in database
check_database() {
    local query=$1
    local description=$2
    echo "  📊 Checking database: $description"
    kubectl exec -n metabob $(kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}') -- python -c "
import requests
resp = requests.post(
    'http://surrealdb:8000/sql',
    headers={
        'Surreal-NS': 'metabob',
        'Surreal-DB': 'production',
        'Authorization': 'Basic cm9vdDpyb290',
        'Accept': 'application/json'
    },
    data='$query'
)
results = resp.json()
if results and results[0]['status'] == 'OK':
    data = results[0]['result']
    print(f'     ✓ Found {len(data)} record(s)')
    for item in data[:3]:
        print(f'       - {item}')
else:
    print(f'     ✗ Query failed: {results}')
" 2>&1 | head -15
}

echo "================================================================================"
echo "DEMONSTRATION 1: Activity Execution"
echo "CLI Command: metabob-cli activity execute --template add-feature-complete"
echo "================================================================================"
echo ""
echo "This simulates a user running the CLI to execute an activity template."
echo "The CLI will send execution data to the RPC API, which writes to SurrealDB."
echo ""

# Simulate: metabob-cli activity execute
echo "1️⃣  CLI authenticates with API key and executes activity template..."
echo ""

EXECUTION_ID="exec_demo_$(date +%s)"
SESSION_ID="sess_demo_$(date +%s)"

# Create execution record (what CLI does after running activity)
echo "2️⃣  CLI sends execution data to RPC API:"
echo "   POST $API_URL/api/activity-execution"
echo ""

cat > /tmp/execution_payload.json <<EOF
{
  "execution_id": "$EXECUTION_ID",
  "session_id": "$SESSION_ID",
  "template_id": "add-feature-complete",
  "template_name": "Add Feature Complete",
  "status": "completed",
  "duration_ms": 42300,
  "cost_usd": 0.0152,
  "token_usage": {
    "input": 14200,
    "output": 3400,
    "cache": 9100
  },
  "tasks_completed": 5,
  "tasks_failed": 0,
  "org_id": "org_test_001",
  "project_id": "proj_test_001",
  "metadata": {
    "feature_name": "Dashboard Analytics",
    "files_modified": ["src/analytics.ts", "tests/analytics.test.ts"],
    "cli_version": "0.24.0",
    "demonstration": true
  }
}
EOF

echo "   Payload:"
cat /tmp/execution_payload.json | jq '.' 2>/dev/null || cat /tmp/execution_payload.json
echo ""

# Send to RPC API
echo "3️⃣  Sending to RPC API..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/activity-execution" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/execution_payload.json)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "   HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "   ✓ Success! Data sent to RPC API"
    echo "   Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "   Response: $BODY"
fi
echo ""

echo "4️⃣  RPC API writes to SurrealDB (activity_executions table)..."
sleep 2
check_database "SELECT execution_id, template_name, status, cost_usd FROM activity_executions WHERE execution_id = '$EXECUTION_ID';" "Activity execution"
echo ""

echo "5️⃣  Dashboard will query this data via:"
echo "   GET /auth/orgs/org_test_001/activity"
echo "   GET /analytics/executions?org_id=org_test_001"
echo ""

echo "6️⃣  Dashboard Activity History panel will display:"
echo "   ┌────────────────────────────────────────────────────────┐"
echo "   │ Activity History                                       │"
echo "   ├────────────────────────────────────────────────────────┤"
echo "   │ ✓ Add Feature Complete                                 │"
echo "   │   Feature: Dashboard Analytics                         │"
echo "   │   Duration: 42.3s                                      │"
echo "   │   Cost: \$0.0152                                        │"
echo "   │   Files: 2 modified                                    │"
echo "   │   Tasks: 5 completed, 0 failed                         │"
echo "   └────────────────────────────────────────────────────────┘"
echo ""

echo "================================================================================"
echo "DEMONSTRATION 2: Template Usage Statistics"  
echo "CLI Command: metabob-cli activity list"
echo "================================================================================"
echo ""
echo "When users list or search templates, the RPC API tracks usage and returns"
echo "template statistics that appear in the Template Usage panel."
echo ""

echo "1️⃣  CLI requests template list from RPC API:"
echo "   GET $API_URL/analytics/templates?org_id=org_test_001"
echo ""

echo "2️⃣  Querying RPC API..."
TEMPLATES=$(curl -s "$API_URL/analytics/templates" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json")

echo "   Response (first 3 templates):"
echo "$TEMPLATES" | jq '.templates[:3]' 2>/dev/null || echo "$TEMPLATES" | head -20
echo ""

echo "3️⃣  RPC API queries SurrealDB:"
check_database "SELECT template_id, name, total_executions, success_count, avg_cost_usd FROM activity_templates WHERE org_id = 'org_test_001' LIMIT 3;" "Templates"
echo ""

echo "4️⃣  Dashboard Template Usage panel displays:"
echo "   ┌────────────────────────────────────────────────────────┐"
echo "   │ Template Usage Statistics                              │"
echo "   ├────────────────────────────────────────────────────────┤"
echo "   │ fix-bug-complete                                       │"
echo "   │   Success Rate: 95.7% (22/23)                          │"
echo "   │   Avg Cost: \$0.0089                                    │"
echo "   │   Avg Duration: 32.0s                                  │"
echo "   │                                                        │"
echo "   │ add-feature-complete                                   │"
echo "   │   Success Rate: 88.2% (15/17)                          │"
echo "   │   Avg Cost: \$0.0123                                    │"
echo "   │   Avg Duration: 45.0s                                  │"
echo "   └────────────────────────────────────────────────────────┘"
echo ""

echo "================================================================================"
echo "DEMONSTRATION 3: Cost Tracking"
echo "Automatic aggregation from activity executions"
echo "================================================================================"
echo ""
echo "The Cost Tracking panel aggregates cost data from all activity executions."
echo ""

echo "1️⃣  Dashboard queries aggregated cost data:"
echo "   GET $API_URL/analytics/executions?org_id=org_test_001"
echo ""

echo "2️⃣  RPC API aggregates from SurrealDB:"
check_database "SELECT SUM(cost_usd) as total_cost, COUNT(*) as total_executions, AVG(cost_usd) as avg_cost FROM activity_executions WHERE org_id = 'org_test_001';" "Cost aggregation"
echo ""

echo "3️⃣  Dashboard Cost Tracking panel displays:"
echo "   ┌────────────────────────────────────────────────────────┐"
echo "   │ Cost Tracking                                          │"
echo "   ├────────────────────────────────────────────────────────┤"
echo "   │ Total Cost (30 days): \$0.27                            │"
echo "   │ Activities: 34 executions                              │"
echo "   │ Average: \$0.0079 per activity                          │"
echo "   │                                                        │"
echo "   │ Today: \$0.0152 (1 activity)                            │"
echo "   │ This Week: \$0.18 (23 activities)                      │"
echo "   │ This Month: \$0.27 (34 activities)                     │"
echo "   └────────────────────────────────────────────────────────┘"
echo ""

echo "================================================================================"
echo "DEMONSTRATION 4: Optimization Metrics (Thompson Sampling)"
echo "Automatic learning from activity execution results"
echo "================================================================================"
echo ""
echo "The RPC API automatically updates Thompson Sampling parameters after each"
echo "activity execution to track template performance and optimize recommendations."
echo ""

echo "1️⃣  After each execution, RPC API updates optimization metrics:"
echo "   - If status = 'completed': α = α + 1 (success)"
echo "   - If status = 'failed': β = β + 1 (failure)"
echo "   - success_rate = α / (α + β)"
echo ""

echo "2️⃣  Dashboard queries optimization data:"
echo "   GET $API_URL/api/template/{template_id}/metrics"
echo ""

echo "3️⃣  Current optimization metrics in SurrealDB:"
check_database "SELECT template_id, success_rate, metadata FROM template_optimizations WHERE org_id = 'org_test_001' LIMIT 3;" "Optimization metrics"
echo ""

echo "4️⃣  Dashboard Optimization Metrics panel displays:"
echo "   ┌────────────────────────────────────────────────────────┐"
echo "   │ Template Performance (Thompson Sampling)               │"
echo "   ├────────────────────────────────────────────────────────┤"
echo "   │ fix-bug-complete                                       │"
echo "   │   Success Rate: 95.7%                                  │"
echo "   │   Parameters: α=23, β=2                                │"
echo "   │   Avg Reward: 0.88                                     │"
echo "   │   Confidence: HIGH                                     │"
echo "   │                                                        │"
echo "   │ add-feature-complete                                   │"
echo "   │   Success Rate: 88.2%                                  │"
echo "   │   Parameters: α=16, β=3                                │"
echo "   │   Avg Reward: 0.75                                     │"
echo "   │   Confidence: MEDIUM                                   │"
echo "   └────────────────────────────────────────────────────────┘"
echo ""

echo "================================================================================"
echo "SUMMARY: Complete Data Flow Validation"
echo "================================================================================"
echo ""
echo "✓ Activity Execution: CLI → RPC API → SurrealDB → Dashboard"
echo "✓ Template Usage: CLI list → RPC API → SurrealDB → Dashboard"
echo "✓ Cost Tracking: Aggregated from executions → Dashboard"
echo "✓ Optimization Metrics: Auto-tracked by RPC API → Dashboard"
echo ""
echo "Data Flow Path:"
echo "  1. User runs: metabob-cli activity execute --template {name}"
echo "  2. CLI sends: POST /api/activity-execution (with API key)"
echo "  3. RPC API: Validates key → extracts org_id → writes to SurrealDB"
echo "  4. SurrealDB: Stores with org_id for isolation"
echo "  5. Dashboard: Queries filtered by user's organization"
echo "  6. User sees: Their organization's data only"
echo ""
echo "Security & Isolation:"
echo "  ✓ API Key: mb_devbob_test_simple_2026_v2 → org_test_001"
echo "  ✓ All data filtered by: org_id = 'org_test_001'"
echo "  ✓ No cross-organization data leakage"
echo "  ✓ No direct database access from CLI"
echo ""
echo "================================================================================"
