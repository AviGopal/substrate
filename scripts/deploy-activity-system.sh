#!/usr/bin/env bash
# Deploy Activity System Minimal Environment
# 
# This script deploys the minimal activity system stack:
#   - SurrealDB 3.x (database)
#   - metabob-activity-api (TypeScript vessel)
#   - minibob (autonomous vessel)
#   - Redis (cache layer)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HELMFILE="$PROJECT_ROOT/helm/helmfile-activity-minimal.yaml"
ENVIRONMENT="${ENVIRONMENT:-local}"
NAMESPACE="activity-system"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=()
    
    command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing+=("helm")
    command -v helmfile >/dev/null 2>&1 || missing+=("helmfile")
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_error "Please install them and try again."
        exit 1
    fi
    
    log_success "All prerequisites satisfied"
}

check_kubernetes_cluster() {
    log_info "Checking Kubernetes cluster connectivity..."
    
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster"
        log_error "Ensure kubectl is configured and cluster is running"
        exit 1
    fi
    
    local context
    context=$(kubectl config current-context)
    log_success "Connected to cluster: $context"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build metabob-activity-api
    log_info "Building metabob-activity-api..."
    cd "$PROJECT_ROOT/repos/metabob-activity-api"
    docker build -t metabob-activity-api:latest .
    log_success "Built metabob-activity-api:latest"
    
    # Build minibob
    log_info "Building minibob..."
    cd "$PROJECT_ROOT/repos/minibob"
    docker build -t minibob:latest .
    log_success "Built minibob:latest"
    
    cd "$PROJECT_ROOT"
}

deploy_helmfile() {
    log_info "Deploying helmfile for environment: $ENVIRONMENT"
    
    cd "$PROJECT_ROOT"
    
    if ! helmfile -f "$HELMFILE" -e "$ENVIRONMENT" apply; then
        log_error "Helmfile deployment failed"
        return 1
    fi
    
    log_success "Helmfile deployment completed"
}

wait_for_pods() {
    log_info "Waiting for pods to be ready in namespace: $NAMESPACE"
    
    local timeout=300
    local elapsed=0
    local interval=5
    
    while [ $elapsed -lt $timeout ]; do
        local not_ready
        not_ready=$(kubectl get pods -n "$NAMESPACE" -o json | \
            jq -r '.items[] | select(.status.phase != "Running" and .status.phase != "Succeeded") | .metadata.name' | wc -l)
        
        if [ "$not_ready" -eq 0 ]; then
            log_success "All pods are ready"
            return 0
        fi
        
        log_info "Waiting for $not_ready pod(s) to be ready... (${elapsed}s/${timeout}s)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    log_error "Timeout waiting for pods to be ready"
    kubectl get pods -n "$NAMESPACE"
    return 1
}

show_deployment_status() {
    log_info "Deployment status:"
    echo ""
    
    log_info "Pods:"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo ""
    
    log_info "Services:"
    kubectl get svc -n "$NAMESPACE"
    echo ""
    
    log_info "StatefulSets:"
    kubectl get statefulsets -n "$NAMESPACE" || echo "  No statefulsets found"
    echo ""
}

show_access_instructions() {
    log_info "Access instructions:"
    echo ""
    
    log_info "To access metabob-activity-api:"
    echo "  kubectl port-forward -n $NAMESPACE svc/metabob-activity-api 8080:8080"
    echo "  curl http://localhost:8080/health"
    echo ""
    
    log_info "To access SurrealDB:"
    echo "  kubectl port-forward -n $NAMESPACE svc/surrealdb 8000:8000"
    echo "  curl http://localhost:8000/health"
    echo ""
    
    log_info "To access minibob:"
    echo "  kubectl port-forward -n $NAMESPACE svc/minibob 8081:8080"
    echo "  curl http://localhost:8081/health"
    echo ""
    
    log_info "To view logs:"
    echo "  kubectl logs -n $NAMESPACE -l app=metabob-activity-api -f"
    echo "  kubectl logs -n $NAMESPACE -l app=surrealdb -f"
    echo "  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=minibob -f"
    echo ""
}

run_validation() {
    log_info "Running post-deployment validation..."
    
    if [ -f "$SCRIPT_DIR/validate-activity-system.sh" ]; then
        bash "$SCRIPT_DIR/validate-activity-system.sh"
    else
        log_warning "Validation script not found, skipping validation"
    fi
}

cleanup_on_error() {
    log_error "Deployment failed, cleaning up..."
    helmfile -f "$HELMFILE" -e "$ENVIRONMENT" destroy || true
}

# Main execution
main() {
    log_info "Starting Activity System deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    echo ""
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    # Pre-deployment checks
    check_prerequisites
    check_kubernetes_cluster
    
    # Build images
    build_images
    
    # Deploy
    deploy_helmfile
    
    # Wait for readiness
    wait_for_pods
    
    # Show status
    show_deployment_status
    show_access_instructions
    
    # Validate
    run_validation
    
    log_success "Activity System deployment completed successfully!"
    echo ""
    log_info "Next steps:"
    echo "  1. Port-forward the services to access them locally"
    echo "  2. Run validation tests: bash $SCRIPT_DIR/validate-activity-system.sh"
    echo "  3. Test activity execution with minibob"
}

# Run main
main "$@"
