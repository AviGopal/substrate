#!/bin/bash
#
# Validate Local Deployment
#
# This script validates the multi-tenant auth flows against the helmfile deployment
# using the *.metabob.local TLD via Istio Gateway.
#
# Service Mapping (development):
#   app.metabob.local      -> metabob-cloud-dashboard
#   activity.metabob.local -> metabob-activity-api
#   api.metabob.local      -> metabob-analysis-api
#   surql.metabob.local    -> surrealdb
#   minibob.metabob.local  -> minibob vessel
#
# Prerequisites:
#   1. Docker Desktop with Kubernetes enabled (context: docker-desktop)
#   2. Istio installed: istioctl install --set profile=demo -y
#   3. /etc/hosts entries for *.metabob.local
#   4. Docker images built
#   5. ANTHROPIC_API_KEY environment variable set
#
# Usage:
#   ./validate-local-deployment.sh [--deploy] [--skip-prereqs]
#
#   --deploy      Deploy/sync the stack before validation
#   --skip-prereqs  Skip prerequisite checks
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY=false
SKIP_PREREQS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --deploy)
      DEPLOY=true
      shift
      ;;
    --skip-prereqs)
      SKIP_PREREQS=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║       Local Deployment Validation (*.metabob.local)              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# Prerequisites Check
# =============================================================================

if [ "$SKIP_PREREQS" = false ]; then
  echo -e "${BLUE}Checking prerequisites...${NC}"
  echo ""

  PREREQS_OK=true

  # Check Kubernetes context
  CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
  if [[ "$CURRENT_CONTEXT" == "docker-desktop" ]] || [[ "$CURRENT_CONTEXT" == "rancher-desktop" ]] || [[ "$CURRENT_CONTEXT" == "minikube" ]]; then
    echo -e "  ${GREEN}✓${NC} Kubernetes context: $CURRENT_CONTEXT"
  else
    echo -e "  ${YELLOW}⚠${NC} Kubernetes context: $CURRENT_CONTEXT (expected docker-desktop/rancher-desktop/minikube)"
    echo -e "    ${YELLOW}Switch with: kubectl config use-context docker-desktop${NC}"
  fi

  # Check Istio
  if kubectl get namespace istio-system &>/dev/null; then
    ISTIO_PODS=$(kubectl get pods -n istio-system --no-headers 2>/dev/null | grep -c Running || echo "0")
    if [ "$ISTIO_PODS" -gt 0 ]; then
      echo -e "  ${GREEN}✓${NC} Istio is installed ($ISTIO_PODS pods running)"
    else
      echo -e "  ${RED}✗${NC} Istio namespace exists but no pods running"
      PREREQS_OK=false
    fi
  else
    echo -e "  ${RED}✗${NC} Istio not installed"
    echo -e "    ${YELLOW}Install with: istioctl install --set profile=demo -y${NC}"
    PREREQS_OK=false
  fi

  # Check /etc/hosts entries
  HOSTS_ENTRIES=(
    "app.metabob.local"
    "activity.metabob.local"
    "api.metabob.local"
    "surql.metabob.local"
    "minibob.metabob.local"
  )
  HOSTS_OK=true
  for host in "${HOSTS_ENTRIES[@]}"; do
    if grep -q "$host" /etc/hosts 2>/dev/null; then
      :
    else
      HOSTS_OK=false
    fi
  done
  if [ "$HOSTS_OK" = true ]; then
    echo -e "  ${GREEN}✓${NC} /etc/hosts entries configured"
  else
    echo -e "  ${RED}✗${NC} Missing /etc/hosts entries"
    echo -e "    ${YELLOW}Add to /etc/hosts:${NC}"
    echo -e "    127.0.0.1 app.metabob.local activity.metabob.local api.metabob.local"
    echo -e "    127.0.0.1 surql.metabob.local minibob.metabob.local"
    PREREQS_OK=false
  fi

  # Check ANTHROPIC_API_KEY
  if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo -e "  ${GREEN}✓${NC} ANTHROPIC_API_KEY is set"
  else
    echo -e "  ${YELLOW}⚠${NC} ANTHROPIC_API_KEY not set (MiniBob won't work)"
  fi

  # Check Docker images
  REQUIRED_IMAGES=(
    "metabob-activity-api:v2-fixed"
    "metabob-analysis-api:latest"
    "minibob:v2-fixed"
  )
  IMAGES_OK=true
  for img in "${REQUIRED_IMAGES[@]}"; do
    if docker image inspect "$img" &>/dev/null; then
      :
    else
      echo -e "  ${YELLOW}⚠${NC} Docker image not found: $img"
      IMAGES_OK=false
    fi
  done
  if [ "$IMAGES_OK" = true ]; then
    echo -e "  ${GREEN}✓${NC} Required Docker images present"
  else
    echo -e "    ${YELLOW}Build images:${NC}"
    echo -e "    cd repos/metabob-activity-api && docker build -t metabob-activity-api:v2-fixed ."
    echo -e "    cd repos/metabob-analysis-api && docker build -t metabob-analysis-api:latest ."
    echo -e "    cd repos/minibob && docker build -t minibob:v2-fixed ."
  fi

  echo ""

  if [ "$PREREQS_OK" = false ]; then
    echo -e "${RED}Prerequisites not met. Fix the issues above and try again.${NC}"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# =============================================================================
# Deploy Stack (optional)
# =============================================================================

if [ "$DEPLOY" = true ]; then
  echo -e "${BLUE}Deploying stack via helmfile...${NC}"
  echo ""

  # Create API key secret if it doesn't exist
  if ! kubectl get secret minibob-api-keys -n activity-system &>/dev/null; then
    echo "Creating minibob-api-keys secret..."
    kubectl create namespace activity-system --dry-run=client -o yaml | kubectl apply -f -
    kubectl create secret generic minibob-api-keys \
      --from-literal=anthropic-api-key="${ANTHROPIC_API_KEY:-missing}" \
      --from-literal=github-token="${GITHUB_TOKEN:-}" \
      -n activity-system \
      --dry-run=client -o yaml | kubectl apply -f -
  fi

  # Enable Istio injection
  kubectl label namespace activity-system istio-injection=enabled --overwrite 2>/dev/null || true

  # Deploy
  cd "$SCRIPT_DIR/helm"
  helmfile -f activity-system-minimal.yaml.gotmpl sync

  echo ""
  echo -e "${GREEN}Stack deployed!${NC}"
  echo ""
fi

# =============================================================================
# Wait for Services
# =============================================================================

echo -e "${BLUE}Checking service availability...${NC}"
echo ""

wait_for_service() {
  local name=$1
  local url=$2
  local max_attempts=${3:-30}
  local attempt=1

  echo -n "  Waiting for $name at $url..."

  while [ $attempt -le $max_attempts ]; do
    if curl -sf "$url" -o /dev/null 2>&1; then
      echo -e " ${GREEN}✓${NC}"
      return 0
    fi
    echo -n "."
    sleep 2
    ((attempt++))
  done

  echo -e " ${RED}✗${NC} (timeout after $max_attempts attempts)"
  return 1
}

# Service endpoints via Istio Gateway
ACTIVITY_API="http://activity.metabob.local"
ANALYSIS_API="http://api.metabob.local"
SURREALDB="http://surql.metabob.local"

SERVICES_OK=true
wait_for_service "SurrealDB" "$SURREALDB/health" 60 || SERVICES_OK=false
wait_for_service "Activity API" "$ACTIVITY_API/health" 30 || SERVICES_OK=false
wait_for_service "Analysis API" "$ANALYSIS_API/health" 30 || SERVICES_OK=false

echo ""

if [ "$SERVICES_OK" = false ]; then
  echo -e "${RED}Some services are not available.${NC}"
  echo ""
  echo "Check pod status:"
  echo "  kubectl get pods -n activity-system"
  echo ""
  echo "Check pod logs:"
  echo "  kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api"
  echo ""
  read -p "Continue with validation anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# =============================================================================
# Run Validation Tests
# =============================================================================

echo "════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}Running validation tests against local deployment...${NC}"
echo ""

# Export environment variables for test scripts
export ACTIVITY_API_URL="$ACTIVITY_API"
export ANALYSIS_API_URL="$ANALYSIS_API"
export SURREALDB_URL="$SURREALDB"

RESULTS=()

# Test 1: MCP → Activity API flow
echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│ Test 1: metabob-mcp → activity-api → SurrealDB (API key auth)     │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""
echo "Flow: API key → JWT (org_id + project_ids) → scoped queries"
echo ""

if [ -f "$SCRIPT_DIR/repos/metabob-activity-api/test-mcp-auth-flow.ts" ]; then
  cd "$SCRIPT_DIR/repos/metabob-activity-api"
  if bun run test-mcp-auth-flow.ts 2>&1; then
    RESULTS+=("MCP API Key Flow: PASSED")
    echo -e "\n${GREEN}✓ Test 1 PASSED${NC}\n"
  else
    RESULTS+=("MCP API Key Flow: FAILED")
    echo -e "\n${RED}✗ Test 1 FAILED${NC}\n"
  fi
else
  RESULTS+=("MCP API Key Flow: SKIPPED (script not found)")
  echo -e "${YELLOW}Skipped: test-mcp-auth-flow.ts not found${NC}\n"
fi

# Test 2: MiniBob → Activity API flow
echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│ Test 2: minibob → activity-api → SurrealDB (instance auth)        │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""
echo "Flow: Instance signin → JWT (org_id + project_id) → project-scoped"
echo ""

if [ -f "$SCRIPT_DIR/repos/metabob-activity-api/test-minibob-auth-flow.ts" ]; then
  cd "$SCRIPT_DIR/repos/metabob-activity-api"
  if bun run test-minibob-auth-flow.ts 2>&1; then
    RESULTS+=("MiniBob Instance Flow: PASSED")
    echo -e "\n${GREEN}✓ Test 2 PASSED${NC}\n"
  else
    RESULTS+=("MiniBob Instance Flow: FAILED")
    echo -e "\n${RED}✗ Test 2 FAILED${NC}\n"
  fi
else
  RESULTS+=("MiniBob Instance Flow: SKIPPED (script not found)")
  echo -e "${YELLOW}Skipped: test-minibob-auth-flow.ts not found${NC}\n"
fi

# Test 3: MCP → Analysis API flow
echo "┌────────────────────────────────────────────────────────────────────┐"
echo "│ Test 3: metabob-mcp → analysis-api → SurrealDB (user auth)        │"
echo "└────────────────────────────────────────────────────────────────────┘"
echo ""
echo "Flow: User login → JWT (org_id + project_ids) → org-scoped analysis"
echo ""

if [ -f "$SCRIPT_DIR/repos/metabob-analysis-api/test-analysis-auth-flow.ts" ]; then
  cd "$SCRIPT_DIR/repos/metabob-analysis-api"
  if bun run test-analysis-auth-flow.ts 2>&1; then
    RESULTS+=("Analysis API User Flow: PASSED")
    echo -e "\n${GREEN}✓ Test 3 PASSED${NC}\n"
  else
    RESULTS+=("Analysis API User Flow: FAILED")
    echo -e "\n${RED}✗ Test 3 FAILED${NC}\n"
  fi
else
  RESULTS+=("Analysis API User Flow: SKIPPED (script not found)")
  echo -e "${YELLOW}Skipped: test-analysis-auth-flow.ts not found${NC}\n"
fi

# =============================================================================
# Summary
# =============================================================================

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                     VALIDATION SUMMARY                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

for result in "${RESULTS[@]}"; do
  if [[ $result == *"PASSED"* ]]; then
    echo -e "  ${GREEN}✓${NC} $result"
  elif [[ $result == *"FAILED"* ]]; then
    echo -e "  ${RED}✗${NC} $result"
  else
    echo -e "  ${YELLOW}⊘${NC} $result"
  fi
done

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo ""
echo "Endpoints Tested:"
echo ""
echo "  Activity API:  $ACTIVITY_API"
echo "  Analysis API:  $ANALYSIS_API"
echo "  SurrealDB:     $SURREALDB"
echo ""
echo "Data Flows Validated:"
echo ""
cat << 'EOF'
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │   metabob-mcp ─────────► activity-api ─────────► SurrealDB              │
  │       │                      │                      │                   │
  │       │   API key auth       │   queryWithAuth()    │   PERMISSIONS     │
  │       │   → JWT with         │   passes JWT to      │   filters by      │
  │       │   org_id +           │   SurrealDB for      │   $auth.org_id    │
  │       │   project_ids        │   RBAC enforcement   │   $auth.project_ids│
  │       │                      │                      │                   │
  └───────┴──────────────────────┴──────────────────────┴───────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │   minibob ─────────────► activity-api ─────────► SurrealDB              │
  │       │                      │                      │                   │
  │       │   Instance auth      │   queryWithAuth()    │   PERMISSIONS     │
  │       │   → JWT with         │   passes JWT to      │   filters by      │
  │       │   org_id +           │   SurrealDB for      │   $auth.org_id    │
  │       │   project_id         │   RBAC enforcement   │   $auth.project_id│
  │       │   (singular)         │                      │                   │
  │       │                      │                      │                   │
  └───────┴──────────────────────┴──────────────────────┴───────────────────┘
EOF
echo ""

# Exit with error if any test failed
for result in "${RESULTS[@]}"; do
  if [[ $result == *"FAILED"* ]]; then
    exit 1
  fi
done

echo -e "${GREEN}All validations passed! ✓${NC}"
