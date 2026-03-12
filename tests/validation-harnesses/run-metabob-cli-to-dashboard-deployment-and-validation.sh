#!/bin/bash
# Validation runner for metabob-cli-to-dashboard-deployment-and-validation
# Optionally deploys, then loads credentials and executes TypeScript harness

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="$SCRIPT_DIR/../../repos/platform/metabob-apps/deploy.sh"
CREDS_FILE="/tmp/e2e-test-creds.sh"
API_BASE_URL="${API_BASE_URL:-http://app.metabob.local}"
DEPLOY_BEFORE_TEST="${DEPLOY_BEFORE_TEST:-false}"
SKIP_DEPLOYMENT_CHECK="${SKIP_DEPLOYMENT_CHECK:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}Validation: metabob-cli-to-dashboard-deployment-and-validation${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# Optional: Deploy before testing
if [ "$DEPLOY_BEFORE_TEST" = "true" ]; then
    echo -e "${YELLOW}📦 Deploying metabob-rpc-api service...${NC}"
    
    if [ ! -f "$DEPLOY_SCRIPT" ]; then
        echo -e "${RED}❌ Deploy script not found: $DEPLOY_SCRIPT${NC}"
        exit 1
    fi
    
    cd "$(dirname "$DEPLOY_SCRIPT")"
    ./deploy.sh -e default -s metabob-rpc-api -v
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Deployment succeeded${NC}"
    echo ""
    
    # Wait for pods to be ready
    echo -e "${YELLOW}⏳ Waiting for pods to be ready...${NC}"
    kubectl wait --for=condition=ready pod -l app=metabob-rpc-api -n metabob --timeout=120s || true
    sleep 5
    echo ""
fi

# Check if credentials exist
if [ ! -f "$CREDS_FILE" ]; then
    echo -e "${RED}❌ Credentials file not found: $CREDS_FILE${NC}"
    echo -e "${YELLOW}   Run authentication flow first to generate credentials:${NC}"
    echo -e "${YELLOW}   ./tests/validation-harnesses/run-validation-metabob-cli-to-dashboard.sh${NC}"
    exit 1
fi

# Source credentials
source "$CREDS_FILE"

# Verify required variables
if [ -z "$JWT_TOKEN" ] || [ -z "$ORG_ID" ]; then
    echo -e "${RED}❌ Missing required credentials: JWT_TOKEN or ORG_ID${NC}"
    exit 1
fi

echo -e "${BLUE}🔧 Configuration:${NC}"
echo "   API Base URL: $API_BASE_URL"
echo "   Organization ID: $ORG_ID"
echo "   Skip Deployment Check: $SKIP_DEPLOYMENT_CHECK"
echo ""

# Export for TypeScript
export API_BASE_URL
export JWT_TOKEN
export ORG_ID
export SKIP_DEPLOYMENT_CHECK

# Run TypeScript harness
echo -e "${GREEN}🚀 Running validation harness...${NC}"
echo ""
cd "$SCRIPT_DIR"
npx ts-node metabob-cli-to-dashboard-deployment-and-validation-harness.ts

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}================================================================${NC}"
    echo -e "${GREEN}✅  VALIDATION PASSED${NC}"
    echo -e "${GREEN}================================================================${NC}"
else
    echo -e "${RED}================================================================${NC}"
    echo -e "${RED}❌  VALIDATION FAILED${NC}"
    echo -e "${RED}================================================================${NC}"
fi

exit $EXIT_CODE
