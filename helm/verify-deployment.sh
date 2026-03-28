#!/bin/bash
# Activity Dashboard + API Deployment Verification Script
# Checks all components and reports deployment status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Track overall status
ERRORS=0
WARNINGS=0

print_header "Activity Dashboard + API Deployment Verification"

# 1. Check Kubernetes context
print_info "Checking Kubernetes context..."
CONTEXT=$(kubectl config current-context)
if [ "$CONTEXT" = "docker-desktop" ]; then
    print_success "Kubernetes context: $CONTEXT"
else
    print_warning "Kubernetes context is '$CONTEXT' (expected 'docker-desktop')"
    WARNINGS=$((WARNINGS + 1))
fi

# 2. Check namespace
print_info "Checking namespace..."
if kubectl get namespace activity-system &> /dev/null; then
    print_success "Namespace 'activity-system' exists"
    
    # Check if Istio injection is enabled
    ISTIO_LABEL=$(kubectl get namespace activity-system -o jsonpath='{.metadata.labels.istio-injection}')
    if [ "$ISTIO_LABEL" = "enabled" ]; then
        print_success "Istio injection enabled on namespace"
    else
        print_warning "Istio injection not enabled (label: istio-injection=$ISTIO_LABEL)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    print_error "Namespace 'activity-system' not found"
    ERRORS=$((ERRORS + 1))
fi

# 3. Check pods
print_info "Checking pods..."
EXPECTED_PODS=("activity-dashboard" "metabob-activity-api" "redis-master" "surrealdb")

for pod_prefix in "${EXPECTED_PODS[@]}"; do
    POD_STATUS=$(kubectl get pods -n activity-system -l "app.kubernetes.io/name=${pod_prefix}" -o jsonpath='{.items[0].status.phase}' 2>/dev/null || \
                 kubectl get pods -n activity-system | grep "^${pod_prefix}" | awk '{print $3}' | head -1)
    
    if [ "$POD_STATUS" = "Running" ]; then
        # Check ready count
        READY=$(kubectl get pods -n activity-system | grep "^${pod_prefix}" | awk '{print $2}' | head -1)
        print_success "Pod ${pod_prefix}: Running ($READY)"
    elif [ -z "$POD_STATUS" ]; then
        print_error "Pod ${pod_prefix}: Not found"
        ERRORS=$((ERRORS + 1))
    else
        print_error "Pod ${pod_prefix}: $POD_STATUS"
        ERRORS=$((ERRORS + 1))
    fi
done

# 4. Check services
print_info "Checking services..."
EXPECTED_SERVICES=("activity-dashboard:3000" "metabob-activity-api:8080" "redis-master:6379" "surrealdb:8000")

for svc_port in "${EXPECTED_SERVICES[@]}"; do
    SVC_NAME=$(echo $svc_port | cut -d: -f1)
    EXPECTED_PORT=$(echo $svc_port | cut -d: -f2)
    
    if kubectl get svc -n activity-system "$SVC_NAME" &> /dev/null; then
        ACTUAL_PORT=$(kubectl get svc -n activity-system "$SVC_NAME" -o jsonpath='{.spec.ports[0].port}')
        CLUSTER_IP=$(kubectl get svc -n activity-system "$SVC_NAME" -o jsonpath='{.spec.clusterIP}')
        
        if [ "$ACTUAL_PORT" = "$EXPECTED_PORT" ]; then
            print_success "Service ${SVC_NAME}: $CLUSTER_IP:$ACTUAL_PORT"
        else
            print_warning "Service ${SVC_NAME}: Port mismatch (expected $EXPECTED_PORT, got $ACTUAL_PORT)"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        print_error "Service ${SVC_NAME}: Not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# 5. Check Istio components
print_info "Checking Istio configuration..."

# Check if Istio is installed
if kubectl get namespace istio-system &> /dev/null; then
    print_success "Istio namespace exists"
    
    # Check ingress gateway
    if kubectl get svc -n istio-system istio-ingressgateway &> /dev/null; then
        GATEWAY_IP=$(kubectl get svc -n istio-system istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
        print_success "Istio ingress gateway: $GATEWAY_IP"
    else
        print_error "Istio ingress gateway not found"
        ERRORS=$((ERRORS + 1))
    fi
else
    print_error "Istio not installed (istio-system namespace not found)"
    ERRORS=$((ERRORS + 1))
fi

# Check Gateway
if kubectl get gateway -n activity-system activity-system-gateway &> /dev/null; then
    print_success "Istio Gateway 'activity-system-gateway' configured"
else
    print_error "Istio Gateway 'activity-system-gateway' not found"
    ERRORS=$((ERRORS + 1))
fi

# Check VirtualServices
EXPECTED_VS=("activity-dashboard" "metabob-activity-api")
for vs in "${EXPECTED_VS[@]}"; do
    if kubectl get virtualservice -n activity-system "$vs" &> /dev/null; then
        HOST=$(kubectl get virtualservice -n activity-system "$vs" -o jsonpath='{.spec.hosts[0]}')
        print_success "VirtualService ${vs}: $HOST"
    else
        print_error "VirtualService ${vs}: Not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# 6. Check /etc/hosts
print_info "Checking /etc/hosts configuration..."
HOSTS_FILE="/etc/hosts"

if grep -q "dashboard.minibob.local" "$HOSTS_FILE" && grep -q "api.minibob.local" "$HOSTS_FILE"; then
    HOSTS_LINE=$(grep "minibob.local" "$HOSTS_FILE" | head -1)
    print_success "/etc/hosts configured: $HOSTS_LINE"
    
    # Check for syntax errors (commas)
    if echo "$HOSTS_LINE" | grep -q ","; then
        print_warning "/etc/hosts may have syntax errors (contains commas)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    print_error "/etc/hosts not configured for minibob.local domains"
    ERRORS=$((ERRORS + 1))
    print_info "Add this line to /etc/hosts:"
    echo "    127.0.0.1  dashboard.minibob.local api.minibob.local"
fi

# 7. Test HTTP connectivity
print_info "Testing HTTP connectivity..."

# Test dashboard
DASHBOARD_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://dashboard.minibob.local 2>/dev/null || echo "000")
if [ "$DASHBOARD_HTTP" = "200" ] || [ "$DASHBOARD_HTTP" = "304" ]; then
    print_success "Dashboard accessible: http://dashboard.minibob.local (HTTP $DASHBOARD_HTTP)"
else
    print_error "Dashboard not accessible: http://dashboard.minibob.local (HTTP $DASHBOARD_HTTP)"
    ERRORS=$((ERRORS + 1))
fi

# Test API health
API_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://api.minibob.local/health 2>/dev/null || echo "000")
if [ "$API_HTTP" = "200" ]; then
    print_success "API health endpoint: http://api.minibob.local/health (HTTP $API_HTTP)"
else
    print_error "API health endpoint not accessible: http://api.minibob.local/health (HTTP $API_HTTP)"
    ERRORS=$((ERRORS + 1))
fi

# 8. Check resource usage
print_info "Checking resource usage..."
if command -v kubectl &> /dev/null; then
    echo ""
    kubectl top pods -n activity-system 2>/dev/null || print_warning "Metrics server not available (kubectl top failed)"
fi

# 9. Summary
print_header "Verification Summary"

echo -e "Kubernetes Context: ${BLUE}$CONTEXT${NC}"
echo -e "Namespace:          ${BLUE}activity-system${NC}"
echo -e "Dashboard URL:      ${BLUE}http://dashboard.minibob.local${NC}"
echo -e "API URL:            ${BLUE}http://api.minibob.local${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    print_success "All checks passed! Deployment is healthy. ✨"
    echo ""
    echo -e "${GREEN}🚀 Your activity dashboard is ready to use!${NC}"
    echo -e "${BLUE}   Dashboard: http://dashboard.minibob.local${NC}"
    echo -e "${BLUE}   API:       http://api.minibob.local${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    print_warning "Deployment is functional but has $WARNINGS warning(s)"
    echo ""
    echo -e "${YELLOW}⚠️  Please review warnings above${NC}"
    exit 0
else
    print_error "Deployment has $ERRORS error(s) and $WARNINGS warning(s)"
    echo ""
    echo -e "${RED}❌ Please fix errors before using the dashboard${NC}"
    echo ""
    echo "Common fixes:"
    echo "  1. Deploy with: cd helm && helmfile -f helmfile-activity-dashboard-istio.yaml sync"
    echo "  2. Apply Istio: kubectl apply -f kubernetes/istio-activity-system.yaml"
    echo "  3. Fix /etc/hosts: sudo nano /etc/hosts"
    exit 1
fi
