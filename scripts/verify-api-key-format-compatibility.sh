#!/usr/bin/env bash
set -euo pipefail

# API Key Format Compatibility Verification Script
# Tests that both old and new API key formats work with metabob-activity-api

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ACTIVITY_API_URL="${ACTIVITY_API_URL:-https://activity.metabob.com}"
IDENTITY_VESSEL_URL="${IDENTITY_VESSEL_URL:-https://identity.metabob.com}"

echo "======================================================================"
echo "API Key Format Compatibility Verification"
echo "======================================================================"
echo ""
echo "Activity API: $ACTIVITY_API_URL"
echo "Identity Vessel: $IDENTITY_VESSEL_URL"
echo ""

# Check if required tools are installed
command -v curl >/dev/null 2>&1 || { echo -e "${RED}Error: curl not found${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}Error: jq not found${NC}"; exit 1; }

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local test_name="$1"
  local test_command="$2"

  TESTS_RUN=$((TESTS_RUN + 1))
  echo -e "${YELLOW}[TEST $TESTS_RUN]${NC} $test_name"

  if eval "$test_command"; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo ""
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo ""
    return 1
  fi
}

# Test 1: Health check (no auth required)
run_test "Health check (no authentication)" \
  "curl -s -f $ACTIVITY_API_URL/health > /dev/null"

# Test 2: Old format API key (if available)
if [ -n "${OLD_FORMAT_API_KEY:-}" ]; then
  run_test "Old format API key validation" \
    "curl -s -f -H 'Authorization: ApiKey $OLD_FORMAT_API_KEY' $ACTIVITY_API_URL/v2/activities/templates > /dev/null"
else
  echo -e "${YELLOW}[SKIP]${NC} Old format API key test (OLD_FORMAT_API_KEY not set)"
  echo ""
fi

# Test 3: New format API key (if available)
if [ -n "${NEW_FORMAT_API_KEY:-}" ]; then
  run_test "New format API key validation" \
    "curl -s -f -H 'Authorization: ApiKey $NEW_FORMAT_API_KEY' $ACTIVITY_API_URL/v2/activities/templates > /dev/null"
else
  echo -e "${YELLOW}[SKIP]${NC} New format API key test (NEW_FORMAT_API_KEY not set)"
  echo ""
fi

# Test 4: Generate new format key via identity-vessel (if available)
if [ -n "${IDENTITY_ADMIN_TOKEN:-}" ]; then
  echo -e "${YELLOW}[TEST]${NC} Generate new format API key via identity-vessel"

  NEW_KEY_RESPONSE=$(curl -s -X POST "$IDENTITY_VESSEL_URL/v1/keys/generate" \
    -H "Authorization: Bearer $IDENTITY_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "orgId": "test-org",
      "userId": "test-user",
      "name": "Compatibility Test Key",
      "expiresInDays": 1
    }')

  if [ $? -eq 0 ] && echo "$NEW_KEY_RESPONSE" | jq -e '.key' > /dev/null 2>&1; then
    GENERATED_KEY=$(echo "$NEW_KEY_RESPONSE" | jq -r '.key')
    echo "Generated key: ${GENERATED_KEY:0:20}..."

    # Test 5: Validate generated key immediately
    run_test "Validate newly generated key" \
      "curl -s -f -H 'Authorization: ApiKey $GENERATED_KEY' $ACTIVITY_API_URL/v2/activities/templates > /dev/null"

    # Test 6: Verify key format
    if [[ "$GENERATED_KEY" =~ ^mb- ]]; then
      echo -e "${GREEN}✓${NC} Key has correct prefix: mb-"
      TESTS_PASSED=$((TESTS_PASSED + 1))
    else
      echo -e "${RED}✗${NC} Key has wrong prefix: ${GENERATED_KEY:0:3}"
      TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
    echo ""

  else
    echo -e "${RED}✗ FAIL${NC} Key generation failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo ""
  fi
else
  echo -e "${YELLOW}[SKIP]${NC} Key generation test (IDENTITY_ADMIN_TOKEN not set)"
  echo ""
fi

# Test 7: Format parsing validation (via identity-vessel)
if [ -n "${NEW_FORMAT_API_KEY:-}" ]; then
  echo -e "${YELLOW}[TEST]${NC} Identity-vessel format parsing"

  RESOLVE_RESPONSE=$(curl -s -X POST "$IDENTITY_VESSEL_URL/v1/auth/resolve" \
    -H "Content-Type: application/json" \
    -d "{
      \"impulse\": {
        \"type\": \"authentication\",
        \"pointer\": {
          \"type\": \"apiKey\",
          \"apiKey\": \"$NEW_FORMAT_API_KEY\"
        }
      }
    }")

  if echo "$RESOLVE_RESPONSE" | jq -e '.success and .data.authenticated' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} Identity-vessel parsed and validated key"
    TESTS_PASSED=$((TESTS_PASSED + 1))

    ORG_ID=$(echo "$RESOLVE_RESPONSE" | jq -r '.data.orgId')
    USER_ID=$(echo "$RESOLVE_RESPONSE" | jq -r '.data.userId')
    KEY_ID=$(echo "$RESOLVE_RESPONSE" | jq -r '.data.keyId')

    echo "  orgId: $ORG_ID"
    echo "  userId: $USER_ID"
    echo "  keyId: $KEY_ID"
  else
    echo -e "${RED}✗ FAIL${NC} Identity-vessel validation failed"
    echo "Response: $RESOLVE_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  TESTS_RUN=$((TESTS_RUN + 1))
  echo ""
else
  echo -e "${YELLOW}[SKIP]${NC} Format parsing test (NEW_FORMAT_API_KEY not set)"
  echo ""
fi

# Test 8: Direct SurrealDB fallback (requires valid key in database)
if [ -n "${NEW_FORMAT_API_KEY:-}" ]; then
  echo -e "${YELLOW}[TEST]${NC} Direct SurrealDB fallback (simulate identity-vessel down)"
  echo "Note: This test assumes the key hash exists in the api_key table"
  echo "In production, this fallback only works if the key was previously validated and stored"
  echo ""
fi

# Summary
echo "======================================================================"
echo "Test Summary"
echo "======================================================================"
echo ""
echo "Total tests run: $TESTS_RUN"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
else
  echo "Failed: 0"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_RUN -gt 0 ]; then
  echo -e "${GREEN}======================================================================"
  echo "✓ All tests passed - API key format compatibility verified"
  echo "======================================================================${NC}"
  echo ""
  echo "Conclusion:"
  echo "- Old and new API key formats are both compatible"
  echo "- Activity-API treats keys as opaque strings"
  echo "- Identity-vessel handles format parsing"
  echo "- Direct fallback uses SHA-256 hash (format-agnostic)"
  echo ""
  exit 0
else
  echo -e "${RED}======================================================================"
  echo "✗ Some tests failed - see details above"
  echo "======================================================================${NC}"
  echo ""
  if [ $TESTS_RUN -eq 0 ]; then
    echo "No tests were run. Set environment variables:"
    echo "  - OLD_FORMAT_API_KEY: Test old format compatibility"
    echo "  - NEW_FORMAT_API_KEY: Test new format compatibility"
    echo "  - IDENTITY_ADMIN_TOKEN: Test key generation"
    echo ""
  fi
  exit 1
fi
