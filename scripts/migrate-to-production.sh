#!/bin/bash
# Production Migration Orchestrator
# Migrates from old metabob stack to new activity-system stack

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "════════════════════════════════════════════════════════════════"
echo "  METABOB PRODUCTION MIGRATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo ""
    echo "${GREEN}▶ $1${NC}"
    echo "────────────────────────────────────────────────────────────────"
}

print_warning() {
    echo "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo "${RED}❌ $1${NC}"
}

print_success() {
    echo "${GREEN}✅ $1${NC}"
}

# Check prerequisites
print_step "STEP 0: Pre-flight Checks"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl not found. Please install kubectl."
    exit 1
fi

# Check helmfile
if ! command -v helmfile &> /dev/null; then
    print_error "helmfile not found. Please install helmfile."
    exit 1
fi

# Check gcloud
if ! command -v gcloud &> /dev/null; then
    print_warning "gcloud not found. This is recommended for GKE clusters."
fi

# Verify current context
CURRENT_CONTEXT=$(kubectl config current-context)
echo "Current kubectl context: $CURRENT_CONTEXT"

if [[ ! "$CURRENT_CONTEXT" =~ "metabob-production" ]]; then
    print_error "Current context does not contain 'metabob-production'"
    echo "Please switch to production cluster:"
    echo "  gcloud container clusters get-credentials metabob-production --region <region>"
    exit 1
fi

print_success "Prerequisites OK"

# Step 1: Export local data
print_step "STEP 1: Export Local Development Data"
print_warning "This requires access to your local docker-desktop cluster"
echo ""
read -p "Have you already exported local data? (yes/no): " EXPORTED

if [ "$EXPORTED" != "yes" ]; then
    echo ""
    echo "Instructions to export local data:"
    echo "  1. Switch to docker-desktop context:"
    echo "     kubectl config use-context docker-desktop"
    echo ""
    echo "  2. Run export script:"
    echo "     ./scripts/export-local-db.sh"
    echo ""
    echo "  3. Verify backup was created in ./backups/"
    echo ""
    echo "  4. Return to production context:"
    echo "     kubectl config use-context <production-context>"
    echo ""
    echo "  5. Re-run this migration script"
    exit 0
fi

# Get backup file path
echo ""
echo "Available backups:"
ls -lh "$PROJECT_ROOT/backups/" 2>/dev/null || echo "No backups found in ./backups/"
echo ""
read -p "Enter backup file path: " BACKUP_FILE

if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

print_success "Backup file confirmed: $BACKUP_FILE"

# Step 2: Deploy legacy namespace
print_step "STEP 2: Deploy Legacy RPC API (ide.metabob.com)"

echo "This will create metabob-legacy namespace with rpc-api:0.16.13"
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    exit 0
fi

cd "$PROJECT_ROOT/helm"
helmfile -f legacy-rpc-api.yaml sync

# Verify legacy deployment
kubectl wait --for=condition=ready pod \
    -n metabob-legacy \
    -l app.kubernetes.io/name=metabob-rpc-api \
    --timeout=300s

print_success "Legacy RPC API deployed"

# Step 3: Delete old stack
print_step "STEP 3: Delete Old Metabob Stack"

print_warning "This will DELETE the entire 'metabob' namespace"
print_warning "This includes all old services and data"
echo ""
read -p "Type 'delete' to confirm: " CONFIRM
if [ "$CONFIRM" != "delete" ]; then
    print_error "Aborted. Namespace not deleted."
    exit 1
fi

if kubectl get namespace metabob &>/dev/null; then
    echo "Deleting namespace: metabob"
    kubectl delete namespace metabob

    # Wait for deletion to complete
    echo "Waiting for namespace to be fully removed..."
    while kubectl get namespace metabob &>/dev/null; do
        sleep 5
        echo -n "."
    done
    echo ""
    print_success "Old stack deleted"
else
    print_warning "Namespace 'metabob' does not exist (already deleted?)"
fi

# Step 4: Deploy new stack
print_step "STEP 4: Deploy New Activity System Stack"

echo "This will create activity-system namespace with all new services"
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    exit 0
fi

cd "$PROJECT_ROOT/helm"

# Check if production values exist
if [ ! -f "environments/production.values.yaml" ]; then
    print_warning "Production values not found"
    echo "Using minimal config instead"
    HELMFILE="activity-system-minimal.yaml.gotmpl"
else
    HELMFILE="activity-system-minimal.yaml.gotmpl"
fi

helmfile -f "$HELMFILE" sync

# Wait for all pods to be ready
echo "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod \
    -n activity-system \
    --all \
    --timeout=600s

print_success "New stack deployed"

# Step 5: Import data
print_step "STEP 5: Import Local Data to Production"

echo "This will import data from: $BACKUP_FILE"
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    print_warning "Skipping data import"
else
    cd "$PROJECT_ROOT"
    ./scripts/import-to-production.sh "$BACKUP_FILE"
fi

# Step 6: Verify deployment
print_step "STEP 6: Verify Deployment"

echo "Checking service endpoints..."

# Check pods
echo ""
echo "Pod Status:"
kubectl get pods -n activity-system
kubectl get pods -n metabob-legacy

# Check services
echo ""
echo "Service Status:"
kubectl get svc -n activity-system
kubectl get svc -n metabob-legacy

# Try to curl health endpoints (if accessible from cluster)
echo ""
echo "Testing health endpoints (this may fail if ingress not configured):"

ENDPOINTS=(
    "http://metabob-activity-api.activity-system.svc.cluster.local:8080/health"
    "http://metabob-analysis-api.activity-system.svc.cluster.local:8080/health"
    "http://metabob-cloud-dashboard.activity-system.svc.cluster.local:3000"
)

for ENDPOINT in "${ENDPOINTS[@]}"; do
    echo -n "  $ENDPOINT ... "
    if kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
        curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT" 2>/dev/null | grep -q "200\|404"; then
        print_success "OK"
    else
        print_warning "Unable to reach"
    fi
done

# Step 7: DNS Configuration
print_step "STEP 7: Configure DNS"

echo "Update DNS records to point to your ingress:"
echo ""
echo "  activity.metabob.com  →  <ingress-ip>"
echo "  api.metabob.com       →  <ingress-ip>"
echo "  app.metabob.com       →  <ingress-ip>"
echo "  ide.metabob.com       →  <ingress-ip>"
echo "  internal.metabob.com  →  <ingress-ip>"
echo ""
echo "Get ingress IP:"
echo "  kubectl get svc -n istio-system istio-ingressgateway"

# Final summary
echo ""
echo "════════════════════════════════════════════════════════════════"
print_success "MIGRATION COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Configure DNS records (see above)"
echo "  2. Test each surface:"
echo "     curl https://activity.metabob.com/health"
echo "     curl https://api.metabob.com/health"
echo "     curl https://app.metabob.com"
echo "     curl https://ide.metabob.com/health"
echo "  3. Monitor logs:"
echo "     kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f"
echo "  4. Set up monitoring and alerting"
echo "  5. Configure CI/CD pipelines"
echo ""
echo "Rollback (if needed):"
echo "  helmfile -f helm/activity-system-minimal.yaml.gotmpl destroy"
echo "  helmfile -f helm/legacy-rpc-api.yaml destroy"
echo ""
