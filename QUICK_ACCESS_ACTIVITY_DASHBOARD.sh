#!/bin/bash
#
# Quick Access Script for Activity Dashboard and API
# 
# This script provides easy access methods for the deployed Activity Dashboard
# and API running in Docker Desktop Kubernetes with Istio.
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Activity Dashboard Quick Access${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if services are running
check_services() {
    echo -e "${YELLOW}Checking service status...${NC}"
    kubectl get pods -n activity-system | grep -E "activity-dashboard|metabob-activity-api" || {
        echo -e "${RED}❌ Services not running. Deploy first with:${NC}"
        echo -e "   cd helm && helmfile -f helmfile-activity-dashboard-istio.yaml sync"
        exit 1
    }
    echo -e "${GREEN}✅ Services are running${NC}"
    echo ""
}

# Check /etc/hosts
check_hosts() {
    echo -e "${YELLOW}Checking /etc/hosts configuration...${NC}"
    if grep -q "dashboard.minibob.local" /etc/hosts && grep -q "api.minibob.local" /etc/hosts; then
        echo -e "${GREEN}✅ /etc/hosts is configured${NC}"
        HOSTS_OK=true
    else
        echo -e "${RED}⚠️  /etc/hosts needs configuration${NC}"
        echo -e "   Add this line:"
        echo -e "   ${YELLOW}127.0.0.1  dashboard.minibob.local api.minibob.local${NC}"
        echo ""
        HOSTS_OK=false
    fi
    echo ""
}

# Test health endpoints
test_health() {
    echo -e "${YELLOW}Testing health endpoints...${NC}"
    
    # Dashboard
    DASHBOARD_HEALTH=$(curl -s http://localhost/health -H "Host: dashboard.minibob.local" | jq -r '.status' 2>/dev/null || echo "error")
    if [ "$DASHBOARD_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✅ Dashboard: healthy${NC}"
    else
        echo -e "${RED}❌ Dashboard: not responding${NC}"
    fi
    
    # API
    API_HEALTH=$(curl -s http://localhost/health -H "Host: api.minibob.local" | jq -r '.status' 2>/dev/null || echo "error")
    if [ "$API_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✅ API: healthy${NC}"
    else
        echo -e "${RED}❌ API: not responding${NC}"
    fi
    echo ""
}

# Show access options
show_access_options() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}Access Options${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    
    if [ "$HOSTS_OK" = true ]; then
        echo -e "${GREEN}Option 1: Direct Access (Recommended)${NC}"
        echo -e "  Dashboard: ${YELLOW}http://dashboard.minibob.local${NC}"
        echo -e "  API:       ${YELLOW}http://api.minibob.local${NC}"
        echo ""
    fi
    
    echo -e "${GREEN}Option 2: Port Forwarding${NC}"
    echo -e "  Terminal 1: kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000"
    echo -e "  Terminal 2: kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080"
    echo -e "  Dashboard: ${YELLOW}http://localhost:3000${NC}"
    echo -e "  API:       ${YELLOW}http://localhost:8080${NC}"
    echo ""
    
    echo -e "${GREEN}Option 3: curl with Host Header${NC}"
    echo -e "  Dashboard: curl http://localhost/health -H \"Host: dashboard.minibob.local\""
    echo -e "  API:       curl http://localhost/health -H \"Host: api.minibob.local\""
    echo ""
}

# Show useful commands
show_commands() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}Useful Commands${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    
    echo -e "${YELLOW}View Logs:${NC}"
    echo -e "  kubectl logs -f -n activity-system -l app.kubernetes.io/name=activity-dashboard"
    echo -e "  kubectl logs -f -n activity-system -l app.kubernetes.io/name=metabob-activity-api"
    echo ""
    
    echo -e "${YELLOW}Check Status:${NC}"
    echo -e "  kubectl get pods -n activity-system"
    echo -e "  kubectl get services -n activity-system"
    echo -e "  kubectl get gateway,virtualservice -n activity-system"
    echo ""
    
    echo -e "${YELLOW}Restart Services:${NC}"
    echo -e "  kubectl rollout restart deployment/activity-dashboard -n activity-system"
    echo -e "  kubectl rollout restart deployment/metabob-activity-api -n activity-system"
    echo ""
    
    echo -e "${YELLOW}Rebuild & Redeploy:${NC}"
    echo -e "  cd repos/activity-dashboard && docker build -t activity-dashboard:latest ."
    echo -e "  cd repos/metabob-activity-api && docker build -t metabob-activity-api:latest ."
    echo -e "  kubectl rollout restart deployment/activity-dashboard -n activity-system"
    echo -e "  kubectl rollout restart deployment/metabob-activity-api -n activity-system"
    echo ""
}

# Interactive mode
interactive_mode() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}Interactive Mode${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    echo "Select an option:"
    echo "  1) Open Dashboard in browser (requires /etc/hosts)"
    echo "  2) Port-forward Dashboard (localhost:3000)"
    echo "  3) Port-forward API (localhost:8080)"
    echo "  4) Test API endpoints"
    echo "  5) View Dashboard logs"
    echo "  6) View API logs"
    echo "  7) Check pod status"
    echo "  0) Exit"
    echo ""
    read -p "Choice: " choice
    
    case $choice in
        1)
            if [ "$HOSTS_OK" = true ]; then
                xdg-open http://dashboard.minibob.local 2>/dev/null || open http://dashboard.minibob.local 2>/dev/null || echo "Open browser to: http://dashboard.minibob.local"
            else
                echo -e "${RED}Please configure /etc/hosts first${NC}"
            fi
            ;;
        2)
            echo -e "${GREEN}Port-forwarding Dashboard to localhost:3000${NC}"
            echo -e "Access at: ${YELLOW}http://localhost:3000${NC}"
            kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000
            ;;
        3)
            echo -e "${GREEN}Port-forwarding API to localhost:8080${NC}"
            echo -e "Access at: ${YELLOW}http://localhost:8080${NC}"
            kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080
            ;;
        4)
            echo -e "${GREEN}Testing API endpoints...${NC}"
            echo ""
            echo -e "${YELLOW}Health:${NC}"
            curl -s http://localhost/health -H "Host: api.minibob.local" | jq .
            echo ""
            echo -e "${YELLOW}Templates:${NC}"
            curl -s http://localhost/templates -H "Host: api.minibob.local" | jq '.[] | {id, name, version}' | head -20
            ;;
        5)
            echo -e "${GREEN}Viewing Dashboard logs (Ctrl+C to exit)${NC}"
            kubectl logs -f -n activity-system -l app.kubernetes.io/name=activity-dashboard
            ;;
        6)
            echo -e "${GREEN}Viewing API logs (Ctrl+C to exit)${NC}"
            kubectl logs -f -n activity-system -l app.kubernetes.io/name=metabob-activity-api
            ;;
        7)
            kubectl get pods -n activity-system
            ;;
        0)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

# Main
main() {
    check_services
    check_hosts
    test_health
    show_access_options
    show_commands
    
    if [ "$1" = "-i" ] || [ "$1" = "--interactive" ]; then
        while true; do
            interactive_mode
            echo ""
            read -p "Press Enter to continue..."
            echo ""
        done
    fi
}

main "$@"
