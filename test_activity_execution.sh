#!/bin/bash

# Test Activity Execution with Detailed Logging
# This script traces activity execution step by step

set -e

ACTIVITY_ID="infrastructure-86af0790"
LOG_FILE="activity-execution-trace.log"

echo "=== Activity Execution Test ===" | tee $LOG_FILE
echo "Activity ID: $ACTIVITY_ID" | tee -a $LOG_FILE
echo "Timestamp: $(date)" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Step 1: Check backend has the template
echo "[1/5] Checking backend for template..." | tee -a $LOG_FILE
SESSION_TOKEN=$(python3 -c "import json; print(json.load(open('.metabob/state'))['session_metadata']['session_token'])")

BACKEND_CHECK=$(curl -s "http://localhost:8080/v2/activities/templates/$ACTIVITY_ID" \
  -H "Authorization: Bearer $SESSION_TOKEN" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(f\"✅ Backend has template: {data.get('variant_name', 'Unknown')}\")
    print(f\"   Task count: {len(data.get('task_steps', []))}\")
    print(f\"   Fields: id={data.get('id', 'MISSING')}, name={data.get('name', 'MISSING')}\")
except Exception as e:
    print(f\"❌ Backend error: {e}\")
    sys.exit(1)
")
echo "$BACKEND_CHECK" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Step 2: Check metabob-cli transformation
echo "[2/5] Checking metabob-cli transformation..." | tee -a $LOG_FILE
CLI_CHECK=$(cd repos/metabob-cli && python3 -c "
import sys; sys.path.insert(0, 'src')
from metabob_cli.mcp.tools import get_activity_template_tool
import asyncio, json

async def test():
    result_str = await get_activity_template_tool('$ACTIVITY_ID')
    result = json.loads(result_str)
    if result.get('status') == 'success':
        t = result['template']
        print(f\"✅ MCP tool returned template\")
        print(f\"   id: {t.get('id', 'MISSING')}\")
        print(f\"   name: {t.get('name', 'MISSING')}\")
        print(f\"   tasks: {len(t.get('tasks', []))}\")
        if t.get('tasks'):
            task = t['tasks'][0]
            print(f\"   Task[0] id: {task.get('id')}\")
            print(f\"   Task[0] impulseReferences: {'✓' if 'impulseReferences' in task else '✗'}\")
    else:
        print(f\"❌ MCP tool error: {result.get('error')}\")

asyncio.run(test())
" 2>&1 | grep -E "✅|✗|id:|name:|tasks:|Task\[0\]|❌")
echo "$CLI_CHECK" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# Step 3: Check OpenCode can load template
echo "[3/5] Testing OpenCode template loading..." | tee -a $LOG_FILE
echo "   (This requires OpenCode session - checking debug log)" | tee -a $LOG_FILE

# Step 4: Clear old logs and prepare for execution
echo "[4/5] Preparing for activity execution..." | tee -a $LOG_FILE
echo "   Marking activity-debug.log..." | tee -a $LOG_FILE
echo "" >> activity-debug.log
echo "=== TEST WITH DETAILED LOGGING - $(date) ===" >> activity-debug.log
echo "" >> activity-debug.log

# Step 5: Instructions for manual test
echo "[5/5] Ready for activity execution" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "Run this in OpenCode:" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "activity({" | tee -a $LOG_FILE
echo "  activityId: \"$ACTIVITY_ID\"," | tee -a $LOG_FILE
echo "  variables: {message: \"Test execution trace\"}," | tee -a $LOG_FILE
echo "  reason: \"Test with detailed logging to trace execution path\"" | tee -a $LOG_FILE
echo "})" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "After execution, check:" | tee -a $LOG_FILE
echo "  - activity-debug.log (for ACTIVITY EXECUTION START, TOPOLOGICAL SORT, TASK EXECUTION START)" | tee -a $LOG_FILE
echo "  - Look for any ERROR or FAIL messages" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "To view logs in real-time:" | tee -a $LOG_FILE
echo "  tail -f activity-debug.log | grep -E 'ACTIVITY|TASK|ERROR|FAIL'" | tee -a $LOG_FILE
