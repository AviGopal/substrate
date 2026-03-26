#!/bin/bash
# Submit self-improvement goals to MiniBob
# This demonstrates using MiniBob to develop the system itself

set -e

API_URL="${API_URL:-http://api.minibob.local}"
PRIORITY="${PRIORITY:-high}"

echo "🤖 MiniBob Self-Development Goal Submission"
echo "=========================================="
echo ""
echo "API URL: $API_URL"
echo "Priority: $PRIORITY"
echo ""

# Function to submit a goal
submit_goal() {
    local goal="$1"
    local priority="${2:-$PRIORITY}"
    local context="$3"

    echo "📝 Submitting goal: $goal"

    payload=$(cat <<EOF
{
  "goal": "$goal",
  "priority": "$priority"
  $([ -n "$context" ] && echo ", \"context\": $context" || echo "")
}
EOF
)

    response=$(curl -s -X POST "$API_URL/v2/activities/boredom/enqueue" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        echo "   ✅ Goal submitted successfully"
        echo "   Task ID: $(echo "$response" | jq -r '.task_id // "pending"')"
    else
        echo "   ❌ Failed to submit goal"
        echo "   Response: $response"
    fi
    echo ""
}

# Check API is accessible
echo "🔍 Checking API accessibility..."
if ! curl -s "$API_URL/health" > /dev/null; then
    echo "❌ Cannot reach API at $API_URL"
    echo "   Make sure the activity system is deployed:"
    echo "   kubectl get pods -n activity-system"
    exit 1
fi
echo "✅ API is accessible"
echo ""

# Check current queue status
echo "📊 Current boredom queue status:"
curl -s "$API_URL/v2/activities/boredom/queue" | jq .
echo ""

# Ask user what to submit
echo "🎯 What would you like MiniBob to work on?"
echo ""
echo "Quick options:"
echo "  1) Fix all dashboard data issues (from validation report)"
echo "  2) Add execution trace creation to MiniBob"
echo "  3) Implement vessel heartbeats"
echo "  4) Fix code-variants session.org_id error"
echo "  5) Add dark mode to dashboard"
echo "  6) Custom goal (you'll be prompted)"
echo "  7) Submit all critical fixes"
echo "  0) Exit"
echo ""
read -p "Select option (0-7): " option

case $option in
    1)
        echo "🔧 Submitting all dashboard data fixes..."

        submit_goal \
            "Fix session.org_id null reference in code-variants route" \
            "critical" \
            '{"repo":"metabob-activity-api","file":"src/routes/code-variants.ts","error":"null is not an object (evaluating session.org_id)"}'

        submit_goal \
            "Add execution trace creation to MiniBob after each activity execution" \
            "high" \
            '{"repo":"minibob","file":"src/activity.ts","endpoint":"POST /v2/activities/execution-traces"}'

        submit_goal \
            "Implement vessel heartbeat sender in MiniBob that POSTs to /v2/vessels/heartbeat every 30 seconds" \
            "high" \
            '{"repo":"minibob","new_file":"src/heartbeat.ts","integration":"src/index.ts"}'
        ;;

    2)
        submit_goal \
            "Add execution trace creation to MiniBob after each activity execution. Call POST /v2/activities/execution-traces with full state snapshot including tasks, tool calls, files modified, and impulses used." \
            "high" \
            '{"repo":"minibob","file":"src/activity.ts","example_trace":{"execution_id":"exec-123","template_id":"code-change-feature","status":"success","tasks":[{"task_id":"task-1","status":"completed","tool_calls":[]}],"impulses_used":[],"component_changes":[]}}'
        ;;

    3)
        submit_goal \
            "Implement vessel heartbeat sender in MiniBob. Create src/heartbeat.ts with HeartbeatSender class that sends POST requests to /v2/vessels/heartbeat every 30 seconds with pod status, current activity, and metrics." \
            "high" \
            '{"repo":"minibob","implementation":{"new_file":"src/heartbeat.ts","integrate_into":"src/index.ts","interval_ms":30000,"payload_fields":["pod_name","namespace","status","current_activity","metrics"]}}'
        ;;

    4)
        submit_goal \
            "Fix session.org_id null reference error in code-variants route. Make org_id optional and default to null when session doesn't provide it." \
            "critical" \
            '{"repo":"metabob-activity-api","file":"src/routes/code-variants.ts","line":122,"fix":"const orgId = session?.org_id || null"}'
        ;;

    5)
        submit_goal \
            "Add dark mode toggle to activity dashboard with persistent state in localStorage. Add toggle button in header that switches between light and dark themes." \
            "medium" \
            '{"repo":"activity-dashboard","files":["src/App.tsx","src/index.css"],"requirements":["Toggle button in header","Save preference to localStorage","Apply dark theme classes","Respect system preference on first load"]}'
        ;;

    6)
        echo ""
        read -p "Enter your goal: " custom_goal
        read -p "Priority (critical/high/medium/low): " custom_priority
        read -p "Context (JSON, or leave blank): " custom_context

        submit_goal "$custom_goal" "${custom_priority:-high}" "$custom_context"
        ;;

    7)
        echo "🚨 Submitting all critical fixes..."

        # From validation report
        submit_goal \
            "Fix session.org_id null reference in code-variants route" \
            "critical"

        submit_goal \
            "Add execution trace creation to MiniBob after each activity execution" \
            "high"

        submit_goal \
            "Implement vessel heartbeat sender in MiniBob" \
            "high"

        echo "📊 Submitted 3 critical goals"
        ;;

    0)
        echo "👋 Exiting without submitting"
        exit 0
        ;;

    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "✅ Goal submission complete!"
echo ""
echo "📺 Monitor progress:"
echo "   Dashboard: http://dashboard.minibob.local (Executions tab)"
echo "   API: curl '$API_URL/v2/activities/execution-traces?limit=5' | jq ."
echo "   Logs: kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f"
echo ""
echo "📊 Check queue:"
echo "   curl '$API_URL/v2/activities/boredom/queue' | jq ."
echo ""
