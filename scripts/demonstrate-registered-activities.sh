#!/usr/bin/env bash
#
# Demonstrate Using Registered Activity Templates
#
# This script shows how to:
# 1. Search for templates by text
# 2. Get Thompson Sampling recommendations
# 3. Execute activities with MiniBob
#

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSPACE_ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Demonstrating Registered Activity Templates ===${NC}\n"

# Check prerequisites
if [[ ! -f "repos/minibob/index.ts" ]]; then
  echo "Error: MiniBob not found at repos/minibob/"
  exit 1
fi

if [[ -z "${METABOB_API_KEY:-}" ]]; then
  echo "Error: METABOB_API_KEY environment variable not set"
  exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}\n"

# Function to run a demonstration step
demo_step() {
  local step_num="$1"
  local description="$2"
  local command="$3"

  echo -e "${YELLOW}Step ${step_num}: ${description}${NC}"
  echo -e "${BLUE}Command:${NC} ${command}"
  echo ""

  eval "$command"

  echo ""
  echo -e "${GREEN}---${NC}\n"
}

# Step 1: Text-based search
demo_step 1 \
  "Search for test-related templates by text" \
  "cd repos/minibob && bun run index.ts doctor surface 'test' --selections=3 --verbose 2>&1 | head -40"

# Step 2: Search by category
demo_step 2 \
  "Search for bootstrap templates" \
  "cd repos/minibob && bun run index.ts doctor surface 'bootstrap' --selections=3 --verbose 2>&1 | head -40"

# Step 3: Thompson Sampling recommendation
demo_step 3 \
  "Get Thompson Sampling recommendations for 'create a test'" \
  "cd repos/minibob && bun run index.ts doctor surface --goal 'create a unit test for a TypeScript module' --selections=3 --verbose 2>&1 | head -60"

# Step 4: Another Thompson Sampling query
demo_step 4 \
  "Get recommendations for bug fixing" \
  "cd repos/minibob && bun run index.ts doctor surface --goal 'fix a bug in my code' --selections=3 --verbose 2>&1 | head -60"

# Step 5: Check what templates are available
demo_step 5 \
  "List all available templates from backend" \
  "curl -s https://activity.metabob.com/v2/activities/templates?limit=30 -H 'Authorization: ApiKey $METABOB_API_KEY' | jq '.templates[] | {id, name, category}' | head -60"

# Step 6: Get detailed info on a specific template
demo_step 6 \
  "Get detailed information on create-test template" \
  "cd repos/minibob && bun run index.ts doctor surface 'create-test' --format-json 2>/dev/null | jq '.[0] | {id, name, description, tasks: (.tasks | length)}'"

# Step 7: Show template variables
demo_step 7 \
  "Show variables accepted by create-test template" \
  "cd repos/minibob && bun run index.ts doctor surface 'create-test' --format-json 2>/dev/null | jq '.[0].tasks[] | {id, prompt_variables: .prompt.variables}'"

echo -e "${GREEN}=== Demonstration Complete ===${NC}\n"

echo "Next steps:"
echo "1. Execute a goal with MiniBob:"
echo "   minibob --single 'create tests for src/calculator.ts'"
echo ""
echo "2. Use interactive REPL mode:"
echo "   minibob"
echo "   > create tests for my auth module"
echo "   > /teach  # provide positive feedback"
echo ""
echo "3. Register more templates:"
echo "   minibob doctor tutor repos/metabob-proto/activities/my-template.json"
echo ""
echo "4. Monitor learning progress:"
echo "   # Watch Thompson Sampling confidence scores improve over time"
echo "   minibob doctor surface --goal 'your goal' --verbose"
echo ""

echo -e "${BLUE}See USING_REGISTERED_ACTIVITIES.md for complete documentation${NC}"
