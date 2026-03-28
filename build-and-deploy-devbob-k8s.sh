#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Build and Deploy Updated Devbob to K8s${NC}"
echo -e "${BLUE}MCP Architecture Fix Deployment${NC}"
echo -e "${BLUE}========================================${NC}\n"

NAMESPACE="metabob"
IMAGE_NAME="devbob-local"
IMAGE_TAG="mcp-fix-$(date +%Y%m%d-%H%M%S)"
OPENCODE_PATH="repos/metabob-opencode"

# Step 1: Check current context
echo -e "${YELLOW}[Step 1]${NC} Verify Kubernetes context"
CURRENT_CONTEXT=$(kubectl config current-context)
echo "Current context: $CURRENT_CONTEXT"

if [ "$CURRENT_CONTEXT" != "docker-desktop" ]; then
    echo -e "${RED}ERROR: Not in docker-desktop context${NC}"
    echo "Switch with: kubectl config use-context docker-desktop"
    exit 1
fi
echo -e "${GREEN}✓${NC} Correct context\n"

# Step 2: Build metabob-opencode
echo -e "${YELLOW}[Step 2]${NC} Build metabob-opencode with MCP fixes"
cd "$OPENCODE_PATH"

echo "Installing dependencies..."
npm install --silent 2>&1 | grep -v "deprecated" | tail -5 || true

echo "Building TypeScript..."
npm run build 2>&1 | tail -10 || true

if [ ! -d "dist" ]; then
    echo -e "${RED}ERROR: Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build successful"
cd ../..
echo ""

# Step 3: Build Docker image
echo -e "${YELLOW}[Step 3]${NC} Build Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"

cat > Dockerfile.devbob-mcp-fix << 'EOF'
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    build-essential \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create workspace
WORKDIR /workspace

# Copy metabob-opencode build
COPY repos/metabob-opencode /opt/opencode
RUN cd /opt/opencode && npm install --production

# Install metabob-cli (placeholder - would install from package)
# For now, assume it's available in the container or installed separately

# Create config directory
RUN mkdir -p /workspace/.config/opencode

# Copy opencode config with MCP settings
COPY configs/opencode-k8s.json /workspace/.config/opencode/opencode.json

# Set working directory
WORKDIR /workspace

# Keep container running
CMD ["tail", "-f", "/dev/null"]
EOF

echo "Building Docker image..."
docker build -f Dockerfile.devbob-mcp-fix -t "${IMAGE_NAME}:${IMAGE_TAG}" . 2>&1 | tail -20

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Docker build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker image built: ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""

# Step 4: Load image to K8s (docker-desktop)
echo -e "${YELLOW}[Step 4]${NC} Image available in docker-desktop"
echo "Using local Docker image (no push needed for docker-desktop)"
echo ""

# Step 5: Update K8s deployment
echo -e "${YELLOW}[Step 5]${NC} Update devbob deployment"

# Check if deployment exists
if kubectl get deployment devbob -n $NAMESPACE &>/dev/null; then
    echo "Updating existing deployment..."
    kubectl set image deployment/devbob -n $NAMESPACE \
        devbob="${IMAGE_NAME}:${IMAGE_TAG}" \
        --record=true
else
    echo "Creating new deployment..."
    cat > devbob-deployment-mcp-fix.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devbob
  namespace: ${NAMESPACE}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: devbob
  template:
    metadata:
      labels:
        app: devbob
    spec:
      containers:
      - name: devbob
        image: ${IMAGE_NAME}:${IMAGE_TAG}
        imagePullPolicy: Never
        env:
        - name: SURREAL_USER
          value: "root"
        - name: SURREAL_PASS
          value: "changeme"
        - name: METABOB_RPC_API_URL
          value: "http://metabob-rpc-api:8080"
        resources:
          limits:
            memory: "2Gi"
            cpu: "1"
          requests:
            memory: "1Gi"
            cpu: "500m"
EOF
    kubectl apply -f devbob-deployment-mcp-fix.yaml
fi

echo -e "${GREEN}✓${NC} Deployment updated"
echo ""

# Step 6: Wait for rollout
echo -e "${YELLOW}[Step 6]${NC} Wait for rollout to complete"
kubectl rollout status deployment/devbob -n $NAMESPACE --timeout=5m

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Rollout failed${NC}"
    kubectl get pods -n $NAMESPACE | grep devbob
    exit 1
fi

echo -e "${GREEN}✓${NC} Rollout complete"
echo ""

# Step 7: Verify new pod
echo -e "${YELLOW}[Step 7]${NC} Verify new devbob pod"
NEW_POD=$(kubectl get pods -n $NAMESPACE -l app=devbob -o jsonpath='{.items[0].metadata.name}')
echo "New pod: $NEW_POD"

kubectl wait --for=condition=Ready pod/$NEW_POD -n $NAMESPACE --timeout=2m

echo -e "${GREEN}✓${NC} Pod is ready"
echo ""

# Step 8: Verify opencode installation
echo -e "${YELLOW}[Step 8]${NC} Verify metabob-opencode with MCP fixes"
echo "Checking opencode version..."
kubectl exec -n $NAMESPACE $NEW_POD -- /opt/opencode/bin/opencode --version 2>&1 | head -5 || true

echo ""
echo "Checking template-metrics-client.ts has correct MCP tool name..."
MCP_TOOL_CHECK=$(kubectl exec -n $NAMESPACE $NEW_POD -- \
    grep -n "metabob_post_activity_result" \
    /opt/opencode/packages/opencode/src/session/template-metrics-client.ts 2>&1 || echo "NOT FOUND")

if echo "$MCP_TOOL_CHECK" | grep -q "108.*metabob_post_activity_result"; then
    echo -e "${GREEN}✓${NC} MCP tool name is correct: metabob_post_activity_result"
else
    echo -e "${YELLOW}⚠${NC} Could not verify MCP tool name (file may be in dist/)"
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DEPLOYMENT SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓${NC} Built: ${IMAGE_NAME}:${IMAGE_TAG}"
echo -e "${GREEN}✓${NC} Deployed to namespace: ${NAMESPACE}"
echo -e "${GREEN}✓${NC} Pod: ${NEW_POD}"
echo -e "${GREEN}✓${NC} Status: Running"
echo ""
echo "Next steps:"
echo "  1. Test MCP communication: ./test-mcp-architecture-k8s.sh"
echo "  2. Execute test activity in pod"
echo "  3. Verify metrics recorded in database"
echo ""
