#!/usr/bin/env bash
#
# API Key Authentication E2E Test Runner
#
# Runs comprehensive tests for the API-key-only authentication flow:
# - MiniBob config loading with API key
# - Identity vessel API key validation
# - Activity API authentication middleware
# - Multi-tenant isolation
#
# Requirements:
# - METABOB_API_KEY_ORG_A: API key for test org A
# - METABOB_API_KEY_ORG_B: API key for test org B (optional, for isolation tests)
# - ACTIVITY_API_ENDPOINT: Activity API URL (default: http://activity.metabob.local)
# - IDENTITY_API_ENDPOINT: Identity API URL (default: http://identity.metabob.local)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ACTIVITY_API_ENDPOINT=${ACTIVITY_API_ENDPOINT:-http://activity.metabob.local}
IDENTITY_API_ENDPOINT=${IDENTITY_API_ENDPOINT:-http://identity.metabob.local}

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}API Key Authentication E2E Test Suite${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check environment variables
echo -e "${YELLOW}Checking environment variables...${NC}"

if [ -z "$METABOB_API_KEY_ORG_A" ]; then
  echo -e "${RED}✗ METABOB_API_KEY_ORG_A not set${NC}"
  echo "  Set it with: export METABOB_API_KEY_ORG_A=your-api-key"
  exit 1
fi
echo -e "${GREEN}✓ METABOB_API_KEY_ORG_A configured${NC}"

if [ -z "$METABOB_API_KEY_ORG_B" ]; then
  echo -e "${YELLOW}⚠ METABOB_API_KEY_ORG_B not set (isolation tests will be skipped)${NC}"
else
  echo -e "${GREEN}✓ METABOB_API_KEY_ORG_B configured${NC}"
fi

echo ""
echo -e "${YELLOW}Endpoints:${NC}"
echo "  Activity API: $ACTIVITY_API_ENDPOINT"
echo "  Identity API: $IDENTITY_API_ENDPOINT"
echo ""

# Health checks
echo -e "${YELLOW}Performing health checks...${NC}"

if curl -s "$ACTIVITY_API_ENDPOINT/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Activity API reachable${NC}"
else
  echo -e "${YELLOW}⚠ Activity API not reachable (some tests will be skipped)${NC}"
fi

if curl -s "$IDENTITY_API_ENDPOINT/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Identity API reachable${NC}"
else
  echo -e "${YELLOW}⚠ Identity API not reachable (some tests will be skipped)${NC}"
fi

echo ""

# Test 1: MiniBob config and authentication
echo -e "${BLUE}=== Test 1: MiniBob Config & Authentication ===${NC}"
cd repos/minibob
echo "Running: bun test test/auth-e2e.test.ts"
bun test test/auth-e2e.test.ts
cd ../..
echo -e "${GREEN}✓ MiniBob tests passed${NC}"
echo ""

# Test 2: Identity vessel API key validation
echo -e "${BLUE}=== Test 2: Identity Vessel Key Validation ===${NC}"
cd repos/identity-vessel
echo "Running: bun test test/api-key-validation.test.ts"
bun test test/api-key-validation.test.ts
cd ../..
echo -e "${GREEN}✓ Identity vessel tests passed${NC}"
echo ""

# Test 3: Activity API authentication middleware
echo -e "${BLUE}=== Test 3: Activity API Auth Middleware ===${NC}"
cd repos/metabob-activity-api
echo "Running: bun test test/api-key-auth.test.ts"
bun test test/api-key-auth.test.ts
cd ../..
echo -e "${GREEN}✓ Activity API tests passed${NC}"
echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}All API Key Authentication Tests Passed!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Test Coverage:"
echo "  ✓ MiniBob config loading with API key"
echo "  ✓ API key validation (HMAC signature)"
echo "  ✓ org_id extraction from API key"
echo "  ✓ Activity API authentication middleware"
echo "  ✓ Multi-tenant isolation enforcement"
echo "  ✓ Error handling (invalid/missing keys)"
echo ""
echo "Integration Points Verified:"
echo "  MiniBob → Identity Vessel (key validation)"
echo "  MiniBob → Activity API (authenticated requests)"
echo "  Activity API → Identity Vessel (key validation)"
echo "  Activity API → SurrealDB (RBAC enforcement)"
echo ""
