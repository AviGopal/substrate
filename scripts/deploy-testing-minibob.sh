#!/usr/bin/env bash
#
# Deploy minibob to testing-minibob namespace for validation
#
# This script:
# 1. Creates testing-minibob namespace
# 2. Creates secrets for API keys
# 3. Deploys minibob Helm chart with validation values
# 4. Waits for pods to be ready
# 5. Runs validation harness

set -euo pipefail

# Configuration
NAMESPACE="testing-minibob"
HELM_RELEASE="minibob"
VALUES_FILE="helm/testing-minibob-values.yaml"
MINIBOB_CHART="./helm/minibob"  # Adjust to actual chart location

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        error "helm not found. Please install Helm."
        exit 1
    fi
    
    if ! command -v bun &> /dev/null; then
        error "bun not found. Please install Bun runtime."
        exit 1
    fi
    
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        error "ANTHROPIC_API_KEY environment variable not set."
        exit 1
    fi
    
    info "✓ All prerequisites met"
}

# Create namespace
create_namespace() {
    info "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        warn "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace "$NAMESPACE"
        kubectl label namespace "$NAMESPACE" \
            name="$NAMESPACE" \
            validation="true" \
            security-hardened="true"
        info "✓ Namespace created"
    fi
}

# Create secrets
create_secrets() {
    info "Creating secrets..."
    
    # Delete existing secret if it exists
    kubectl delete secret minibob-secrets -n "$NAMESPACE" &> /dev/null || true
    
    # Create secret from environment variable
    kubectl create secret generic minibob-secrets \
        -n "$NAMESPACE" \
        --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY"
    
    info "✓ Secrets created"
}

# Deploy Helm chart
deploy_helm_chart() {
    info "Deploying Helm chart: $HELM_RELEASE"
    
    if ! [ -d "$MINIBOB_CHART" ]; then
        error "Helm chart not found at: $MINIBOB_CHART"
        error "Please create the Helm chart or adjust MINIBOB_CHART path"
        exit 1
    fi
    
    if ! [ -f "$VALUES_FILE" ]; then
        error "Values file not found: $VALUES_FILE"
        exit 1
    fi
    
    # Upgrade or install
    helm upgrade --install "$HELM_RELEASE" "$MINIBOB_CHART" \
        --namespace "$NAMESPACE" \
        --values "$VALUES_FILE" \
        --wait \
        --timeout 5m
    
    info "✓ Helm chart deployed"
}

# Wait for pods to be ready
wait_for_pods() {
    info "Waiting for pods to be ready..."
    
    kubectl wait --for=condition=ready pod \
        -l app=minibob \
        -n "$NAMESPACE" \
        --timeout=300s
    
    info "✓ All pods ready"
}

# Display deployment status
show_status() {
    info "Deployment status:"
    echo ""
    kubectl get pods -n "$NAMESPACE" -l app=minibob
    echo ""
    kubectl get svc -n "$NAMESPACE" -l app=minibob
    echo ""
}

# Run validation harness
run_validation() {
    info "Running validation harness..."
    echo ""
    
    cd "$(dirname "$0")/.."
    bun run tests/validation-harnesses/minibob-standalone-execution-harness.ts
    
    local exit_code=$?
    echo ""
    
    if [ $exit_code -eq 0 ]; then
        info "✓ Validation passed"
    else
        error "✗ Validation failed with exit code: $exit_code"
        exit $exit_code
    fi
}

# Cleanup (optional)
cleanup() {
    warn "Cleaning up testing-minibob namespace..."
    helm uninstall "$HELM_RELEASE" -n "$NAMESPACE" || true
    kubectl delete namespace "$NAMESPACE" || true
    info "✓ Cleanup complete"
}

# Main execution
main() {
    info "Deploying minibob to testing-minibob namespace"
    echo "========================================================"
    
    check_prerequisites
    create_namespace
    create_secrets
    deploy_helm_chart
    wait_for_pods
    show_status
    run_validation
    
    echo ""
    echo "========================================================"
    info "Deployment and validation complete!"
    echo ""
    info "To view logs: kubectl logs -f -n $NAMESPACE -l app=minibob"
    info "To cleanup: $0 --cleanup"
}

# Handle cleanup flag
if [ "${1:-}" = "--cleanup" ]; then
    cleanup
    exit 0
fi

# Run main
main "$@"
