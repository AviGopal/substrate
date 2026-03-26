#!/bin/bash
# Quick Rebuild and Deploy
# Builds specified services and deploys via helmfile
#
# Usage:
#   ./rebuild-deploy.sh                    # Rebuild all services
#   ./rebuild-deploy.sh activity-api       # Rebuild only activity-api
#   ./rebuild-deploy.sh activity-api mcp   # Rebuild activity-api and mcp
#   ./rebuild-deploy.sh --skip-build       # Deploy only (no rebuild)

set -e

cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
SKIP_BUILD=false
SERVICES=()

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      ;;
    *)
      SERVICES+=("$arg")
      ;;
  esac
done

# Default: all services if none specified
if [ ${#SERVICES[@]} -eq 0 ] && [ "$SKIP_BUILD" = false ]; then
  SERVICES=("activity-api" "analysis-api" "mcp" "minibob" "dashboard")
fi

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Rebuild & Deploy${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

if [ "$SKIP_BUILD" = false ]; then
  echo -e "Services: ${YELLOW}${SERVICES[*]}${NC}"
fi

# Image tag based on timestamp
IMAGE_TAG="v2-$(date +%s)"

# Build function
build_service() {
  local name=$1
  local dir=$2
  local image=$3
  local context=${4:-.}
  local dockerfile=${5:-Dockerfile}

  echo -e "\n${YELLOW}Building $name...${NC}"

  if [ ! -f "$dir/$dockerfile" ] && [ "$context" = "." ]; then
    echo -e "${RED}  ✗ No Dockerfile found: $dir/$dockerfile${NC}"
    return 1
  fi

  if [ "$context" = "repos" ]; then
    # Build from repos/ with -f flag
    docker build -f "$dir/$dockerfile" -t "$image:$IMAGE_TAG" -t "$image:latest" repos/ 2>&1 | tail -5
  else
    docker build -t "$image:$IMAGE_TAG" -t "$image:latest" "$dir" 2>&1 | tail -5
  fi

  echo -e "${GREEN}  ✓ Built $image:$IMAGE_TAG${NC}"
}

# Build requested services
if [ "$SKIP_BUILD" = false ]; then
  for svc in "${SERVICES[@]}"; do
    case $svc in
      activity-api)
        # activity-api Dockerfile expects repos/ as build context
        echo -e "\n${YELLOW}Building metabob-activity-api...${NC}"
        docker build -f repos/metabob-activity-api/Dockerfile -t metabob-activity-api:$IMAGE_TAG -t metabob-activity-api:latest repos/ 2>&1 | tail -5
        echo -e "${GREEN}  ✓ Built metabob-activity-api:$IMAGE_TAG${NC}"
        ;;
      analysis-api)
        build_service "metabob-analysis-api" "repos/metabob-analysis-api" "metabob-analysis-api"
        ;;
      mcp)
        build_service "metabob-mcp" "repos/metabob-mcp" "metabob-mcp"
        ;;
      minibob)
        build_service "minibob" "repos/minibob" "minibob"
        ;;
      dashboard)
        build_service "metabob-cloud-dashboard" "repos/metabob-cloud-dashboard" "metabob-cloud-dashboard"
        ;;
      *)
        echo -e "${YELLOW}Unknown service: $svc${NC}"
        ;;
    esac
  done
fi

# Deploy via helmfile
echo -e "\n${BLUE}Deploying via helmfile...${NC}"
cd helm

# Restart deployments for rebuilt services to pick up new images
for svc in "${SERVICES[@]}"; do
  case $svc in
    activity-api)
      kubectl rollout restart deployment -n activity-system metabob-activity-api 2>/dev/null || true
      ;;
    analysis-api)
      kubectl rollout restart deployment -n activity-system metabob-analysis-api 2>/dev/null || true
      ;;
    mcp)
      kubectl rollout restart deployment -n activity-system metabob-mcp 2>/dev/null || true
      ;;
    minibob)
      kubectl rollout restart deployment -n activity-system minibob-devbob 2>/dev/null || true
      ;;
    dashboard)
      kubectl rollout restart deployment -n activity-system metabob-cloud-dashboard 2>/dev/null || true
      ;;
  esac
done

# Sync helmfile
helmfile -f activity-system-minimal.yaml.gotmpl sync 2>&1 | tail -10

cd ..

# Wait for deployments
echo -e "\n${YELLOW}Waiting for deployments...${NC}"

for svc in "${SERVICES[@]}"; do
  case $svc in
    activity-api)
      kubectl rollout status deployment -n activity-system metabob-activity-api --timeout=90s 2>/dev/null || echo -e "${YELLOW}  activity-api not ready${NC}"
      ;;
    analysis-api)
      kubectl rollout status deployment -n activity-system metabob-analysis-api --timeout=90s 2>/dev/null || echo -e "${YELLOW}  analysis-api not ready${NC}"
      ;;
  esac
done

# Health checks
echo -e "\n${BLUE}Health Checks:${NC}"
sleep 3

curl -sf http://activity.metabob.local/health >/dev/null 2>&1 && echo -e "${GREEN}  ✓ activity-api healthy${NC}" || echo -e "${YELLOW}  ⚠ activity-api not responding${NC}"
curl -sf http://api.metabob.local/health >/dev/null 2>&1 && echo -e "${GREEN}  ✓ analysis-api healthy${NC}" || echo -e "${YELLOW}  ⚠ analysis-api not responding${NC}"
curl -sf http://surql.metabob.local/health >/dev/null 2>&1 && echo -e "${GREEN}  ✓ surrealdb healthy${NC}" || echo -e "${YELLOW}  ⚠ surrealdb not responding${NC}"

echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Done!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Verify with:"
echo "  kubectl get pods -n activity-system"
echo "  ./validate-local-deployment.sh --skip-prereqs"
