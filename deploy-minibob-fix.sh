#!/usr/bin/env bash
# Deploy updated MiniBob with backend template loading fix

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MiniBob Deployment: Backend Template Loading Fix ===${NC}\n"

# Step 1: Build MiniBob Docker image
echo -e "${YELLOW}[1/4] Building MiniBob Docker image...${NC}"
cd repos/minibob
docker build -t minibob:latest .
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ MiniBob image built successfully${NC}\n"
else
  echo -e "${RED}❌ Failed to build MiniBob image${NC}"
  exit 1
fi

# Step 2: Verify Anthropic API key is set
echo -e "${YELLOW}[2/4] Checking Anthropic API key...${NC}"
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo -e "${RED}❌ ANTHROPIC_API_KEY not set${NC}"
  echo "Please export ANTHROPIC_API_KEY before deploying"
  exit 1
else
  echo -e "${GREEN}✅ ANTHROPIC_API_KEY is set${NC}\n"
fi

# Step 3: Deploy via helmfile
echo -e "${YELLOW}[3/4] Deploying via helmfile...${NC}"
cd ../..
helmfile -f helm/helmfile-activity-minimal.yaml \
  --state-values-file helm/secrets/local.yaml \
  -e local sync

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Deployment complete${NC}\n"
else
  echo -e "${RED}❌ Deployment failed${NC}"
  exit 1
fi

# Step 4: Verify MiniBob is running
echo -e "${YELLOW}[4/4] Verifying MiniBob deployment...${NC}"
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=minibob \
  -n activity-system \
  --timeout=120s

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ MiniBob is running${NC}\n"
  
  # Show pod status
  echo -e "${YELLOW}Pod Status:${NC}"
  kubectl get pods -n activity-system -l app.kubernetes.io/name=minibob
  
  echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
  echo -e "MiniBob is now running with backend template loading support"
  echo -e "\nNext steps:"
  echo -e "  1. Test with: kubectl port-forward -n activity-system svc/minibob 8080:8080"
  echo -e "  2. Run integration test: bun run test-minibob-backend-integration.ts"
  echo -e "  3. Create activity in backend and execute via MiniBob /run endpoint"
else
  echo -e "${RED}❌ MiniBob failed to start${NC}"
  echo "Check logs with: kubectl logs -n activity-system -l app.kubernetes.io/name=minibob"
  exit 1
fi
