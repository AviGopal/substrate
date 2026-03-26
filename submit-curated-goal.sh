#!/bin/bash
# Submit well-formed curated goals to MiniBob
# This ensures goals have enough context to succeed

set -e

API_URL="${API_URL:-http://api.minibob.local}"

echo "🎯 Curated Goal Submission"
echo "=========================="
echo ""

# Function to create well-formed goal
create_goal() {
    local goal="$1"
    local priority="${2:-medium}"
    local repo="$3"
    local file="$4"
    local extra_context="$5"

    cat <<EOF
{
  "goal": "$goal",
  "priority": "$priority",
  "context": {
    "repo": "$repo",
    "file": "$file"
    $([ -n "$extra_context" ] && echo ", $extra_context" || echo "")
  }
}
EOF
}

# Quick templates for common goals
case "${1:-menu}" in
    "execution-traces")
        echo "📝 Submitting: Add execution trace creation to MiniBob"
        goal=$(create_goal \
            "Add execution trace creation to MiniBob. After every activity execution (success or failure), call POST /v2/activities/execution-traces with full state snapshot including execution_id, template_id, status, duration_ms, cost, tasks array with tool_calls, impulses_used, files_modified, and error_message if failed." \
            "critical" \
            "minibob" \
            "src/activity.ts" \
            '"endpoint": "POST /v2/activities/execution-traces", "implementation": "Add traceExecution() function called after activity completes", "validation": "Execution traces appear in dashboard after activity runs"')
        ;;

    "cost-controls")
        echo "📝 Submitting: Add cost controls to boredom route"
        goal=$(create_goal \
            "Add execution policy to boredom route that enforces: max 3 retries per template, minimum 20% success rate to execute, 1 hour cooldown after failures, and $0.50 max cost per task. Block tasks that violate policy and log reason." \
            "high" \
            "metabob-activity-api" \
            "src/routes/boredom.ts" \
            '"policy": {"maxRetriesPerTemplate": 3, "minTemplateSuccessRate": 0.20, "cooldownPeriodMs": 3600000, "maxCostPerTask": 0.50}')
        ;;

    "code-variants-fix")
        echo "📝 Submitting: Fix code-variants session.org_id error"
        goal=$(create_goal \
            "Fix session.org_id null reference in code-variants route by making org_id optional with default null value. Change line 122 to use optional chaining." \
            "critical" \
            "metabob-activity-api" \
            "src/routes/code-variants.ts" \
            '"error": "null is not an object (evaluating session.org_id)", "line": 122, "fix": "const orgId = session?.org_id || null;", "validation": "API returns variants without error"')
        ;;

    "vessel-heartbeat")
        echo "📝 Submitting: Add vessel heartbeat sender"
        goal=$(create_goal \
            "Implement vessel heartbeat sender in MiniBob. Create src/heartbeat.ts with HeartbeatSender class that POSTs to /v2/vessels/heartbeat every 30 seconds with pod status, current activity, and metrics. Integrate into src/index.ts startup." \
            "high" \
            "minibob" \
            "src/heartbeat.ts" \
            '"integration_file": "src/index.ts", "interval_ms": 30000, "endpoint": "POST /v2/vessels/heartbeat", "validation": "Vessels tab shows MiniBob pods with recent heartbeats"')
        ;;

    "dashboard-health")
        echo "📝 Submitting: Add health endpoint to dashboard"
        goal=$(create_goal \
            "Add GET /health endpoint to dashboard that returns JSON with status (healthy/degraded), uptime in seconds, and version string. Should be accessible without authentication." \
            "medium" \
            "activity-dashboard" \
            "src/index.ts" \
            '"endpoint": "/health", "response": {"status": "healthy", "uptime": 12345, "version": "1.0.0"}, "validation": "curl localhost:3000/health returns 200 with JSON"')
        ;;

    "custom")
        echo "📝 Custom goal submission"
        echo ""
        read -p "Goal description: " goal_desc
        read -p "Priority (critical/high/medium/low): " priority
        read -p "Repository: " repo
        read -p "Primary file: " file
        read -p "Additional context (JSON format, or leave blank): " extra

        goal=$(create_goal "$goal_desc" "${priority:-medium}" "$repo" "$file" "$extra")
        ;;

    "menu"|*)
        echo "Available curated goals:"
        echo ""
        echo "  execution-traces  - Add execution trace creation to MiniBob (CRITICAL)"
        echo "  cost-controls     - Add execution policy to prevent waste (HIGH)"
        echo "  code-variants-fix - Fix session.org_id error in variants API (CRITICAL)"
        echo "  vessel-heartbeat  - Add vessel heartbeat sender (HIGH)"
        echo "  dashboard-health  - Add /health endpoint to dashboard (MEDIUM)"
        echo "  custom            - Create custom goal with prompts"
        echo ""
        echo "Usage: $0 <goal-name>"
        echo "   or: $0 custom"
        echo ""
        echo "Recommended order:"
        echo "  1. execution-traces  (enables learning from all future executions)"
        echo "  2. cost-controls     (prevents wasteful retries)"
        echo "  3. code-variants-fix (fixes known bug)"
        echo "  4. vessel-heartbeat  (enables vessel monitoring)"
        echo ""
        exit 0
        ;;
esac

# Display goal for review
echo ""
echo "Goal to submit:"
echo "==============="
echo "$goal" | jq .
echo ""

# Estimate success probability
echo "📊 Goal Analysis:"
echo "  - Has repo specified: ✅"
echo "  - Has file specified: ✅"
echo "  - Has clear success criteria: $(echo "$goal" | grep -q validation && echo "✅" || echo "⚠️")"
echo "  - Estimated cost: ~$0.15-0.30"
echo ""

read -p "Submit this goal? (y/n) " confirm

if [ "$confirm" != "y" ]; then
    echo "❌ Cancelled"
    exit 0
fi

# Submit
echo ""
echo "📤 Submitting goal..."
response=$(curl -s -X POST "$API_URL/v2/activities/boredom/enqueue" \
    -H "Content-Type: application/json" \
    -d "$goal")

echo "$response" | jq .

if echo "$response" | jq -e '.success or .task_id' > /dev/null 2>&1; then
    echo ""
    echo "✅ Goal submitted successfully!"
    echo ""
    echo "📺 Monitor progress:"
    echo "   Dashboard: http://dashboard.minibob.local (Executions tab)"
    echo "   Logs: kubectl logs -n activity-system -l app.kubernetes.io/name=minibob -f"
    echo ""
    echo "📊 Check status:"
    echo "   curl '$API_URL/v2/activities/boredom/queue' | jq ."
else
    echo ""
    echo "❌ Failed to submit goal"
    echo "Response: $response"
    exit 1
fi
