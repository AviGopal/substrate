#!/usr/bin/env bash
#
# Deploy to Sandbox - Kubectx Enforcement and Helmfile Deployment
# Ensures all deployments run in docker-desktop sandbox, never in production
#
# Usage: ./scripts/deploy-to-sandbox.sh <service> <image_tag> [namespace]
#
# Examples:
#   ./scripts/deploy-to-sandbox.sh metabob-rpc-api test-1234567890
#   ./scripts/deploy-to-sandbox.sh metabob-opencode test-latest metabob
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLATFORM_DIR="$PROJECT_ROOT/repos/platform/metabob-apps"

# Source shared pod selection utility
source "$SCRIPT_DIR/lib/get-ready-pod.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Validate arguments
if [ $# -lt 2 ]; then
    log_error "Missing required arguments"
    echo "Usage: $0 <service> <image_tag> [namespace]"
    echo ""
    echo "Arguments:"
    echo "  service    - Service name (metabob-rpc-api, metabob-opencode, etc.)"
    echo "  image_tag  - Docker image tag (e.g., test-1234567890)"
    echo "  namespace  - Kubernetes namespace (default: metabob)"
    exit 1
fi

SERVICE="$1"
IMAGE_TAG="$2"
NAMESPACE="${3:-metabob}"

log_info "Deploying $SERVICE:$IMAGE_TAG to sandbox"

# CRITICAL: Enforce docker-desktop kubectx (sandbox isolation)
log_step "Checking kubectx for sandbox isolation..."
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")

if [ "$CURRENT_CONTEXT" != "docker-desktop" ]; then
    log_error "KUBECTX ENFORCEMENT FAILURE"
    echo ""
    echo "Current context: $CURRENT_CONTEXT"
    echo "Required context: docker-desktop"
    echo ""
    echo "This script enforces sandbox isolation to prevent accidental deployment to production."
    echo "To deploy to docker-desktop:"
    echo "  kubectx docker-desktop"
    echo "  $0 $SERVICE $IMAGE_TAG $NAMESPACE"
    echo ""
    echo "To deploy to other environments, use repos/platform/metabob-apps/deploy.sh directly"
    exit 1
fi

log_info "✓ Kubectx check passed: $CURRENT_CONTEXT (sandbox)"

# Verify kubectl connectivity
log_step "Verifying kubectl connectivity..."
if ! kubectl cluster-info &>/dev/null; then
    log_error "Cannot connect to Kubernetes cluster"
    echo "Current context: $CURRENT_CONTEXT"
    echo "Verify docker-desktop is running and Kubernetes is enabled"
    exit 1
fi

log_info "✓ Kubectl connectivity confirmed"

# Check if helmfile exists
if ! command -v helmfile &>/dev/null; then
    log_error "helmfile not found"
    echo "Install helmfile: https://github.com/helmfile/helmfile"
    exit 1
fi

# Navigate to platform directory
if [ ! -d "$PLATFORM_DIR" ]; then
    log_error "Platform directory not found: $PLATFORM_DIR"
    exit 1
fi

cd "$PLATFORM_DIR"

# Update Helm values with new image tag
log_step "Updating Helm values for $SERVICE:$IMAGE_TAG..."

# Map service name to Helm release name
case "$SERVICE" in
    metabob-rpc-api)
        RELEASE_NAME="metabob-rpc-api"
        SELECTOR="app=metabob-rpc-api"
        ;;
    metabob-opencode|devbob)
        RELEASE_NAME="metabob-opencode"
        SELECTOR="app=metabob-opencode"
        ;;
    metabob-cli)
        log_warn "metabob-cli is a Python package, not a standalone service"
        log_info "metabob-cli is included in metabob-rpc-api and metabob-opencode containers"
        exit 0
        ;;
    *)
        log_error "Unknown service: $SERVICE"
        echo "Supported services: metabob-rpc-api, metabob-opencode"
        exit 1
        ;;
esac

# Deploy using helmfile
log_step "Deploying with helmfile..."

# Set image tag via environment variable for helmfile
export IMAGE_TAG="$IMAGE_TAG"
export NAMESPACE="$NAMESPACE"

helmfile -e default sync --selector "app=${RELEASE_NAME}" --args "--set image.tag=${IMAGE_TAG}"

HELMFILE_EXIT_CODE=$?

if [ $HELMFILE_EXIT_CODE -ne 0 ]; then
    log_error "Helmfile deployment failed with exit code $HELMFILE_EXIT_CODE"
    exit $HELMFILE_EXIT_CODE
fi

log_info "✓ Helmfile deployment completed"

# Wait for pod readiness
log_step "Waiting for pod readiness..."

POD_READY=false
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    # Use ready pod selection
    POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l "$SELECTOR" \
        -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}' 2>/dev/null | awk '{print $1}')
    
    if [ -n "$POD_NAME" ]; then
        POD_STATUS=$(kubectl get pod -n "$NAMESPACE" "$POD_NAME" -o jsonpath='{.status.phase}' 2>/dev/null)
        POD_READY=$(kubectl get pod -n "$NAMESPACE" "$POD_NAME" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
        
        if [ "$POD_STATUS" = "Running" ] && [ "$POD_READY" = "True" ]; then
            log_info "✓ Pod is running and ready: $POD_NAME"
            POD_READY=true
            break
        fi
    fi
    
    log_info "Waiting for ready pod... (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS)"
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$POD_READY" != "true" ]; then
    log_error "Pod did not become ready within timeout"
    
    # Show pod details for debugging
    echo ""
    kubectl get pods -n "$NAMESPACE" -l "$SELECTOR"
    echo ""
    kubectl describe pods -n "$NAMESPACE" -l "$SELECTOR" | tail -30
    
    exit 1
fi

log_info "✓ Deployment successful"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "Service: $SERVICE"
echo "Image Tag: $IMAGE_TAG"
echo "Namespace: $NAMESPACE"
echo "Pod Name: $POD_NAME"
echo "Context: $CURRENT_CONTEXT (SANDBOX)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "To view logs:"
echo "  kubectl logs -n $NAMESPACE $POD_NAME -f"
echo ""
echo "To view pod details:"
echo "  kubectl describe pod -n $NAMESPACE $POD_NAME"
echo ""

exit 0
