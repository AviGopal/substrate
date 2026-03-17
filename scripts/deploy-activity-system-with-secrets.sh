#!/usr/bin/env bash
# Deploy Activity System with Secrets Management
# 
# This script sets up required secrets and deploys the activity system

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-local}"

log_info "Activity System Deployment with Secrets"
log_info "Environment: $ENVIRONMENT"
echo ""

# =============================================================================
# CHECK REQUIRED ENVIRONMENT VARIABLES
# =============================================================================

log_info "Checking required secrets..."

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    log_error "ANTHROPIC_API_KEY environment variable is not set"
    log_info "Please set it with: export ANTHROPIC_API_KEY=\"sk-ant-your-key-here\""
    log_info "Get your API key from: https://console.anthropic.com/"
    exit 1
fi

log_success "ANTHROPIC_API_KEY is set (${#ANTHROPIC_API_KEY} characters)"

# Set default SurrealDB credentials for local development
export SURREALDB_USERNAME="${SURREALDB_USERNAME:-root}"
export SURREALDB_PASSWORD="${SURREALDB_PASSWORD:-surrealdb-local-dev-123}"

log_info "SurrealDB credentials: username=$SURREALDB_USERNAME"

# =============================================================================
# BUILD DOCKER IMAGES
# =============================================================================

log_info "Building Docker images..."

log_info "Building metabob-activity-api..."
cd "$PROJECT_ROOT/repos/metabob-activity-api"
docker build -t metabob-activity-api:latest . > /dev/null 2>&1
log_success "Built metabob-activity-api:latest"

log_info "Building minibob..."
cd "$PROJECT_ROOT/repos/minibob"
docker build -t minibob:latest . > /dev/null 2>&1
log_success "Built minibob:latest"

cd "$PROJECT_ROOT"

# =============================================================================
# DEPLOY VIA HELMFILE
# =============================================================================

log_info "Deploying via helmfile..."

helmfile -f helm/helmfile-activity-minimal.yaml -e "$ENVIRONMENT" apply

log_success "Helmfile deployment completed"

# =============================================================================
# WAIT FOR PODS
# =============================================================================

log_info "Waiting for pods to be ready..."

kubectl wait --for=condition=ready pod \
  -n activity-system \
  --all \
  --timeout=300s || {
    log_warning "Some pods failed to become ready within timeout"
    kubectl get pods -n activity-system
  }

# =============================================================================
# DISPLAY STATUS
# =============================================================================

echo ""
log_info "=========================================="
log_info "Deployment Status"
log_info "=========================================="
echo ""

log_info "Pods:"
kubectl get pods -n activity-system -o wide

echo ""
log_info "Services:"
kubectl get svc -n activity-system

echo ""
log_success "Activity System deployment completed!"

echo ""
log_info "Next steps:"
echo "  1. Run validation: bash scripts/validate-activity-system.sh"
echo "  2. Port-forward services:"
echo "     kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080"
echo "     kubectl port-forward -n activity-system svc/surrealdb 8000:8000"
echo "  3. Test endpoints:"
echo "     curl http://localhost:8080/health"
echo "     curl -X POST http://localhost:8080/v2/session -H 'X-API-Key: test'"
