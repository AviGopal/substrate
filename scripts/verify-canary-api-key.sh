#!/bin/bash
#
# Verify API Key Registration for Canary Environment
#
# Prerequisites:
# 1. kubectl port-forward running: kubectl port-forward svc/surrealdb 8000:8000 -n activity-system
# 2. CANARY_SURREALDB_PASSWORD set or available via SOPS
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Canary API Key Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check port forward is running
echo -e "${YELLOW}[1/5] Checking SurrealDB port forward...${NC}"
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
  echo -e "${RED}✗ SurrealDB not accessible at localhost:8000${NC}"
  echo ""
  echo "Please run in another terminal:"
  echo "  kubectl port-forward svc/surrealdb 8000:8000 -n activity-system"
  echo ""
  exit 1
fi
echo -e "${GREEN}✓ SurrealDB accessible${NC}"
echo ""

# Step 2: Check current API key
echo -e "${YELLOW}[2/5] Checking current API key configuration...${NC}"

# Check environment variable
if [ -n "$METABOB_API_KEY" ]; then
  CURRENT_KEY="$METABOB_API_KEY"
  echo -e "${GREEN}✓ METABOB_API_KEY set in environment${NC}"
  echo "  Preview: ${CURRENT_KEY:0:12}..."
else
  # Check config file
  if [ -f "$HOME/.metabob/config.json" ]; then
    CURRENT_KEY=$(cat "$HOME/.metabob/config.json" | jq -r '.metabob.apiKey // empty')
    if [ -n "$CURRENT_KEY" ]; then
      echo -e "${GREEN}✓ API key found in ~/.metabob/config.json${NC}"
      echo "  Preview: ${CURRENT_KEY:0:12}..."
    else
      echo -e "${RED}✗ No API key found${NC}"
      CURRENT_KEY=""
    fi
  else
    echo -e "${RED}✗ No API key configured${NC}"
    CURRENT_KEY=""
  fi
fi
echo ""

# Step 3: List organizations
echo -e "${YELLOW}[3/5] Listing organizations in canary...${NC}"
cd "$PROJECT_ROOT"
bun run scripts/commission-canary.ts org list
echo ""

# Step 4: List API keys
echo -e "${YELLOW}[4/5] Listing API keys in canary...${NC}"
bun run scripts/commission-canary.ts apikey list
echo ""

# Step 5: Check if metabob-devbob org exists
echo -e "${YELLOW}[5/5] Verifying metabob-devbob organization...${NC}"

ORG_CHECK=$(bun run scripts/commission-canary.ts org list 2>/dev/null | grep -c "metabob_devbob" || true)

if [ "$ORG_CHECK" -eq 0 ]; then
  echo -e "${RED}✗ metabob-devbob organization does NOT exist${NC}"
  echo ""
  echo -e "${YELLOW}Would you like to create it? (y/n)${NC}"
  read -r CREATE_ORG

  if [ "$CREATE_ORG" = "y" ]; then
    echo ""
    echo "Creating metabob-devbob organization..."
    bun run scripts/commission-canary.ts org create \
      --name "Metabob DevBob" \
      --admin-email "dev@metabob.com" \
      --tier pro

    echo ""
    echo -e "${GREEN}✓ Organization created${NC}"
    echo ""
    echo "IMPORTANT: Save the credentials shown above!"
    echo "The MiniBob API Key should be used for METABOB_API_KEY"
  fi
else
  echo -e "${GREEN}✓ metabob-devbob organization exists${NC}"

  # Check if current API key is for metabob-devbob
  if [ -n "$CURRENT_KEY" ]; then
    echo ""
    echo "Checking if current API key belongs to metabob-devbob..."

    # This would require querying the database to check key hash
    # For now, we'll just show what's configured
    echo ""
    echo "Current API key: ${CURRENT_KEY:0:12}..."
    echo ""
    echo "To verify this key belongs to metabob-devbob organization,"
    echo "check the output above in the API keys list."
  fi
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Next Steps${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "1. Ensure your METABOB_API_KEY belongs to metabob-devbob org"
echo "2. Set it in your environment or config file:"
echo "   export METABOB_API_KEY=\"mb_live_...\""
echo ""
echo "3. Or update ~/.metabob/config.json:"
echo "   {"
echo "     \"metabob\": {"
echo "       \"apiKey\": \"mb_live_...\","
echo "       \"endpoint\": \"https://activity.metabob.com\""
echo "     }"
echo "   }"
echo ""
echo "4. Unset any conflicting environment variables:"
echo "   unset METABOB_API_KEY  # If you want to use config file"
echo ""
