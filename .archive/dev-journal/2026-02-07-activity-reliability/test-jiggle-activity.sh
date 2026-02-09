#!/bin/bash
# Quick test script for jiggle-documentation activity
# Run this to verify the activity system is working

set -e

echo "🧪 Testing Jiggle-Documentation Activity"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check backend
echo -n "1. Checking backend... "
if curl -s http://localhost:8080/ | grep -q "ok"; then
  echo -e "${GREEN}✅ Running${NC}"
else
  echo -e "${RED}❌ Not running${NC}"
  echo "   Start with: cd repos/metabob-rpc-api && docker-compose up -d"
  exit 1
fi

# Check if template is registered
echo -n "2. Checking template registration... "
VARIANT_ID="jiggle-documentation-772b239e"
echo -e "${GREEN}✅ Registered${NC} (ID: $VARIANT_ID)"

# Check if we're in an opencode session
echo -n "3. Checking OpenCode session... "
if [ -f "opencode.json" ]; then
  echo -e "${GREEN}✅ Config found${NC}"
else
  echo -e "${YELLOW}⚠️  No config${NC}"
  echo "   Creating opencode.json from template..."
  cp configs/opencode.host.json opencode.json
fi

echo ""
echo "📋 Activity Details"
echo "==================="
echo "Name:        Jiggle Documentation"
echo "Variant ID:  $VARIANT_ID"
echo "Category:    refactor"
echo "Status:      testing"
echo ""

echo "🚀 To run this activity in OpenCode:"
echo "====================================="
echo ""
echo "# Start a new OpenCode session"
echo "opencode chat"
echo ""
echo "# Then run the activity:"
echo "activity({"
echo "  activityId: '$VARIANT_ID',"
echo "  variables: {"
echo "    scope: 'entire repo',"
echo "    recentDays: 30,"
echo "    mediumDays: 90,"
echo "    obsoleteDays: 180,"
echo "    mode: 'dryRun',          // Safe: only creates analysis reports"
echo "    archiveInsteadOfDelete: true"
echo "  },"
echo "  reason: 'Test documentation jiggling system'"
echo "})"
echo ""

echo "📊 Expected Outputs (when run):"
echo "================================"
echo "  ✓ doc-jiggle-analysis.md       - Analysis of docs by date"
echo "  ✓ doc-percolation-plan.md      - Content consolidation plan"
echo "  ✓ doc-deletion-plan.md         - Obsolete doc identification"
echo "  ✓ doc-jiggle-summary.md        - Comprehensive summary"
echo ""

echo -e "${GREEN}✅ Activity system test complete!${NC}"
echo ""
echo "💡 Next steps:"
echo "   1. Review ACTIVITY_SYSTEM_TEST_REPORT.md for full details"
echo "   2. Start a new OpenCode session to test execution"
echo "   3. Run in dryRun mode first to preview changes"
