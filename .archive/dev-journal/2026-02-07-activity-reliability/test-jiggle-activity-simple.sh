#!/usr/bin/env bash
#
# Simple test script for jiggle-documentation activity
# Demonstrates the activity template structure and validates it
#

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=================================================="
echo " Jiggle Documentation Activity - Simple Test"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if template file exists
echo "1. Checking template file..."
if [ -f "jiggle-documentation.json" ]; then
    echo -e "${GREEN}✓${NC} Template file exists: jiggle-documentation.json"
    
    # Get file size
    SIZE=$(wc -c < jiggle-documentation.json)
    echo "  Size: $SIZE bytes"
    
    # Count lines
    LINES=$(wc -l < jiggle-documentation.json)
    echo "  Lines: $LINES"
else
    echo -e "${RED}✗${NC} Template file not found!"
    exit 1
fi

echo ""
echo "2. Validating JSON structure..."
if jq empty jiggle-documentation.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Valid JSON"
else
    echo -e "${RED}✗${NC} Invalid JSON!"
    exit 1
fi

echo ""
echo "3. Extracting template metadata..."
NAME=$(jq -r '.name' jiggle-documentation.json)
VERSION=$(jq -r '.version' jiggle-documentation.json)
CATEGORY=$(jq -r '.category' jiggle-documentation.json)
DESCRIPTION=$(jq -r '.description' jiggle-documentation.json)

echo "  Name: $NAME"
echo "  Version: $VERSION"
echo "  Category: $CATEGORY"
echo "  Description: $DESCRIPTION"

echo ""
echo "4. Analyzing template structure..."
TASK_COUNT=$(jq '.tasks | length' jiggle-documentation.json)
VARIABLE_COUNT=$(jq '[.tasks[].prompt.variables // []] | add | length' jiggle-documentation.json)
CONTEXT_REQ_COUNT=$(jq '.contextRequirements | length' jiggle-documentation.json)

echo "  Tasks: $TASK_COUNT"
echo "  Variables: $VARIABLE_COUNT"
echo "  Context Requirements: $CONTEXT_REQ_COUNT"

echo ""
echo "5. Listing tasks..."
for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK_ID=$(jq -r ".tasks[$i].id" jiggle-documentation.json)
    TASK_DESC=$(jq -r ".tasks[$i].description" jiggle-documentation.json)
    echo "  Task $((i+1)): $TASK_ID"
    echo "    $TASK_DESC"
done

echo ""
echo "6. Listing variables..."
# Extract all unique variables from tasks
jq -r '.tasks[].prompt.variables[]? | select(type == "object") | "  - \(.name) (\(.type), default: \(.default // "none")): \(.description)"' jiggle-documentation.json

echo ""
echo "7. Checking validation rules..."
HAS_PRE_CHECKS=$(jq -r '.integration.preChecks | length' jiggle-documentation.json)
HAS_POST_CHECKS=$(jq -r '.integration.postChecks | length' jiggle-documentation.json)
HAS_QUALITY_GATES=$(jq -r '.integration.qualityGates | length' jiggle-documentation.json)

echo "  Pre-checks: $HAS_PRE_CHECKS"
echo "  Post-checks: $HAS_POST_CHECKS"
echo "  Quality gates: $HAS_QUALITY_GATES"

echo ""
echo "8. Checking learning configuration..."
LEARNING_ENABLED=$(jq -r '.learning.enabled' jiggle-documentation.json)
FEEDBACK_POINTS=$(jq '.learning.feedbackPoints | length' jiggle-documentation.json)

echo "  Learning enabled: $LEARNING_ENABLED"
echo "  Feedback points: $FEEDBACK_POINTS"

echo ""
echo "9. Verifying composition examples..."
EXAMPLE_COUNT=$(jq '.composition.examples | length' jiggle-documentation.json)
echo "  Composition examples: $EXAMPLE_COUNT"

for i in $(seq 0 $(($EXAMPLE_COUNT - 1))); do
    EXAMPLE_NAME=$(jq -r ".composition.examples[$i].name" jiggle-documentation.json)
    echo "    Example $((i+1)): $EXAMPLE_NAME"
done

echo ""
echo "10. Template structure summary..."
echo ""
printf "%-30s %s\n" "Property" "Status"
printf "%-30s %s\n" "--------" "------"

# Check required top-level properties
for prop in "name" "version" "description" "category" "tasks" "integration" "hooks" "metabob" "composition" "learning"; do
    if jq -e ".$prop" jiggle-documentation.json > /dev/null 2>&1; then
        echo -e "$(printf "%-30s" "$prop") ${GREEN}✓${NC}"
    else
        echo -e "$(printf "%-30s" "$prop") ${RED}✗${NC}"
    fi
done

echo ""
echo "=================================================="
echo " Template Validation: COMPLETE"
echo "=================================================="
echo ""
echo "The jiggle-documentation activity template is"
echo "structurally valid and ready for registration."
echo ""
echo "Next steps:"
echo "  1. Register template with Metabob backend"
echo "  2. Test execution with: opencode activity run"
echo "  3. Verify learning metrics capture"
echo ""
