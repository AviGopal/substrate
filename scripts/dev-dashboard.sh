#!/bin/bash

# Dev Dashboard Helper Script
# Makes it easy to develop/test the Activity Dashboard

set -e

DASHBOARD_NS="activity-system"
DASHBOARD_SVC="activity-dashboard"
DASHBOARD_PORT="3000"
MINIBOB_NS="testing-minibob"
MINIBOB_POD="minibob-testing-cluster-minibob-cluster-6947d6546b-82spw"

show_help() {
    cat << EOF
🔧 Activity Dashboard Dev Helper

Usage: ./dev-dashboard.sh [command]

Commands:
    forward         Port-forward dashboard to localhost:3000
    logs            Follow dashboard logs
    restart         Restart dashboard deployment
    exec            Interactive shell in dashboard pod
    minibob         Interactive shell in MiniBob pod
    test            Run activity in MiniBob and check dashboard
    playwright      Open dashboard in Playwright browser
    all             Port-forward + open browser + tail logs

Examples:
    ./dev-dashboard.sh forward
    ./dev-dashboard.sh minibob
    ./dev-dashboard.sh test
    ./dev-dashboard.sh all
EOF
}

port_forward() {
    echo "📡 Port-forwarding dashboard to localhost:${DASHBOARD_PORT}..."
    echo "   Access at: http://localhost:${DASHBOARD_PORT}"
    echo "   Press Ctrl+C to stop"
    kubectl port-forward -n ${DASHBOARD_NS} svc/${DASHBOARD_SVC} ${DASHBOARD_PORT}:${DASHBOARD_PORT}
}

follow_logs() {
    echo "📋 Following dashboard logs..."
    kubectl logs -n ${DASHBOARD_NS} deployment/${DASHBOARD_SVC} -f
}

restart_dashboard() {
    echo "🔄 Restarting dashboard..."
    kubectl rollout restart deployment/${DASHBOARD_SVC} -n ${DASHBOARD_NS}
    kubectl rollout status deployment/${DASHBOARD_SVC} -n ${DASHBOARD_NS} --timeout=60s
    echo "✅ Dashboard restarted"
}

exec_dashboard() {
    echo "🔧 Opening shell in dashboard pod..."
    POD=$(kubectl get pods -n ${DASHBOARD_NS} -l app=activity-dashboard -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -it -n ${DASHBOARD_NS} ${POD} -- /bin/sh
}

exec_minibob() {
    echo "🤖 Opening shell in MiniBob pod..."
    echo "   Working directory: /app"
    echo "   MCP endpoint configured: http://api.metabob.local/mcp"
    echo ""
    echo "   Try these commands:"
    echo "   - ls -la templates/        # View available templates"
    echo "   - node dist/index.js       # Run MiniBob CLI"
    echo "   - cat opencode.json        # View configuration"
    echo ""
    kubectl exec -it -n ${MINIBOB_NS} ${MINIBOB_POD} -- /bin/bash
}

run_test() {
    echo "🧪 Testing Activity Dashboard with MiniBob"
    echo ""
    echo "Step 1: Execute an activity in MiniBob"
    echo "----------------------------------------"
    
    kubectl exec -n ${MINIBOB_NS} ${MINIBOB_POD} -- /bin/bash -c '
        cd /app
        if [ -f templates/generate-greeting.json ]; then
            echo "✅ Found generate-greeting template"
            echo "Executing activity..."
            # This would execute the activity
            # node dist/index.js execute templates/generate-greeting.json --name "Developer"
        else
            echo "⚠️  Template not found, listing available templates:"
            ls -la templates/ 2>/dev/null || echo "No templates directory"
        fi
    '
    
    echo ""
    echo "Step 2: Check dashboard for updates"
    echo "------------------------------------"
    echo "Open http://localhost:3000 or http://dashboard.minibob.local"
    echo ""
    
    echo "Step 3: Query API directly"
    echo "--------------------------"
    kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -n ${DASHBOARD_NS} -- \
        curl -s http://metabob-activity-api:8080/v2/activities/templates | head -50
}

open_playwright() {
    echo "🎭 Opening dashboard in Playwright..."
    echo ""
    echo "We'll use OpenCode's Playwright MCP to:"
    echo "1. Navigate to http://localhost:3000"
    echo "2. Take screenshots"
    echo "3. Test hot-reload"
    echo ""
    echo "First, make sure port-forward is running in another terminal:"
    echo "   ./dev-dashboard.sh forward"
    echo ""
    read -p "Press Enter when port-forward is ready..."
    
    echo ""
    echo "Run this in your OpenCode session:"
    echo ""
    echo "playwright_browser_navigate({ url: 'http://localhost:3000' })"
    echo "playwright_browser_snapshot({ filename: 'dashboard-snapshot.md' })"
    echo "playwright_browser_take_screenshot({ filename: 'dashboard.png' })"
}

run_all() {
    echo "🚀 Starting full dev environment..."
    echo ""
    
    # Start port-forward in background
    echo "Starting port-forward..."
    kubectl port-forward -n ${DASHBOARD_NS} svc/${DASHBOARD_SVC} ${DASHBOARD_PORT}:${DASHBOARD_PORT} &
    PF_PID=$!
    
    # Wait for port to be ready
    sleep 3
    
    echo ""
    echo "✅ Dashboard available at http://localhost:${DASHBOARD_PORT}"
    echo ""
    echo "📋 Dashboard Logs:"
    echo "===================="
    
    # Show logs
    kubectl logs -n ${DASHBOARD_NS} deployment/${DASHBOARD_SVC} --tail=20
    
    echo ""
    echo "🎯 Ready for development!"
    echo ""
    echo "- Dashboard: http://localhost:${DASHBOARD_PORT}"
    echo "- API: http://localhost:${DASHBOARD_PORT}/v2/activities/templates"
    echo "- Health: http://localhost:${DASHBOARD_PORT}/health"
    echo ""
    echo "Press Ctrl+C to stop port-forward"
    
    # Wait for interrupt
    trap "kill $PF_PID 2>/dev/null; exit" INT TERM
    wait $PF_PID
}

# Main command dispatcher
case "${1:-help}" in
    forward)
        port_forward
        ;;
    logs)
        follow_logs
        ;;
    restart)
        restart_dashboard
        ;;
    exec)
        exec_dashboard
        ;;
    minibob)
        exec_minibob
        ;;
    test)
        run_test
        ;;
    playwright)
        open_playwright
        ;;
    all)
        run_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
