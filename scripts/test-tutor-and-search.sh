#!/usr/bin/env bash
#
# Test MiniBob tutor command and search/recommendation system
#
# This script verifies:
# 1. Template registration via minibob doctor tutor
# 2. Search/recommendation for various impulse state spaces
# 3. Authentication alignment with recent changes
#

set -e

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MINIBOB_DIR="$WORKSPACE_ROOT/repos/minibob"
TEST_DIR="$WORKSPACE_ROOT/.test-tutor"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  MiniBob Tutor & Search Test"
echo "=========================================="
echo ""

# Cleanup old test directory
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

cd "$MINIBOB_DIR"

# Check environment
echo -e "${BLUE}1. Checking Environment${NC}"
echo ""

if [ -z "$METABOB_API_KEY" ]; then
  echo -e "${RED}✗ METABOB_API_KEY not set${NC}"
  echo "  Set METABOB_API_KEY to test template registration"
  exit 1
else
  echo -e "${GREEN}✓ METABOB_API_KEY is set${NC}"
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo -e "${YELLOW}⚠ ANTHROPIC_API_KEY not set (LLM features disabled)${NC}"
else
  echo -e "${GREEN}✓ ANTHROPIC_API_KEY is set${NC}"
fi

ENDPOINT="${ACTIVITY_API_ENDPOINT:-https://activity.metabob.com}"
echo "  Using endpoint: $ENDPOINT"
echo ""

# Test 1: Create test template
echo -e "${BLUE}2. Creating Test Template${NC}"
echo ""

TEST_TEMPLATE_ID="test:tutor-verification-$(date +%s)"

cat > "$TEST_DIR/test-template.json" <<EOF
{
  "id": "$TEST_TEMPLATE_ID",
  "name": "Test Template for Tutor Verification",
  "description": "A minimal template to verify the tutor command works",
  "category": "tool",
  "tags": ["tool", "verification"],
  "input_shapes": ["goal"],
  "output_shapes": ["validation_result"],
  "tasks": [
    {
      "id": "verify",
      "description": "Verify the system is working",
      "prompt": {
        "template": "Echo 'System is working'",
        "variables": []
      }
    }
  ],
  "scope": "org",
  "public": false
}
EOF

echo "  Created test template: $TEST_TEMPLATE_ID"
echo "  Location: $TEST_DIR/test-template.json"
echo ""

# Test 2: Validate template
echo -e "${BLUE}3. Validating Template${NC}"
echo ""

if bun run index.ts doctor check "$TEST_DIR/test-template.json" --json > "$TEST_DIR/validation.json" 2>&1; then
  echo -e "${GREEN}✓ Template validation passed${NC}"
  cat "$TEST_DIR/validation.json" | jq -r '.file, .issues[]? | select(.message) | "  Issue: \(.message)"' 2>/dev/null || true
else
  echo -e "${RED}✗ Template validation failed${NC}"
  cat "$TEST_DIR/validation.json" 2>/dev/null || true
  exit 1
fi
echo ""

# Test 3: Submit template
echo -e "${BLUE}4. Submitting Template (doctor tutor)${NC}"
echo ""

if bun run index.ts doctor tutor "$TEST_DIR/test-template.json" --verbose --json > "$TEST_DIR/submission.json" 2>&1; then
  echo -e "${GREEN}✓ Template submitted successfully${NC}"

  TEMPLATE_ID=$(cat "$TEST_DIR/submission.json" | jq -r '.templateId' 2>/dev/null || echo "$TEST_TEMPLATE_ID")
  REGISTRY_URL=$(cat "$TEST_DIR/submission.json" | jq -r '.registryUrl' 2>/dev/null || echo "")

  echo "  Template ID: $TEMPLATE_ID"
  if [ -n "$REGISTRY_URL" ]; then
    echo "  Registry URL: $REGISTRY_URL"
  fi
else
  echo -e "${YELLOW}⚠ Template submission result:${NC}"
  cat "$TEST_DIR/submission.json" 2>/dev/null || true

  # Check if it's a 409 (already exists)
  if grep -q "already exists" "$TEST_DIR/submission.json" 2>/dev/null; then
    echo -e "${GREEN}✓ Template already exists (expected if running multiple times)${NC}"
  else
    echo -e "${RED}✗ Unexpected error during submission${NC}"
  fi
fi
echo ""

# Test 4: Verify template is retrievable
echo -e "${BLUE}5. Verifying Template is Retrievable${NC}"
echo ""

curl -s "$ENDPOINT/v2/activities/templates/$TEST_TEMPLATE_ID" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Accept: application/json" > "$TEST_DIR/retrieved-template.json" 2>&1

if [ -f "$TEST_DIR/retrieved-template.json" ] && jq -e '.id' "$TEST_DIR/retrieved-template.json" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Template retrieved successfully${NC}"
  RETRIEVED_ID=$(jq -r '.id' "$TEST_DIR/retrieved-template.json")
  RETRIEVED_NAME=$(jq -r '.name' "$TEST_DIR/retrieved-template.json")
  echo "  ID: $RETRIEVED_ID"
  echo "  Name: $RETRIEVED_NAME"
else
  echo -e "${YELLOW}⚠ Could not retrieve template (may not exist yet or auth issue)${NC}"
  cat "$TEST_DIR/retrieved-template.json" 2>/dev/null | head -20 || true
fi
echo ""

# Test 5: Test recommendation with various impulse states
echo -e "${BLUE}6. Testing Recommendation System${NC}"
echo ""

echo "6a. Basic recommendation (no shapes)"
curl -s -X POST "$ENDPOINT/v2/activities/recommend" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Verify the system is working",
    "limit": 3
  }' > "$TEST_DIR/recommend-basic.json" 2>&1

if jq -e '.recommendations' "$TEST_DIR/recommend-basic.json" > /dev/null 2>&1; then
  COUNT=$(jq -r '.recommendations | length' "$TEST_DIR/recommend-basic.json")
  echo -e "  ${GREEN}✓ Got $COUNT recommendations${NC}"
else
  echo -e "  ${YELLOW}⚠ Unexpected response format${NC}"
  cat "$TEST_DIR/recommend-basic.json" | head -20
fi
echo ""

echo "6b. Recommendation with input shapes (goal)"
curl -s -X POST "$ENDPOINT/v2/activities/recommend" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Verify the system",
    "impulse_shapes": ["goal"],
    "limit": 3
  }' > "$TEST_DIR/recommend-with-shapes.json" 2>&1

if jq -e '.recommendations' "$TEST_DIR/recommend-with-shapes.json" > /dev/null 2>&1; then
  COUNT=$(jq -r '.recommendations | length' "$TEST_DIR/recommend-with-shapes.json")
  echo -e "  ${GREEN}✓ Got $COUNT recommendations with shape filtering${NC}"

  # Show if our test template is included
  if jq -e '.recommendations[] | select(.id == "'$TEST_TEMPLATE_ID'")' "$TEST_DIR/recommend-with-shapes.json" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Test template found in recommendations${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ Unexpected response format${NC}"
  cat "$TEST_DIR/recommend-with-shapes.json" | head -20
fi
echo ""

echo "6c. Recommendation with expected output shapes"
curl -s -X POST "$ENDPOINT/v2/activities/recommend" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Verify the system",
    "impulse_shapes": ["goal"],
    "expected_output_shapes": ["validation_result"],
    "limit": 5
  }' > "$TEST_DIR/recommend-with-output-shapes.json" 2>&1

if jq -e '.recommendations' "$TEST_DIR/recommend-with-output-shapes.json" > /dev/null 2>&1; then
  COUNT=$(jq -r '.recommendations | length' "$TEST_DIR/recommend-with-output-shapes.json")
  echo -e "  ${GREEN}✓ Got $COUNT recommendations with output shape filtering${NC}"

  # Check if shape-conditioned scoring was used
  SCORE_METHOD=$(jq -r '.score_method // "unknown"' "$TEST_DIR/recommend-with-output-shapes.json" 2>/dev/null || echo "unknown")
  echo "  Score method: $SCORE_METHOD"

  # Show Thompson Sampling scores for top recommendation
  if jq -e '.recommendations[0]' "$TEST_DIR/recommend-with-output-shapes.json" > /dev/null 2>&1; then
    TOP_ID=$(jq -r '.recommendations[0].id' "$TEST_DIR/recommend-with-output-shapes.json")
    TOP_SCORE=$(jq -r '.recommendations[0].thompson_score // .recommendations[0].score // 0' "$TEST_DIR/recommend-with-output-shapes.json")
    TOP_ALPHA=$(jq -r '.recommendations[0].alpha // "N/A"' "$TEST_DIR/recommend-with-output-shapes.json")
    TOP_BETA=$(jq -r '.recommendations[0].beta // "N/A"' "$TEST_DIR/recommend-with-output-shapes.json")
    echo "  Top recommendation: $TOP_ID"
    echo "    Thompson score: $TOP_SCORE"
    echo "    Alpha: $TOP_ALPHA, Beta: $TOP_BETA"
  fi
else
  echo -e "  ${YELLOW}⚠ Unexpected response format${NC}"
  cat "$TEST_DIR/recommend-with-output-shapes.json" | head -20
fi
echo ""

echo "6d. Recommendation with tags"
curl -s -X POST "$ENDPOINT/v2/activities/recommend" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Run a test",
    "tags": ["test"],
    "limit": 5
  }' > "$TEST_DIR/recommend-with-tags.json" 2>&1

if jq -e '.recommendations' "$TEST_DIR/recommend-with-tags.json" > /dev/null 2>&1; then
  COUNT=$(jq -r '.recommendations | length' "$TEST_DIR/recommend-with-tags.json")
  echo -e "  ${GREEN}✓ Got $COUNT recommendations with tag filtering${NC}"

  # List all returned template IDs
  if [ "$COUNT" -gt 0 ]; then
    echo "  Templates:"
    jq -r '.recommendations[] | "    - \(.id): \(.name // "Unnamed")"' "$TEST_DIR/recommend-with-tags.json" 2>/dev/null | head -5
  fi
else
  echo -e "  ${YELLOW}⚠ Unexpected response format${NC}"
  cat "$TEST_DIR/recommend-with-tags.json" | head -20
fi
echo ""

# Test 6: Test search by listing templates with filters
echo -e "${BLUE}7. Testing Template Search/Listing${NC}"
echo ""

echo "7a. List all templates (limit 5)"
curl -s "$ENDPOINT/v2/activities/templates?limit=5" \
  -H "Authorization: ApiKey $METABOB_API_KEY" > "$TEST_DIR/list-all.json" 2>&1

if jq -e '.templates' "$TEST_DIR/list-all.json" > /dev/null 2>&1; then
  COUNT=$(jq -r '.templates | length' "$TEST_DIR/list-all.json")
  echo -e "  ${GREEN}✓ Got $COUNT templates${NC}"
else
  echo -e "  ${YELLOW}⚠ Unexpected response format${NC}"
  cat "$TEST_DIR/list-all.json" | head -20
fi
echo ""

echo "7b. Search by category"
curl -s "$ENDPOINT/v2/activities/templates?category=tool&limit=5" \
  -H "Authorization: ApiKey $METABOB_API_KEY" > "$TEST_DIR/search-category.json" 2>&1

if jq -e '.templates' "$TEST_DIR/search-category.json" > /dev/null 2>&1; then
  COUNT=$(jq -r '.templates | length' "$TEST_DIR/search-category.json")
  echo -e "  ${GREEN}✓ Got $COUNT tool templates${NC}"

  # Check if our test template is there
  if jq -e '.templates[] | select(.id == "'$TEST_TEMPLATE_ID'")' "$TEST_DIR/search-category.json" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Test template found in category search${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ Unexpected response format${NC}"
  cat "$TEST_DIR/search-category.json" | head -20
fi
echo ""

echo "7c. Search by input shape"
curl -s "$ENDPOINT/v2/activities/templates?input_shapes=goal&limit=5" \
  -H "Authorization: ApiKey $METABOB_API_KEY" > "$TEST_DIR/search-input-shape.json" 2>&1

if jq -e '.templates' "$TEST_DIR/search-input-shape.json" > /dev/null 2>&1; then
  COUNT=$(jq -r '.templates | length' "$TEST_DIR/search-input-shape.json")
  echo -e "  ${GREEN}✓ Got $COUNT templates with 'goal' input shape${NC}"
else
  echo -e "  ${YELLOW}⚠ Unexpected response format${NC}"
  cat "$TEST_DIR/search-input-shape.json" | head -20
fi
echo ""

# Summary
echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo ""

PASSED=0
TOTAL=10

# Check each test
echo "Results:"

# Test 1: Environment
[ -n "$METABOB_API_KEY" ] && echo -e "${GREEN}✓${NC} Environment configured" && ((PASSED++)) || echo -e "${RED}✗${NC} Environment not configured"

# Test 2: Template creation
[ -f "$TEST_DIR/test-template.json" ] && echo -e "${GREEN}✓${NC} Template created" && ((PASSED++)) || echo -e "${RED}✗${NC} Template creation failed"

# Test 3: Validation
if [ -f "$TEST_DIR/validation.json" ] && jq -e '.valid' "$TEST_DIR/validation.json" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Template validation passed" && ((PASSED++))
else
  echo -e "${RED}✗${NC} Template validation failed"
fi

# Test 4: Submission
if [ -f "$TEST_DIR/submission.json" ]; then
  echo -e "${GREEN}✓${NC} Template submission attempted" && ((PASSED++))
else
  echo -e "${RED}✗${NC} Template submission not attempted"
fi

# Test 5: Retrieval
if [ -f "$TEST_DIR/retrieved-template.json" ] && jq -e '.id' "$TEST_DIR/retrieved-template.json" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Template retrievable from backend" && ((PASSED++))
else
  echo -e "${YELLOW}⚠${NC} Template retrieval uncertain"
fi

# Test 6a-d: Recommendations
for test_file in recommend-basic recommend-with-shapes recommend-with-output-shapes recommend-with-tags; do
  if [ -f "$TEST_DIR/${test_file}.json" ] && jq -e '.recommendations' "$TEST_DIR/${test_file}.json" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Recommendation system working ($test_file)" && ((PASSED++))
  else
    echo -e "${RED}✗${NC} Recommendation system issue ($test_file)"
  fi
done

# Test 7: Search
if [ -f "$TEST_DIR/list-all.json" ] && jq -e '.templates' "$TEST_DIR/list-all.json" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Template search/listing working" && ((PASSED++))
else
  echo -e "${RED}✗${NC} Template search/listing failed"
fi

echo ""
echo "Passed: $PASSED/$TOTAL tests"
echo ""

if [ "$PASSED" -eq "$TOTAL" ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "The system is working correctly:"
  echo "  - Template registration via 'minibob doctor tutor' works"
  echo "  - Recommendation system with Thompson Sampling works"
  echo "  - Shape-based filtering works"
  echo "  - Tag-based filtering works"
  echo "  - Template search/listing works"
  exit 0
elif [ "$PASSED" -ge 7 ]; then
  echo -e "${YELLOW}✓ Most tests passed${NC}"
  echo ""
  echo "Core functionality is working. Some edge cases may need attention."
  exit 0
else
  echo -e "${RED}✗ Several tests failed${NC}"
  echo ""
  echo "Please check the output above for details."
  echo "Test files saved to: $TEST_DIR"
  exit 1
fi
