#!/usr/bin/env bash
#
# Unified Container Build Script
# Builds Docker containers for metabob-rpc-api, metabob-cli, or metabob-opencode
#
# Usage: ./scripts/build-container.sh <repo_name> [tag_suffix]
#
# Examples:
#   ./scripts/build-container.sh metabob-rpc-api
#   ./scripts/build-container.sh metabob-opencode test-123
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$PROJECT_ROOT/repos"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Validate arguments
if [ $# -lt 1 ]; then
    log_error "Missing required argument: repo_name"
    echo "Usage: $0 <repo_name> [tag_suffix]"
    echo ""
    echo "Supported repos:"
    echo "  - metabob-rpc-api"
    echo "  - metabob-cli"
    echo "  - metabob-opencode"
    exit 1
fi

REPO_NAME="$1"
TAG_SUFFIX="${2:-$(date +%s)}"
IMAGE_TAG="test-${TAG_SUFFIX}"

log_info "Building container for $REPO_NAME with tag $IMAGE_TAG"

# Build based on repo name
case "$REPO_NAME" in
    metabob-rpc-api)
        DOCKERFILE="$REPO_DIR/metabob-rpc-api/docker/Dockerfile.server"
        CONTEXT_DIR="$REPO_DIR/metabob-rpc-api"
        IMAGE_NAME="metabob-rpc-api"
        
        if [ ! -f "$DOCKERFILE" ]; then
            log_error "Dockerfile not found: $DOCKERFILE"
            exit 1
        fi
        
        log_info "Building metabob-rpc-api Docker image..."
        docker build \
            -f "$DOCKERFILE" \
            -t "${IMAGE_NAME}:${IMAGE_TAG}" \
            -t "${IMAGE_NAME}:latest" \
            "$CONTEXT_DIR"
        
        BUILD_EXIT_CODE=$?
        ;;
    
    metabob-cli)
        log_warn "metabob-cli is a Python package, not a standalone container"
        log_info "metabob-cli is installed as a dependency in other containers"
        log_info "To build containers that include metabob-cli:"
        echo "  - $0 metabob-rpc-api"
        echo "  - $0 metabob-opencode"
        exit 0
        ;;
    
    metabob-opencode)
        DOCKERFILE="$REPO_DIR/metabob-opencode/packages/slack/Dockerfile.devbob"
        CONTEXT_DIR="$REPO_DIR/metabob-opencode"
        IMAGE_NAME="metabob-opencode"
        
        # Build metabob-opencode first (TypeScript compilation)
        log_info "Building metabob-opencode TypeScript..."
        cd "$CONTEXT_DIR"
        
        if [ -f "package.json" ]; then
            npm install
            npm run build
        fi
        
        # Build Docker image
        if [ -f "$DOCKERFILE" ]; then
            log_info "Building metabob-opencode Docker image..."
            docker build \
                -f "$DOCKERFILE" \
                -t "${IMAGE_NAME}:${IMAGE_TAG}" \
                -t "${IMAGE_NAME}:latest" \
                "$CONTEXT_DIR"
            
            BUILD_EXIT_CODE=$?
        else
            log_error "Dockerfile not found: $DOCKERFILE"
            exit 1
        fi
        ;;
    
    *)
        log_error "Unknown repo: $REPO_NAME"
        echo "Supported repos: metabob-rpc-api, metabob-cli, metabob-opencode"
        exit 1
        ;;
esac

# Validate build result
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    log_info "✅ Build successful: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    # Show image details
    docker images "${IMAGE_NAME}:${IMAGE_TAG}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    # Output image name for downstream scripts
    echo ""
    echo "IMAGE_NAME=${IMAGE_NAME}"
    echo "IMAGE_TAG=${IMAGE_TAG}"
    echo "IMAGE_FULL=${IMAGE_NAME}:${IMAGE_TAG}"
    
    exit 0
else
    log_error "❌ Build failed with exit code $BUILD_EXIT_CODE"
    exit $BUILD_EXIT_CODE
fi
