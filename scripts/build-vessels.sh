#!/usr/bin/env bash
# Build Docker images for all vessels
#
# This script builds development Docker images for each vessel
# with the "dev" tag for use in local Kubernetes cluster.
#
# Usage: ./scripts/build-vessels.sh [vessel-name]
#        ./scripts/build-vessels.sh                 # Build all
#        ./scripts/build-vessels.sh minibob         # Build specific vessel

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

# Check if we're in the metabob-devbob root
if [ ! -d "repos" ]; then
  error "Must be run from metabob-devbob root directory"
  exit 1
fi

ROOT_DIR="$(pwd)"

# Vessel build configurations
declare -A VESSELS=(
  ["minibob"]="repos/minibob"
  ["metabob-activity-api"]="repos/metabob-activity-api"
  ["metabob-analysis-api"]="repos/metabob-analysis-api"
  ["metabob-cloud-dashboard"]="repos/metabob-cloud-dashboard"
  ["activity-dashboard"]="repos/activity-dashboard"
  ["metabob-internal-dashboard"]="repos/metabob-internal-dashboard"
)

# Function to build a vessel
build_vessel() {
  local vessel_name=$1
  local vessel_dir=$2
  local full_path="$ROOT_DIR/$vessel_dir"

  step "Building $vessel_name..."

  if [ ! -d "$full_path" ]; then
    error "Directory not found: $full_path"
    return 1
  fi

  # Check for Dockerfile
  if [ ! -f "$full_path/Dockerfile" ]; then
    error "Dockerfile not found in $full_path"
    return 1
  fi

  # Build image with appropriate context
  info "Building Docker image: $vessel_name:dev"

  # Some vessels need repos/ as build context for shared dependencies
  # - metabob-activity-api and metabob-analysis-api: need metabob-proto schemas
  # - metabob-internal-dashboard: needs @metabob/minibob library
  if [ "$vessel_name" = "metabob-activity-api" ] || [ "$vessel_name" = "metabob-analysis-api" ] || [ "$vessel_name" = "metabob-internal-dashboard" ]; then
    cd "$ROOT_DIR/repos"
    if docker build --ssh default -f "$vessel_name/Dockerfile" -t "$vessel_name:dev" . ; then
      info "✓ Built $vessel_name:dev (with shared dependencies)"
    else
      error "Failed to build $vessel_name"
      return 1
    fi
  else
    cd "$full_path"
    if docker build --ssh default -t "$vessel_name:dev" . ; then
      info "✓ Built $vessel_name:dev"
    else
      error "Failed to build $vessel_name"
      return 1
    fi
  fi

  # Also tag as latest and with metabobapp/ prefix for helm compatibility
  docker tag "$vessel_name:dev" "$vessel_name:latest"
  docker tag "$vessel_name:dev" "metabobapp/$vessel_name:dev"
  docker tag "$vessel_name:dev" "metabobapp/$vessel_name:latest"
  info "✓ Tagged $vessel_name:latest and metabobapp/$vessel_name:dev"

  # Show image info
  docker images "$vessel_name" --format "  {{.Repository}}:{{.Tag}} ({{.Size}})"
  docker images "metabobapp/$vessel_name" --format "  {{.Repository}}:{{.Tag}} ({{.Size}})"

  return 0
}

# Main execution
info "========================================="
info "Vessel Docker Image Builder"
info "========================================="
echo

# Check Docker is running
if ! docker info &>/dev/null; then
  error "Docker is not running"
  error "Start Docker Desktop and try again"
  exit 1
fi
info "✓ Docker is running\n"

# Determine which vessels to build
vessels_to_build=()
if [ $# -eq 0 ]; then
  # Build all vessels
  info "Building all vessels..."
  for vessel in "${!VESSELS[@]}"; do
    vessels_to_build+=("$vessel")
  done
else
  # Build specific vessel
  vessel_name=$1
  if [ -z "${VESSELS[$vessel_name]}" ]; then
    error "Unknown vessel: $vessel_name"
    error "Available vessels: ${!VESSELS[*]}"
    exit 1
  fi
  vessels_to_build=("$vessel_name")
fi

# Build each vessel
failed_builds=()
successful_builds=()

for vessel in "${vessels_to_build[@]}"; do
  echo
  if build_vessel "$vessel" "${VESSELS[$vessel]}"; then
    successful_builds+=("$vessel")
  else
    failed_builds+=("$vessel")
  fi
  cd "$ROOT_DIR"
done

# Summary
echo
info "========================================="
info "Build Summary"
info "========================================="

if [ ${#successful_builds[@]} -gt 0 ]; then
  info "✓ Successful builds:"
  for vessel in "${successful_builds[@]}"; do
    info "  - $vessel:dev"
  done
fi

if [ ${#failed_builds[@]} -gt 0 ]; then
  error "✗ Failed builds:"
  for vessel in "${failed_builds[@]}"; do
    error "  - $vessel"
  done
  exit 1
fi

echo
info "All builds completed successfully!"
echo
info "Next steps:"
info "  1. Deploy to cluster: helmfile -f helm/helmfile-activity-dev.yaml -e dev apply"
info "  2. Access dashboard: http://dashboard.minibob.local"
info "  3. View API: http://api.minibob.local/health"
