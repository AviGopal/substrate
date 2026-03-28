#!/bin/bash
# Deploy Activity Dashboard + API to Docker Desktop with Istio
#
# This script automates the deployment process described in:
# kubernetes/DEPLOY_ACTIVITY_DASHBOARD.md

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Check prerequisites
print_header "Checking Prerequisites"

# Check kubectl
print_step "Checking kubectl..."
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl."
    exit 1
fi
print_success "kubectl found"

# Check current context
print_step "Checking Kubernetes context..."
CONTEXT=$(kubectl config current-context)
if [ "$CONTEXT" != "docker-desktop" ]; then
    print_warning "Current context is '$CONTEXT', expected 'docker-desktop'"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "Context is docker-desktop"
fi

# Check Istio
print_step "Checking Istio installation..."
if ! kubectl get namespace istio-system &> /dev/null; then
    print_warning "Istio not installed. Installing Istio..."
    
    # Check istioctl
    if ! command -v istioctl &> /dev/null; then
        print_error "istioctl not found. Please install Istio: https://istio.io/latest/docs/setup/getting-started/"
        exit 1
    fi
    
    istioctl install --set profile=demo -y
    print_success "Istio installed"
else
    print_success "Istio already installed"
fi

# Check /etc/hosts
print_step "Checking /etc/hosts configuration..."
if ! grep -q "dashboard.minibob.local" /etc/hosts; then
    print_warning "/etc/hosts missing dashboard.minibob.local"
    print_warning "Add the following line to /etc/hosts:"
    echo "    127.0.0.1  dashboard.minibob.local api.minibob.local"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "/etc/hosts configured"
fi

# Check Docker images
print_header "Checking Docker Images"

print_step "Checking metabob-activity-api image..."
if ! docker images | grep -q "metabob-activity-api.*latest"; then
    print_warning "metabob-activity-api:latest not found"
    print_step "Building metabob-activity-api..."
    cd repos/metabob-activity-api
    docker build -t metabob-activity-api:latest .
    cd ../..
    print_success "Built metabob-activity-api:latest"
else
    print_success "metabob-activity-api:latest found"
fi

print_step "Checking activity-dashboard image..."
if ! docker images | grep -q "activity-dashboard.*latest"; then
    print_warning "activity-dashboard:latest not found"
    print_step "Building activity-dashboard..."
    cd repos/activity-dashboard
    docker build -t activity-dashboard:latest .
    cd ../..
    print_success "Built activity-dashboard:latest"
else
    print_success "activity-dashboard:latest found"
fi

# Enable Istio injection
print_header "Configuring Namespace"

print_step "Creating/labeling activity-system namespace..."
kubectl create namespace activity-system --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace activity-system istio-injection=enabled --overwrite
print_success "Namespace configured with Istio injection"

# Deploy with Helmfile
print_header "Deploying Services"

print_step "Deploying with Helmfile..."
cd helm
helmfile -f helmfile-activity-dashboard-istio.yaml apply
cd ..
print_success "Services deployed"

# Deploy Istio Gateway and VirtualServices
print_step "Deploying Istio Gateway and VirtualServices..."
kubectl apply -f kubernetes/istio-activity-system.yaml
print_success "Istio configuration applied"

# Wait for pods to be ready
print_header "Waiting for Pods"

print_step "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s \
    deployment/metabob-activity-api \
    deployment/activity-dashboard \
    -n activity-system

print_success "All deployments ready"

# Verify deployment
print_header "Verifying Deployment"

print_step "Checking pod status..."
kubectl get pods -n activity-system
echo

print_step "Checking services..."
kubectl get svc -n activity-system
echo

print_step "Checking Istio resources..."
kubectl get gateway,virtualservice,destinationrule -n activity-system
echo

# Test connectivity
print_header "Testing Connectivity"

print_step "Testing API health endpoint..."
sleep 5  # Give Istio time to configure routes

if curl -s -f http://api.minibob.local/health > /dev/null 2>&1; then
    print_success "API health check passed"
    curl -s http://api.minibob.local/health | jq .
else
    print_warning "API health check failed (may need time to start)"
    print_warning "Try: curl http://api.minibob.local/health"
fi
echo

print_step "Testing Dashboard..."
if curl -s -I http://dashboard.minibob.local | grep -q "200 OK"; then
    print_success "Dashboard accessible"
else
    print_warning "Dashboard not accessible yet (may need time to start)"
    print_warning "Try: curl -I http://dashboard.minibob.local"
fi

# Final instructions
print_header "Deployment Complete!"

echo
echo -e "${GREEN}✓ Activity Dashboard deployed successfully!${NC}"
echo
echo "Access your services:"
echo -e "  ${BLUE}Dashboard:${NC} http://dashboard.minibob.local"
echo -e "  ${BLUE}API:${NC}       http://api.minibob.local"
echo
echo "Useful commands:"
echo -e "  ${YELLOW}View logs:${NC}"
echo "    kubectl logs -n activity-system -l app=activity-dashboard -f"
echo "    kubectl logs -n activity-system -l app=metabob-activity-api -f"
echo
echo -e "  ${YELLOW}Check status:${NC}"
echo "    kubectl get pods -n activity-system"
echo
echo -e "  ${YELLOW}Port forward (bypass Istio):${NC}"
echo "    kubectl port-forward -n activity-system svc/activity-dashboard 3000:3000"
echo "    kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080"
echo
echo -e "  ${YELLOW}Remove deployment:${NC}"
echo "    helmfile -f helm/helmfile-activity-dashboard-istio.yaml destroy"
echo "    kubectl delete -f kubernetes/istio-activity-system.yaml"
echo
