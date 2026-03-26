#!/usr/bin/env bash
#
# Deploy DevBob with Repository Access (Phase 1)
#
# This script deploys MiniBob with shared repository storage,
# enabling git operations on actual repositories instead of isolated workspaces.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$SCRIPT_DIR/charts/devbob"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    if ! command -v helm &> /dev/null; then
        log_error "helm not found. Please install helm."
        exit 1
    fi

    # Check if Docker image exists
    if ! docker images | grep -q "devbob.*latest"; then
        log_warn "devbob:latest image not found locally"
        log_info "Building devbob image..."
        cd "$SCRIPT_DIR/../repos/minibob"
        docker build -t devbob:latest .
        cd "$SCRIPT_DIR"
    fi

    log_info "Prerequisites check passed"
}

# Get configuration values
get_config() {
    # Check for required secrets
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        log_error "ANTHROPIC_API_KEY environment variable not set"
        exit 1
    fi

    # Optional: GitHub token for private repos
    GITHUB_TOKEN="${GITHUB_TOKEN:-}"
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warn "GITHUB_TOKEN not set - only public repositories can be cloned"
    fi

    # Git user configuration
    GIT_USER_NAME="${GIT_USER_NAME:-MiniBob Agent}"
    GIT_USER_EMAIL="${GIT_USER_EMAIL:-minibob@metabob.local}"

    log_info "Configuration:"
    log_info "  Git User: $GIT_USER_NAME <$GIT_USER_EMAIL>"
    log_info "  GitHub Token: ${GITHUB_TOKEN:+<set>}${GITHUB_TOKEN:-<not set>}"
}

# Deploy the chart
deploy_chart() {
    local namespace="${NAMESPACE:-activity-system}"
    local release_name="${RELEASE_NAME:-devbob}"

    log_info "Deploying DevBob with repository access..."
    log_info "  Namespace: $namespace"
    log_info "  Release: $release_name"

    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -

    # Enable Istio injection on namespace
    kubectl label namespace "$namespace" istio-injection=enabled --overwrite

    # Build helm values
    local values_args=(
        "--set" "secrets.anthropicApiKey=$ANTHROPIC_API_KEY"
        "--set" "secrets.metabobApiKey=${METABOB_API_KEY:-dummy}"
        "--set" "repositories.git.username=$GIT_USER_NAME"
        "--set" "repositories.git.email=$GIT_USER_EMAIL"
    )

    if [ -n "$GITHUB_TOKEN" ]; then
        values_args+=(
            "--set" "repositories.git.token=$GITHUB_TOKEN"
        )
    fi

    # Deploy with Helm
    helm upgrade --install \
        "$release_name" \
        "$CHART_DIR" \
        --namespace "$namespace" \
        "${values_args[@]}" \
        --wait \
        --timeout 5m

    log_info "Deployment successful!"
}

# Verify deployment
verify_deployment() {
    local namespace="${NAMESPACE:-activity-system}"
    local release_name="${RELEASE_NAME:-devbob}"

    log_info "Verifying deployment..."

    # Wait for pods to be ready
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod \
        -l "app.kubernetes.io/name=devbob,app.kubernetes.io/instance=$release_name" \
        -n "$namespace" \
        --timeout=300s

    # Check PVCs
    log_info "Checking PersistentVolumeClaims..."
    kubectl get pvc -n "$namespace" -l "app.kubernetes.io/instance=$release_name"

    # Get pod name
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l "app.kubernetes.io/name=devbob,app.kubernetes.io/instance=$release_name" -o jsonpath='{.items[0].metadata.name}')

    log_info "Pod: $pod_name"

    # Check if /repos is mounted
    log_info "Verifying /repos mount..."
    if kubectl exec -n "$namespace" "$pod_name" -- ls -la /repos &> /dev/null; then
        log_info "/repos directory is mounted"
        kubectl exec -n "$namespace" "$pod_name" -- ls -la /repos
    else
        log_error "/repos directory not found in pod"
        exit 1
    fi

    log_info "Deployment verification complete!"
}

# Run test activity
run_test_activity() {
    local namespace="${NAMESPACE:-activity-system}"
    local release_name="${RELEASE_NAME:-devbob}"

    log_info "Running git repository access test..."

    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l "app.kubernetes.io/name=devbob,app.kubernetes.io/instance=$release_name" -o jsonpath='{.items[0].metadata.name}')

    # Copy test template into pod (if not already there)
    local template_path="/workspace/test-git-repo-access.json"

    log_info "Executing test activity via MiniBob..."
    kubectl exec -n "$namespace" "$pod_name" -- opencode run "$template_path" || {
        log_warn "Test activity failed - check logs for details"
        log_info "To view logs: kubectl logs -n $namespace $pod_name -f"
        return 1
    }

    log_info "Test activity completed successfully!"
}

# Display usage information
show_next_steps() {
    local namespace="${NAMESPACE:-activity-system}"
    local release_name="${RELEASE_NAME:-devbob}"

    log_info "Next steps:"
    echo ""
    echo "  1. Check deployment status:"
    echo "     kubectl get pods -n $namespace -l app.kubernetes.io/name=devbob"
    echo ""
    echo "  2. View logs:"
    echo "     kubectl logs -n $namespace -l app.kubernetes.io/name=devbob -f"
    echo ""
    echo "  3. Exec into pod:"
    echo "     kubectl exec -it -n $namespace \$(kubectl get pod -n $namespace -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}') -- /bin/bash"
    echo ""
    echo "  4. Verify /repos directory:"
    echo "     kubectl exec -n $namespace \$(kubectl get pod -n $namespace -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}') -- ls -la /repos"
    echo ""
    echo "  5. Test git operations:"
    echo "     kubectl exec -n $namespace \$(kubectl get pod -n $namespace -l app.kubernetes.io/name=devbob -o jsonpath='{.items[0].metadata.name}') -- git -C /repos/metabob-devbob status"
    echo ""
}

# Main execution
main() {
    log_info "=== DevBob Repository Access Deployment (Phase 1) ==="
    echo ""

    check_prerequisites
    get_config
    deploy_chart
    verify_deployment

    echo ""
    log_info "=== Deployment Complete ==="
    show_next_steps
}

main "$@"
