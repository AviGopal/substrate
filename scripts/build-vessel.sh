#!/bin/bash
# Build a vessel Docker image locally
# Usage: ./scripts/build-vessel.sh <vessel> [tag]
#
# Examples:
#   ./scripts/build-vessel.sh minibob              # Build with version from package.json
#   ./scripts/build-vessel.sh minibob 0.2.1        # Build with specific tag
#   ./scripts/build-vessel.sh minibob dev          # Build with dev tag
#
# This script:
# 1. Builds the Docker image from repos/<vessel>/Dockerfile
# 2. Tags it as <vessel>:<version>, <vessel>:latest, and metabobapp/<vessel>:<version>
# 3. Handles special cases where build context needs shared dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }

VESSEL="$1"

if [ -z "$VESSEL" ]; then
  echo "Usage: $0 <vessel> [tag]"
  echo ""
  echo "Examples:"
  echo "  $0 minibob              # Use version from package.json"
  echo "  $0 minibob 0.2.1        # Specific version"
  echo "  $0 minibob dev          # Development tag"
  echo ""
  echo "Available vessels (with Dockerfile):"
  for dockerfile in repos/*/Dockerfile; do
    vessel_name=$(dirname "$dockerfile" | xargs basename)
    echo "  - $vessel_name"
  done
  exit 1
fi

# Get the script directory and workspace root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VESSEL_DIR="$WORKSPACE_ROOT/repos/$VESSEL"
PACKAGE_JSON="$VESSEL_DIR/package.json"
DOCKERFILE="$VESSEL_DIR/Dockerfile"

# Verify vessel exists
if [ ! -d "$VESSEL_DIR" ]; then
  error "Vessel directory not found: $VESSEL_DIR"
  exit 1
fi

if [ ! -f "$DOCKERFILE" ]; then
  error "Dockerfile not found: $DOCKERFILE"
  exit 1
fi

# Get version from package.json if tag not specified
if [ -z "$2" ]; then
  if [ -f "$PACKAGE_JSON" ]; then
    TAG=$(jq -r .version "$PACKAGE_JSON")
    if [ "$TAG" = "null" ] || [ -z "$TAG" ]; then
      warn "Could not read version from package.json, using 'latest'"
      TAG="latest"
    fi
  else
    warn "No package.json found, using 'latest'"
    TAG="latest"
  fi
else
  TAG="$2"
fi

info "========================================="
info "Building Vessel: $VESSEL"
info "========================================="
info "Version/Tag: $TAG"
info "Dockerfile: $DOCKERFILE"
echo

# Check Docker is running
if ! docker info &>/dev/null; then
  error "Docker is not running"
  error "Start Docker Desktop and try again"
  exit 1
fi
info "Docker is running"

# Vessels that need shared dependencies (repos/ as build context)
# - metabob-activity-api: needs metabob-proto schemas
# - metabob-analysis-api: needs metabob-proto schemas
# - metabob-internal-dashboard: needs @metabob/minibob library
SHARED_CONTEXT_VESSELS=("metabob-activity-api" "metabob-analysis-api" "metabob-internal-dashboard")

# Check if this vessel needs shared context
needs_shared_context=false
for shared_vessel in "${SHARED_CONTEXT_VESSELS[@]}"; do
  if [ "$VESSEL" = "$shared_vessel" ]; then
    needs_shared_context=true
    break
  fi
done

# Get git commit SHA for version embedding
COMMIT_SHA=$(git rev-parse --short=7 HEAD 2>/dev/null || echo "unknown")
info "Git SHA: $COMMIT_SHA"

step "Building Docker image..."
if [ "$needs_shared_context" = true ]; then
  info "Using repos/ as build context (vessel has shared dependencies)"
  cd "$WORKSPACE_ROOT/repos"
  BUILD_CMD="docker build --ssh default --build-arg BUILD_SHA=$COMMIT_SHA --build-arg BUILD_VERSION=$TAG -f $VESSEL/Dockerfile -t $VESSEL:$TAG ."
else
  info "Using vessel directory as build context"
  cd "$VESSEL_DIR"
  BUILD_CMD="docker build --ssh default --build-arg BUILD_SHA=$COMMIT_SHA --build-arg BUILD_VERSION=$TAG -t $VESSEL:$TAG ."
fi

echo "  Command: $BUILD_CMD"
echo

if eval "$BUILD_CMD"; then
  info "Build successful: $VESSEL:$TAG"
else
  error "Build failed"
  exit 1
fi

# Apply additional tags
step "Applying additional tags..."
docker tag "$VESSEL:$TAG" "$VESSEL:latest"
docker tag "$VESSEL:$TAG" "metabobapp/$VESSEL:$TAG"
docker tag "$VESSEL:$TAG" "metabobapp/$VESSEL:latest"

info "Tagged images:"
info "  - $VESSEL:$TAG"
info "  - $VESSEL:latest"
info "  - metabobapp/$VESSEL:$TAG"
info "  - metabobapp/$VESSEL:latest"

echo
info "========================================="
info "Build Complete"
info "========================================="

# Show image sizes
step "Image info:"
docker images "$VESSEL" --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo
info "Next steps:"
info "  1. Deploy locally: ./scripts/deploy.sh $VESSEL local"
info "  2. Push to registry: docker push metabobapp/$VESSEL:$TAG"
info "  3. Deploy to prod: ./scripts/deploy.sh $VESSEL production"
