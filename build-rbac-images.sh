#!/bin/bash
#
# Build Docker images for RBAC deployment
# Builds from repos/ directory to include metabob-proto dependency
#

set -e

REPO_ROOT="/home/avi/documents/work/exp-repo/metabob-devbob"
REPOS_DIR="$REPO_ROOT/repos"

echo "=============================================================================="
echo "Building RBAC Docker Images"
echo "=============================================================================="
echo ""

cd "$REPOS_DIR"

# Build metabob-activity-api (includes RBAC schemas)
echo "[1/4] Building metabob-activity-api with RBAC migrations..."
docker build \
  -f metabob-activity-api/Dockerfile \
  -t metabob-activity-api:latest \
  .
echo "✓ metabob-activity-api:latest built"
echo ""

# Build metabob-analysis-api (includes RBAC schemas)
echo "[2/4] Building metabob-analysis-api with RBAC schemas..."
cd "$REPOS_DIR"
docker build \
  -f metabob-analysis-api/Dockerfile \
  -t metabob-analysis-api:latest \
  .
echo "✓ metabob-analysis-api:latest built"
echo ""

# Build metabob-mcp (MCP server)
echo "[3/4] Building metabob-mcp..."
cd "$REPOS_DIR/metabob-mcp"
docker build -t metabob-mcp:latest .
echo "✓ metabob-mcp:latest built"
echo ""

# Build minibob (vessel with instance auth support)
echo "[4/4] Building minibob with instance auth..."
cd "$REPOS_DIR/minibob"
docker build -t minibob:latest .
echo "✓ minibob:latest built"
echo ""

echo "=============================================================================="
echo "✓ All images built successfully"
echo "=============================================================================="
echo ""
echo "Images:"
echo "  - metabob-activity-api:latest (with RBAC migrations)"
echo "  - metabob-analysis-api:latest (with RBAC schemas)"
echo "  - metabob-mcp:latest"
echo "  - minibob:latest"
echo ""
echo "Next steps:"
echo "  1. Deploy: cd $REPO_ROOT/helm && helmfile -f activity-system-minimal.yaml.gotmpl sync"
echo "  2. Watch: kubectl get pods -n activity-system -w"
echo "  3. Logs: kubectl logs -n activity-system -l job-name=surrealdb-init-job"
echo ""
