#!/bin/bash
# Kubectl Connectivity Troubleshooting Script
# 
# This script attempts to diagnose and fix kubectl connectivity issues
# with the metabob-production GKE cluster.

set -e

echo "=== Kubectl Connectivity Troubleshooting ==="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function check_step() {
    echo -e "${YELLOW}[CHECK]${NC} $1"
}

function success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

function error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Step 1: Check gcloud authentication
check_step "Checking gcloud authentication..."
if gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
    success "gcloud authenticated as: $ACTIVE_ACCOUNT"
else
    error "No active gcloud authentication found"
    echo "Run: gcloud auth login"
    exit 1
fi

# Step 2: Check gcloud project
check_step "Checking gcloud project..."
PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$PROJECT" == "metabob" ]; then
    success "gcloud project is set to: metabob"
else
    error "gcloud project is not set to 'metabob' (currently: $PROJECT)"
    echo "Run: gcloud config set project metabob"
    exit 1
fi

# Step 3: Check GKE auth plugin
check_step "Checking GKE auth plugin..."
if which gke-gcloud-auth-plugin >/dev/null 2>&1; then
    success "GKE auth plugin is installed: $(which gke-gcloud-auth-plugin)"
else
    error "GKE auth plugin not found"
    echo "Install with: gcloud components install gke-gcloud-auth-plugin"
    exit 1
fi

# Step 4: Check current kubectl context
check_step "Checking current kubectl context..."
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
if [ "$CURRENT_CONTEXT" == "metabob-production" ]; then
    success "kubectl context: $CURRENT_CONTEXT"
else
    error "kubectl context is not 'metabob-production' (currently: $CURRENT_CONTEXT)"
fi

# Step 5: List available clusters (with timeout)
check_step "Listing GKE clusters (20s timeout)..."
CLUSTER_LIST=$(timeout 20 gcloud container clusters list --project metabob 2>&1 || echo "TIMEOUT")

if [[ "$CLUSTER_LIST" == *"TIMEOUT"* ]]; then
    error "Cluster listing timed out - possible network or permission issue"
    echo
    echo "Troubleshooting steps:"
    echo "1. Check network connectivity: ping google.com"
    echo "2. Check GCP permissions: gcloud projects get-iam-policy metabob"
    echo "3. Verify account has 'container.clusters.list' permission"
    echo "4. Try: gcloud auth application-default login"
    echo
    echo "If you have network access, you may need to refresh credentials:"
    echo "  gcloud auth login --force"
    echo
    exit 1
elif [[ "$CLUSTER_LIST" == *"production"* ]]; then
    success "Found production cluster"
    echo "$CLUSTER_LIST"
else
    error "Production cluster not found in list"
    echo "$CLUSTER_LIST"
    exit 1
fi

# Step 6: Refresh cluster credentials
check_step "Refreshing cluster credentials..."
echo "This will update your kubectl config for the production cluster..."

# Try to get cluster credentials (with timeout)
if timeout 30 gcloud container clusters get-credentials production \
    --region us-west2 \
    --project metabob 2>&1; then
    success "Cluster credentials refreshed"
else
    error "Failed to refresh cluster credentials"
    echo
    echo "Manual steps to try:"
    echo "1. Check if cluster exists: gcloud container clusters list --project metabob"
    echo "2. Try different region: gcloud container clusters list --project metabob --format='value(location)'"
    echo "3. Check permissions: gcloud projects get-iam-policy metabob --flatten='bindings[].members' --filter='bindings.members:user:$ACTIVE_ACCOUNT'"
    echo
    exit 1
fi

# Step 7: Test kubectl connectivity
check_step "Testing kubectl connectivity..."
if timeout 10 kubectl cluster-info 2>&1 | grep -q "Kubernetes"; then
    success "kubectl can connect to cluster"
    kubectl cluster-info
else
    error "kubectl cannot connect to cluster"
    echo
    echo "Kubectl context details:"
    kubectl config view --minify
    echo
    echo "Additional troubleshooting:"
    echo "1. Check if cluster endpoint is accessible:"
    echo "   ENDPOINT=\$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
    echo "   curl -k \$ENDPOINT/healthz"
    echo
    echo "2. Check if you're behind a firewall or VPN"
    echo "3. Verify cluster is running: gcloud container clusters describe production --region us-west2 --project metabob"
    echo
    exit 1
fi

# Step 8: Test namespace access
check_step "Testing access to 'metabob' namespace..."
if timeout 10 kubectl get namespaces 2>&1 | grep -q "metabob"; then
    success "Can access namespaces, including 'metabob'"
else
    error "Cannot access namespaces or 'metabob' namespace not found"
    kubectl get namespaces
    exit 1
fi

# Step 9: Test pod listing
check_step "Testing pod listing in 'metabob' namespace..."
POD_COUNT=$(timeout 10 kubectl get pods -n metabob --no-headers 2>/dev/null | wc -l)
if [ $? -eq 0 ]; then
    success "Can list pods in 'metabob' namespace (found $POD_COUNT pods)"
    echo
    echo "Backend pods:"
    kubectl get pods -n metabob -l app=metabob-rpc-api 2>/dev/null || echo "No backend pods found with label app=metabob-rpc-api"
else
    error "Cannot list pods in 'metabob' namespace"
    exit 1
fi

# Step 10: Find backend pod
check_step "Finding backend pod for admin CLI access..."
BACKEND_POD=$(timeout 10 kubectl get pods -n metabob -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -n "$BACKEND_POD" ]; then
    success "Found backend pod: $BACKEND_POD"
    echo
    echo "=== SUCCESS! Kubectl is working ==="
    echo
    echo "Next steps to get API key:"
    echo
    echo "1. List organizations:"
    echo "   kubectl exec -n metabob $BACKEND_POD -- python -m admin.cli orgs list"
    echo
    echo "2. List API keys for devbob org:"
    echo "   kubectl exec -n metabob $BACKEND_POD -- python -m admin.cli apikeys list --org-id devbob"
    echo
    echo "3. Create new API key (if needed):"
    echo "   kubectl exec -n metabob $BACKEND_POD -- python -m admin.cli apikeys create \\"
    echo "     --org-id devbob \\"
    echo "     --name 'devbob-local-dev' \\"
    echo "     --scopes read,write,admin"
    echo
else
    error "No backend pod found"
    echo "Available pods in metabob namespace:"
    kubectl get pods -n metabob
    echo
    echo "The backend might be using a different label or name."
    echo "Try: kubectl get deployments -n metabob"
fi

echo
echo "=== Troubleshooting Complete ==="
