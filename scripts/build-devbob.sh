#!/bin/bash
# =============================================================================
# Build DevBob Docker Image
# =============================================================================
# Builds the devbob container image with metabob-opencode and metabob-cli.
#
# Prerequisites:
#   1. metabob-opencode binaries must be built first
#      cd repos/metabob-opencode/packages/opencode && bun run build
#
# Usage:
#   ./scripts/build-devbob.sh [OPTIONS]
#
# Options:
#   --no-cache    Build without Docker cache
#   --push        Push to registry after build (requires DOCKER_REGISTRY env)
#   --dev         Build dev variant with extra tools
#
# Examples:
#   ./scripts/build-devbob.sh
#   ./scripts/build-devbob.sh --no-cache
#   ./scripts/build-devbob.sh --dev
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
BUILD_ARGS=""
TARGET="devbob-base"
IMAGE_TAG="devbob:latest"
PUSH=false

for arg in "$@"; do
    case $arg in
        --no-cache)
            BUILD_ARGS="$BUILD_ARGS --no-cache"
            ;;
        --push)
            PUSH=true
            ;;
        --dev)
            TARGET="devbob-dev"
            IMAGE_TAG="devbob:dev"
            ;;
        *)
            log_error "Unknown argument: $arg"
            exit 1
            ;;
    esac
done

echo ""
echo "=============================================="
echo "  Building DevBob Image"
echo "  Target: $TARGET"
echo "  Tag: $IMAGE_TAG"
echo "=============================================="
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Check prerequisites
log_info "Checking prerequisites..."

# Check if opencode binaries exist
if [ ! -d "repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64" ]; then
    log_error "OpenCode binaries not found!"
    log_error "Please build them first:"
    log_error "  cd repos/metabob-opencode/packages/opencode && bun run build"
    exit 1
fi
log_success "OpenCode binaries found"

# Check if metabob-cli source exists
if [ ! -f "repos/metabob-cli/pyproject.toml" ]; then
    log_error "metabob-cli source not found at repos/metabob-cli/"
    exit 1
fi
log_success "metabob-cli source found"

# Check if Dockerfile exists (use production clean Dockerfile)
if [ ! -f "docker/Dockerfile.devbob" ]; then
    log_error "Dockerfile not found at docker/Dockerfile.devbob"
    exit 1
fi
log_success "Dockerfile found"

# Check if entrypoint exists
if [ ! -f "docker/entrypoint-self-config.sh" ]; then
    log_error "Entrypoint script not found at docker/entrypoint-self-config.sh"
    exit 1
fi
log_success "Entrypoint script found"

# Build the image
log_info "Building Docker image..."
log_info "  Context: $PROJECT_ROOT"
log_info "  Dockerfile: docker/Dockerfile.devbob (production clean binary deployment)"
log_info "  Target: $TARGET"
log_info "  Tag: $IMAGE_TAG"

if docker build \
    -f docker/Dockerfile.devbob \
    --target "$TARGET" \
    -t "$IMAGE_TAG" \
    $BUILD_ARGS \
    .; then
    log_success "Docker image built successfully: $IMAGE_TAG"
else
    log_error "Docker build failed"
    exit 1
fi

# Show image info
log_info "Image details:"
docker images "$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Push if requested
if [ "$PUSH" = true ]; then
    if [ -z "$DOCKER_REGISTRY" ]; then
        log_error "DOCKER_REGISTRY environment variable not set"
        exit 1
    fi
    
    REMOTE_TAG="$DOCKER_REGISTRY/$IMAGE_TAG"
    log_info "Tagging for push: $REMOTE_TAG"
    docker tag "$IMAGE_TAG" "$REMOTE_TAG"
    
    log_info "Pushing to registry..."
    docker push "$REMOTE_TAG"
    log_success "Image pushed: $REMOTE_TAG"
fi

echo ""
log_success "Build complete!"
echo ""
echo "Next steps:"
echo "  1. Configure repos in .env.devbob:"
echo "       DEVBOB_RPC_API_REPO=git@github.com:org/repo.git"
echo "       DEVBOB_RPC_API_BRANCH=main"
echo ""
echo "  2. Copy SSH keys:"
echo "       cp ~/.ssh/id_* configs/.ssh/"
echo ""
echo "  3. Start containers:"
echo "       docker-compose -f configs/docker-compose.devbob.yaml up -d"
echo ""
echo "  4. View logs:"
echo "       docker-compose -f configs/docker-compose.devbob.yaml logs -f"
echo ""
