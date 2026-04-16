#!/usr/bin/env bash
# Register all demo activities to canary backend
# This script will be executed BY MINIBOB, not manually

set -euo pipefail

# Configuration
CANARY_ENDPOINT="${METABOB_ENDPOINT:-https://activity.metabob.com}"
API_KEY="${METABOB_API_KEY:-}"
ACTIVITIES_DIR="./activities"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: METABOB_API_KEY not set"
  echo "Usage: export METABOB_API_KEY='your-key' && $0"
  exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Registering demo activities to canary backend"
echo "   Endpoint: $CANARY_ENDPOINT"
echo "   Activities directory: $ACTIVITIES_DIR"
echo ""

# Find all activity JSON files
ACTIVITIES=$(find "$ACTIVITIES_DIR" -name "*.json" -type f | sort)
ACTIVITY_COUNT=$(echo "$ACTIVITIES" | wc -l)

echo "📋 Found $ACTIVITY_COUNT activities to register"
echo ""

# Track results
REGISTERED=0
SKIPPED=0
FAILED=0

# Register each activity
for ACTIVITY_FILE in $ACTIVITIES; do
  ACTIVITY_NAME=$(basename "$ACTIVITY_FILE" .json)
  CATEGORY=$(basename "$(dirname "$ACTIVITY_FILE")")

  echo -n "📦 Registering $CATEGORY/$ACTIVITY_NAME... "

  # Extract activity ID from JSON
  ACTIVITY_ID=$(jq -r '.id' "$ACTIVITY_FILE")

  # Check if activity already exists
  EXISTING=$(curl -s \
    -H "Authorization: ApiKey $API_KEY" \
    "$CANARY_ENDPOINT/v2/activities/templates" | \
    jq -r --arg id "$ACTIVITY_ID" '.templates[] | select(.id == $id) | .id')

  if [ -n "$EXISTING" ]; then
    echo -e "${YELLOW}SKIPPED${NC} (already exists: $ACTIVITY_ID)"
    ((SKIPPED++))
    continue
  fi

  # Register activity
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: ApiKey $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$ACTIVITY_FILE" \
    "$CANARY_ENDPOINT/v2/activities/templates")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}SUCCESS${NC} (ID: $ACTIVITY_ID)"
    ((REGISTERED++))
  else
    echo -e "${RED}FAILED${NC} (HTTP $HTTP_CODE)"
    echo "   Error: $BODY" | head -1
    ((FAILED++))
  fi
done

echo ""
echo "═══════════════════════════════════════"
echo "📊 Registration Summary"
echo "═══════════════════════════════════════"
echo "   Total activities: $ACTIVITY_COUNT"
echo -e "   ${GREEN}Registered: $REGISTERED${NC}"
echo -e "   ${YELLOW}Skipped: $SKIPPED${NC}"
echo -e "   ${RED}Failed: $FAILED${NC}"
echo ""

# Verify registration
echo "🔍 Verifying registration..."
TEMPLATE_COUNT=$(curl -s \
  -H "Authorization: ApiKey $API_KEY" \
  "$CANARY_ENDPOINT/v2/activities/templates" | \
  jq '.templates | length')

echo "   Total templates in canary: $TEMPLATE_COUNT"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ All activities registered successfully!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some activities failed to register${NC}"
  exit 1
fi
