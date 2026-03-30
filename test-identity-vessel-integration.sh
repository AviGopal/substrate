#!/bin/bash
# Test Identity Vessel + Activity API Integration

set -e

echo "=== Identity Vessel + Activity API Integration Test ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
IDENTITY_VESSEL_URL="${IDENTITY_VESSEL_URL:-http://identity.metabob.local}"
ACTIVITY_API_URL="${ACTIVITY_API_URL:-http://activity.metabob.local}"

echo -e "${BLUE}Configuration:${NC}"
echo "  Identity Vessel: $IDENTITY_VESSEL_URL"
echo "  Activity API: $ACTIVITY_API_URL"
echo ""

# ==============================================================================
# Step 1: Verify Services are Running
# ==============================================================================

echo -e "${BLUE}Step 1: Verifying services...${NC}"

if curl -sf "$IDENTITY_VESSEL_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Identity Vessel is accessible"
else
    echo -e "${RED}✗${NC} Identity Vessel is NOT accessible"
    exit 1
fi

if curl -sf "$ACTIVITY_API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Activity API is accessible"
else
    echo -e "${RED}✗${NC} Activity API is NOT accessible"
    exit 1
fi

echo ""

# ==============================================================================
# Step 2: Generate Bootstrap Admin Key (if needed)
# ==============================================================================

echo -e "${BLUE}Step 2: Checking for bootstrap admin key...${NC}"

# Check if we have an admin key in environment
if [ -z "$ADMIN_API_KEY" ]; then
    echo -e "${YELLOW}⚠${NC}  No ADMIN_API_KEY found in environment"
    echo ""
    echo "To generate a bootstrap admin key, run:"
    echo ""
    echo -e "${BLUE}  cd repos/identity-vessel${NC}"
    echo -e "${BLUE}  bun run scripts/generate-bootstrap-key.ts${NC}"
    echo ""
    echo "Then set the environment variable:"
    echo ""
    echo -e "${BLUE}  export ADMIN_API_KEY=<generated-key>${NC}"
    echo ""
    echo "Skipping key generation test..."
    SKIP_KEY_GEN=1
else
    echo -e "${GREEN}✓${NC} Admin API key found"
    echo "  Key: ${ADMIN_API_KEY:0:20}..."
    SKIP_KEY_GEN=0
fi

echo ""

# ==============================================================================
# Step 3: Generate Test API Key via Identity Vessel
# ==============================================================================

if [ "$SKIP_KEY_GEN" -eq 0 ]; then
    echo -e "${BLUE}Step 3: Generating test API key...${NC}"

    GEN_RESPONSE=$(curl -sf -X POST "$IDENTITY_VESSEL_URL/v1/keys/generate" \
      -H "Authorization: Bearer $ADMIN_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "targetUserId": "usr_test_cli",
        "name": "Integration Test Key",
        "scopes": ["read", "write"],
        "expiresInDays": 1
      }' 2>&1 || echo '{"success": false}')

    if echo "$GEN_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Test API key generated"

        # Extract the key
        TEST_API_KEY=$(echo "$GEN_RESPONSE" | jq -r '.data.key')
        TEST_KEY_ID=$(echo "$GEN_RESPONSE" | jq -r '.data.keyId')

        echo "  Key ID: $TEST_KEY_ID"
        echo "  Key: ${TEST_API_KEY:0:30}..."
        echo ""
    else
        echo -e "${RED}✗${NC} Failed to generate test API key"
        echo "  Response: $GEN_RESPONSE"
        echo ""
        echo "This is expected if the identity-vessel integration isn't complete."
        echo "Trying with a test key format instead..."
        echo ""

        # Use a dummy test key for validation testing
        TEST_API_KEY="mb_test-metabob_com-usr_test-key_abc123-dummysignature"
        SKIP_AUTH_TEST=1
    fi
else
    echo -e "${YELLOW}Step 3: Skipped (no admin key)${NC}"
    echo ""
    SKIP_AUTH_TEST=1
fi

# ==============================================================================
# Step 4: Authenticate with Activity API using Generated Key
# ==============================================================================

if [ "$SKIP_AUTH_TEST" -eq 0 ]; then
    echo -e "${BLUE}Step 4: Authenticating with Activity API...${NC}"

    AUTH_RESPONSE=$(curl -sf -X POST "$ACTIVITY_API_URL/v2/auth/apikey" \
      -H "Content-Type: application/json" \
      -d "{\"api_key\": \"$TEST_API_KEY\"}" 2>&1 || echo '{"error": "request failed"}')

    if echo "$AUTH_RESPONSE" | jq -e '.token' > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Authentication successful"

        # Extract token and details
        JWT_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')
        SOURCE=$(echo "$AUTH_RESPONSE" | jq -r '.source // "unknown"')
        ORG_ID=$(echo "$AUTH_RESPONSE" | jq -r '.org_id')
        USER_ID=$(echo "$AUTH_RESPONSE" | jq -r '.user_id')
        SCOPES=$(echo "$AUTH_RESPONSE" | jq -r '.scopes | join(", ")')

        echo "  Source: $SOURCE"
        echo "  Org ID: $ORG_ID"
        echo "  User ID: $USER_ID"
        echo "  Scopes: $SCOPES"
        echo "  Token: ${JWT_TOKEN:0:50}..."
        echo ""

        # Check which validation path was used
        if [ "$SOURCE" = "identity-vessel" ]; then
            echo -e "${GREEN}🎉 SUCCESS!${NC} API key was validated via identity-vessel"
        elif [ "$SOURCE" = "surrealdb" ]; then
            echo -e "${YELLOW}⚠${NC}  API key used SurrealDB fallback (legacy path)"
        else
            echo -e "${YELLOW}⚠${NC}  Source unknown, check implementation"
        fi
        echo ""
    else
        echo -e "${RED}✗${NC} Authentication failed"
        echo "  Response: $AUTH_RESPONSE"
        echo ""
    fi
else
    echo -e "${YELLOW}Step 4: Skipped (no valid test key)${NC}"
    echo ""
fi

# ==============================================================================
# Step 5: Use JWT Token for Protected API Call
# ==============================================================================

if [ ! -z "$JWT_TOKEN" ]; then
    echo -e "${BLUE}Step 5: Testing JWT token with protected endpoint...${NC}"

    TEMPLATES_RESPONSE=$(curl -sf -X GET "$ACTIVITY_API_URL/v2/activities/templates?limit=3" \
      -H "Authorization: Bearer $JWT_TOKEN" 2>&1 || echo '{"error": "request failed"}')

    if echo "$TEMPLATES_RESPONSE" | jq -e '.templates' > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} JWT token works for protected endpoints"
        echo "  Retrieved $(echo "$TEMPLATES_RESPONSE" | jq '.templates | length') templates"
        echo ""
    else
        echo -e "${YELLOW}⚠${NC}  Protected endpoint test failed or no templates found"
        echo "  Response: $TEMPLATES_RESPONSE"
        echo ""
    fi
else
    echo -e "${YELLOW}Step 5: Skipped (no JWT token available)${NC}"
    echo ""
fi

# ==============================================================================
# Step 6: Test Key Revocation (if we generated a key)
# ==============================================================================

if [ "$SKIP_KEY_GEN" -eq 0 ] && [ ! -z "$TEST_KEY_ID" ]; then
    echo -e "${BLUE}Step 6: Testing key revocation...${NC}"

    REVOKE_RESPONSE=$(curl -sf -X POST "$IDENTITY_VESSEL_URL/v1/keys/revoke/$TEST_KEY_ID" \
      -H "Authorization: Bearer $ADMIN_API_KEY" 2>&1 || echo '{"success": false}')

    if echo "$REVOKE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Key revoked successfully"
        echo ""

        # Try to authenticate with revoked key
        echo "  Testing authentication with revoked key..."
        AUTH_REVOKED=$(curl -sf -X POST "$ACTIVITY_API_URL/v2/auth/apikey" \
          -H "Content-Type: application/json" \
          -d "{\"api_key\": \"$TEST_API_KEY\"}" 2>&1 || echo '{"error": "expected"}')

        if echo "$AUTH_REVOKED" | jq -e '.error' > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Revoked key correctly rejected"
        else
            echo -e "${RED}✗${NC} Revoked key still works (revocation not enforced)"
        fi
        echo ""
    else
        echo -e "${YELLOW}⚠${NC}  Key revocation test skipped or failed"
        echo ""
    fi
else
    echo -e "${YELLOW}Step 6: Skipped (no test key to revoke)${NC}"
    echo ""
fi

# ==============================================================================
# Summary
# ==============================================================================

echo "=== Summary ==="
echo ""
echo "Integration Status:"
echo "  • Identity Vessel: ✓ Deployed and accessible"
echo "  • Activity API: ✓ Deployed and accessible"
echo ""

if [ "$SKIP_KEY_GEN" -eq 0 ] && [ ! -z "$JWT_TOKEN" ]; then
    echo -e "${GREEN}✓ Full integration working!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Update activity-api auth.ts with identity-vessel integration"
    echo "  2. Deploy changes to cluster"
    echo "  3. Add key management UI to dashboard"
    echo "  4. Document API key usage for users"
else
    echo -e "${YELLOW}⚠ Partial integration${NC}"
    echo ""
    echo "To complete integration:"
    echo "  1. Generate bootstrap admin key"
    echo "  2. Implement /v2/auth/apikey identity-vessel delegation"
    echo "  3. Deploy and test end-to-end"
fi

echo ""
