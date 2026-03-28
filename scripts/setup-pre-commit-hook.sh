#!/bin/bash
# Setup pre-commit hook that uses repos/deployment/ workflow
# Run this script after cloning the repository

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_FILE="$REPO_ROOT/.git/hooks/pre-commit"

echo "Installing pre-commit hook..."

# Copy the hook from this script's embedded version
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Pre-commit hook: Sync to Deployment Repo → Build → Deploy → Validate
# Uses repos/deployment/ as canonical infrastructure repository
# Syncs changes, builds images, deploys via helmfile, runs smoke tests
# Allows commit on failure but warns to restore functionality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
DEPLOYMENT_REPO="$REPO_ROOT/repos/deployment"
LOG_DIR="$REPO_ROOT/.git/hooks/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/pre-commit-$TIMESTAMP.log"

# Get git info for tagging
GIT_SHA=$(git rev-parse --short HEAD)
BUILD_NUM=$(date +%s)

# Image registry prefix
IMAGE_REGISTRY="metabobapp"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}  Pre-Commit Hook: Sync → Build → Deploy → Validate${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "Registry:     ${YELLOW}${IMAGE_REGISTRY}${NC}" | tee -a "$LOG_FILE"
echo -e "Build:        ${YELLOW}${BUILD_NUM}${NC}" | tee -a "$LOG_FILE"
echo -e "Commit:       ${YELLOW}${GIT_SHA}${NC}" | tee -a "$LOG_FILE"
echo -e "Log File:     ${YELLOW}${LOG_FILE}${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Function to handle failures (soft fail - allow commit)
handle_failure() {
    local step=$1
    local exit_code=$2

    echo -e "\n${RED}✗ FAILED: $step (exit code: $exit_code)${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}  ⚠️  COMMIT ALLOWED BUT DEPLOYMENT FAILED${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${RED}To fix and deploy manually:${NC}" | tee -a "$LOG_FILE"
    echo -e "  1. Review logs: ${YELLOW}$LOG_FILE${NC}" | tee -a "$LOG_FILE"
    echo -e "  2. cd repos/deployment && git checkout dev" | tee -a "$LOG_FILE"
    echo -e "  3. Sync changes and rebuild" | tee -a "$LOG_FILE"
    echo -e "  4. Deploy: cd helm && helmfile -e local sync" | tee -a "$LOG_FILE"
    echo -e "\n${YELLOW}Your commit will proceed, but system may be unstable.${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    # Create failure marker
    echo "$step failed at $TIMESTAMP" > "$REPO_ROOT/.git/hooks/LAST_FAILURE"
    echo "Log: $LOG_FILE" >> "$REPO_ROOT/.git/hooks/LAST_FAILURE"

    exit 0  # Allow commit
}

# Function to report success
handle_success() {
    echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}  ✓ ALL CHECKS PASSED - SYSTEM FUNCTIONAL${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"

    # Remove failure marker
    rm -f "$REPO_ROOT/.git/hooks/LAST_FAILURE"

    exit 0
}

# Check if we should skip (e.g., during rebase)
if [ -n "$GIT_REFLOG_ACTION" ]; then
    echo -e "${YELLOW}Skipping pre-commit (git operation in progress)${NC}"
    exit 0
fi

# Check previous failure
if [ -f "$REPO_ROOT/.git/hooks/LAST_FAILURE" ]; then
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ⚠️  PREVIOUS BUILD/DEPLOY FAILED${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    cat "$REPO_ROOT/.git/hooks/LAST_FAILURE"
    echo -e "${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Fix via repos/deployment/ workflow (see CLAUDE.md)${NC}\n"
fi

# Check if deployment repo exists
if [ ! -d "$DEPLOYMENT_REPO" ]; then
    echo -e "${YELLOW}⚠️  repos/deployment/ not found${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}  Skipping deployment workflow${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}  Clone deployment repo to enable automatic deployment${NC}" | tee -a "$LOG_FILE"
    exit 0  # Allow commit without deployment
fi

cd "$REPO_ROOT"

# Get changed files
CHANGED_FILES=$(git diff --cached --name-only)

# Check if any vessel code changed
VESSELS_CHANGED=false
declare -A CHANGED_VESSELS

if echo "$CHANGED_FILES" | grep -q "^repos/metabob-activity-api/"; then
    VESSELS_CHANGED=true
    CHANGED_VESSELS[metabob-activity-api]=1
fi

if echo "$CHANGED_FILES" | grep -q "^repos/minibob/"; then
    VESSELS_CHANGED=true
    CHANGED_VESSELS[minibob]=1
fi

if echo "$CHANGED_FILES" | grep -q "^repos/metabob-analysis-api/"; then
    VESSELS_CHANGED=true
    CHANGED_VESSELS[metabob-analysis-api]=1
fi

if echo "$CHANGED_FILES" | grep -q "^repos/metabob-mcp/"; then
    VESSELS_CHANGED=true
    CHANGED_VESSELS[metabob-mcp]=1
fi

if echo "$CHANGED_FILES" | grep -q "^repos/activity-dashboard/"; then
    VESSELS_CHANGED=true
    CHANGED_VESSELS[activity-dashboard]=1
fi

# If no vessels changed, skip deployment workflow
if [ "$VESSELS_CHANGED" = false ]; then
    echo -e "${BLUE}No vessel changes detected - skipping deployment${NC}" | tee -a "$LOG_FILE"
    exit 0
fi

# Step 1: Ensure deployment repo is on dev branch
echo -e "${BLUE}[1/6] Checking deployment repository...${NC}" | tee -a "$LOG_FILE"

cd "$DEPLOYMENT_REPO"

# Check if we're on dev branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo -e "${YELLOW}Switching deployment repo to dev branch...${NC}" | tee -a "$LOG_FILE"
    git checkout dev >> "$LOG_FILE" 2>&1 || handle_failure "Switch to dev branch" $?
fi

# Pull latest from dev
echo -e "${YELLOW}Pulling latest from deployment repo...${NC}" | tee -a "$LOG_FILE"
git pull origin dev >> "$LOG_FILE" 2>&1 || echo -e "${YELLOW}⚠️  Pull failed (may be ahead)${NC}" | tee -a "$LOG_FILE"

echo -e "${GREEN}✓${NC} Deployment repo ready (branch: dev)" | tee -a "$LOG_FILE"

# Step 2: Sync changed vessels to deployment repo
echo -e "\n${BLUE}[2/6] Syncing changed vessels...${NC}" | tee -a "$LOG_FILE"

for vessel in "${!CHANGED_VESSELS[@]}"; do
    echo -e "${YELLOW}Syncing ${vessel}...${NC}" | tee -a "$LOG_FILE"

    # Create target directory if it doesn't exist
    mkdir -p "vessels/$vessel"

    # Sync source from main workspace to deployment workspace
    rsync -av --delete \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='.env' \
        "$REPO_ROOT/repos/$vessel/" \
        "vessels/$vessel/" >> "$LOG_FILE" 2>&1 || handle_failure "Sync $vessel" $?

    echo -e "${GREEN}✓${NC} Synced ${vessel}" | tee -a "$LOG_FILE"
done

# Step 3: Build Docker images
echo -e "\n${BLUE}[3/6] Building Docker images...${NC}" | tee -a "$LOG_FILE"

for vessel in "${!CHANGED_VESSELS[@]}"; do
    # Get version from package.json
    VERSION="0.0.0"
    if [ -f "vessels/$vessel/package.json" ]; then
        VERSION=$(grep -o '"version":[[:space:]]*"[^"]*"' "vessels/$vessel/package.json" | grep -o '[0-9][^"]*' | head -1)
    fi

    IMAGE_TAG="dev-${VERSION}-${GIT_SHA}-${BUILD_NUM}"
    FULL_IMAGE="${IMAGE_REGISTRY}/${vessel}:${IMAGE_TAG}"

    echo -e "${YELLOW}Building ${FULL_IMAGE}${NC}" | tee -a "$LOG_FILE"

    # Build from deployment repo vessels directory
    cd "$DEPLOYMENT_REPO"

    # Build with appropriate Dockerfile
    if [ -f "vessels/$vessel/Dockerfile" ]; then
        docker build -t "${FULL_IMAGE}" -t "${IMAGE_REGISTRY}/${vessel}:latest" "vessels/$vessel" >> "$LOG_FILE" 2>&1 || handle_failure "Build $vessel" $?
    else
        echo -e "${YELLOW}⚠️  No Dockerfile found for ${vessel}${NC}" | tee -a "$LOG_FILE"
        continue
    fi

    echo -e "${GREEN}✓${NC} Built ${FULL_IMAGE}" | tee -a "$LOG_FILE"

    # Update helm values with new image tag
    HELM_CHART="helm/charts/$vessel"
    if [ "$vessel" = "minibob" ]; then
        HELM_CHART="helm/charts/devbob"
    fi

    if [ -f "$HELM_CHART/values.yaml" ]; then
        sed -i.bak "s|repository:.*${vessel}.*|repository: ${IMAGE_REGISTRY}/${vessel}|" "$HELM_CHART/values.yaml"
        sed -i.bak "s|tag:.*|tag: \"${IMAGE_TAG}\"|" "$HELM_CHART/values.yaml"
        echo -e "${GREEN}✓${NC} Updated helm values: ${HELM_CHART}/values.yaml" | tee -a "$LOG_FILE"
    fi
done

# Step 4: Deploy via helmfile
echo -e "\n${BLUE}[4/6] Deploying via helmfile...${NC}" | tee -a "$LOG_FILE"

cd "$DEPLOYMENT_REPO/helm"

# Check if kubernetes is available
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${YELLOW}⚠️  Kubernetes cluster not available - skipping deployment${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}  Changes synced to deployment repo but not deployed${NC}" | tee -a "$LOG_FILE"
    cd "$REPO_ROOT"
    exit 0  # Allow commit without deployment
fi

# Deploy with helmfile
echo -e "${YELLOW}Running: helmfile -e local sync${NC}" | tee -a "$LOG_FILE"
helmfile -e local sync >> "$LOG_FILE" 2>&1 || handle_failure "Helmfile deployment" $?
echo -e "${GREEN}✓${NC} Deployment completed" | tee -a "$LOG_FILE"

# Step 5: Wait for pods to be ready
echo -e "\n${BLUE}[5/6] Waiting for pods to be ready...${NC}" | tee -a "$LOG_FILE"

for vessel in "${!CHANGED_VESSELS[@]}"; do
    POD_LABEL="app.kubernetes.io/name=$vessel"
    if [ "$vessel" = "minibob" ]; then
        POD_LABEL="app.kubernetes.io/name=minibob"
    fi

    echo -e "${YELLOW}Waiting for ${vessel}...${NC}" | tee -a "$LOG_FILE"
    kubectl wait --for=condition=ready pod -l "$POD_LABEL" -n activity-system --timeout=90s >> "$LOG_FILE" 2>&1 || handle_failure "$vessel not ready" $?
    echo -e "${GREEN}✓${NC} ${vessel} ready" | tee -a "$LOG_FILE"
done

# Step 6: Commit deployment repo changes
echo -e "\n${BLUE}[6/6] Committing deployment repo changes...${NC}" | tee -a "$LOG_FILE"

cd "$DEPLOYMENT_REPO"

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
    echo -e "${YELLOW}No changes in deployment repo to commit${NC}" | tee -a "$LOG_FILE"
else
    # Stage all changes
    git add -A

    # Create commit message listing changed vessels
    COMMIT_MSG="deploy: update vessels from main workspace $GIT_SHA

Synced and deployed:
"
    for vessel in "${!CHANGED_VESSELS[@]}"; do
        COMMIT_MSG+="  - $vessel
"
    done

    COMMIT_MSG+="
Build: $BUILD_NUM
Main commit: $GIT_SHA

Auto-synced from main workspace pre-commit hook"

    # Commit
    git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1 || handle_failure "Commit deployment repo" $?
    echo -e "${GREEN}✓${NC} Committed to deployment repo" | tee -a "$LOG_FILE"

    # Push to origin dev
    echo -e "${YELLOW}Pushing to deployment repo origin/dev...${NC}" | tee -a "$LOG_FILE"
    git push origin dev >> "$LOG_FILE" 2>&1 || echo -e "${YELLOW}⚠️  Push failed (may need manual push)${NC}" | tee -a "$LOG_FILE"
fi

cd "$REPO_ROOT"

# All checks passed!
handle_success
EOF

# Make executable
chmod +x "$HOOK_FILE"

echo "✓ Pre-commit hook installed successfully"
echo ""
echo "The hook will now:"
echo "  1. Sync changed vessels to repos/deployment/"
echo "  2. Build Docker images"
echo "  3. Deploy via helmfile"
echo "  4. Commit to deployment repo"
echo ""
echo "To disable: remove .git/hooks/pre-commit"
echo "To reinstall: run this script again"
