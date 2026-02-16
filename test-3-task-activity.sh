#!/bin/bash
# Test script for 3-task activity execution with timeout fix

echo "=== Activity Execution Test - 3 Task Template ==="
echo "Date: $(date)"
echo "Testing timeout protection on feature-fdb6afae template"
echo ""

# Clear any old logs
rm -f activity-debug.log

# Search for 3-task template
echo "1. Searching for 3-task templates..."
python3 << 'PYEOF'
from metabob_cli.mcp.tools import search_activities_tool
import json

result = search_activities_tool({"query": "", "category": "feature", "verbose": True})
data = json.loads(result[0].text if hasattr(result[0], 'text') else result[0])

if data.get("status") == "success":
    activities = data.get("activities", [])
    print(f"Found {len(activities)} feature activities")
    
    # Look for 3-task templates
    for act in activities:
        task_count = act.get("task_count", 0)
        if task_count == 3:
            print(f"  ✓ {act['activity_id']}: {act['name']} ({task_count} tasks)")
            print(f"    Success rate: {act.get('success_rate', 'N/A')}")
else:
    print("❌ Search failed:", data.get("error"))
PYEOF

echo ""
echo "2. Ready to execute 3-task template"
echo "   Expected behavior: Timeout after 60s with clear error message"
echo ""
echo "Run this command in OpenCode:"
echo "  activity({ activityId: 'feature-fdb6afae', variables: {...}, reason: 'Test timeout fix' })"
echo ""
