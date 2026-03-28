#!/bin/bash
# Build and Deploy Activity System
# Builds Docker images for operational services and deploys via Helm

set -e

echo "════════════════════════════════════════════════════════════"
echo "  Building Activity System - Operational Services"
echo "════════════════════════════════════════════════════════════"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: docker not found${NC}"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}ERROR: kubectl not found${NC}"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo -e "${RED}ERROR: helm not found${NC}"
    exit 1
fi

if ! command -v helmfile &> /dev/null; then
    echo -e "${RED}ERROR: helmfile not found${NC}"
    exit 1
fi

# Check Kubernetes context
CONTEXT=$(kubectl config current-context)
echo -e "${GREEN}✓${NC} Kubernetes context: $CONTEXT"

# Check if namespace exists
if ! kubectl get namespace activity-system &> /dev/null; then
    echo -e "${YELLOW}Creating namespace activity-system...${NC}"
    kubectl create namespace activity-system
    kubectl label namespace activity-system istio-injection=enabled
fi

# Build metabob-activity-api
echo -e "\n${YELLOW}Building metabob-activity-api...${NC}"
cd repos/metabob-activity-api

if [ ! -f "Dockerfile" ]; then
    echo -e "${YELLOW}Creating Dockerfile for activity-api...${NC}"
    cat > Dockerfile <<'EOF'
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Run
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
EOF
fi

docker build -t metabob-activity-api:latest .
echo -e "${GREEN}✓${NC} Built metabob-activity-api:latest"

cd ../..

# Build minibob
echo -e "\n${YELLOW}Building minibob...${NC}"
cd repos/minibob

if [ ! -f "Dockerfile" ]; then
    echo -e "${YELLOW}Creating Dockerfile for minibob...${NC}"
    cat > Dockerfile <<'EOF'
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Run
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "run", "index.ts"]
EOF
fi

docker build -t minibob:latest .
echo -e "${GREEN}✓${NC} Built minibob:latest"

cd ../..

# Deploy via Helmfile
echo -e "\n${YELLOW}Deploying via Helmfile...${NC}"
cd helm

# Check if helmfile exists
if [ ! -f "activity-system-minimal.yaml.gotmpl" ]; then
    echo -e "${RED}ERROR: helm/activity-system-minimal.yaml.gotmpl not found${NC}"
    exit 1
fi

# Sync deployment
helmfile -f activity-system-minimal.yaml.gotmpl sync

echo -e "\n${YELLOW}Waiting for pods to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=surrealdb -n activity-system --timeout=120s || true
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=redis-valkey -n activity-system --timeout=120s || true
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=metabob-activity-api -n activity-system --timeout=120s || true
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=minibob -n activity-system --timeout=120s || true

cd ..

# Verify deployment
echo -e "\n${YELLOW}Verifying deployment...${NC}"
kubectl get pods -n activity-system

echo -e "\n${YELLOW}Checking health endpoints...${NC}"

# Wait for services to be ready
sleep 5

# Check activity-api health
if curl -s http://api.minibob.local/health | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} activity-api health check passed"
else
    echo -e "${YELLOW}⚠${NC} activity-api health check failed (may not be deployed yet)"
fi

echo -e "\n════════════════════════════════════════════════════════════"
echo -e "${GREEN}Activity System Build Complete!${NC}"
echo -e "════════════════════════════════════════════════════════════"

echo -e "\nServices:"
echo -e "  • SurrealDB:    http://surrealdb.activity-system.svc.cluster.local:8000"
echo -e "  • Redis:        redis://redis-valkey.activity-system.svc.cluster.local:6379"
echo -e "  • Activity API: http://api.minibob.local"
echo -e "  • MiniBob:      (3 replicas for boredom activities)"

echo -e "\nNext steps:"
echo -e "  1. Verify health: curl http://api.minibob.local/health | jq"
echo -e "  2. Check pods:    kubectl get pods -n activity-system"
echo -e "  3. View logs:     kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api -f"

echo -e "\n${GREEN}Ready to begin development!${NC}"
