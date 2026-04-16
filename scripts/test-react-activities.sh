#!/bin/bash
#
# Test React Activity Templates
#
# This script executes each React activity template once to verify they work correctly.
# Run this after creating new activities or making changes to existing ones.
#

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ACTIVITIES_DIR="$PROJECT_ROOT/repos/metabob-proto/activities/react"
TEST_OUTPUT_DIR="/tmp/react-activities-test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}React Activity Templates - Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if minibob is installed
if ! command -v minibob &> /dev/null; then
    echo -e "${RED}Error: minibob not found in PATH${NC}"
    echo "Please install minibob first: npm install -g minibob"
    exit 1
fi

# Validate all activity JSON files
echo -e "${YELLOW}Step 1: Validating JSON structure...${NC}"
echo ""

for activity_file in "$ACTIVITIES_DIR"/*.json; do
    if [ -f "$activity_file" ]; then
        filename=$(basename "$activity_file")
        echo -n "Validating $filename... "

        if jq empty "$activity_file" 2>/dev/null; then
            activity_id=$(jq -r '.activity_id' "$activity_file")
            task_count=$(jq -r '.tasks | length' "$activity_file")
            echo -e "${GREEN}✓ Valid${NC} ($activity_id, $task_count tasks)"
        else
            echo -e "${RED}✗ Invalid JSON${NC}"
            exit 1
        fi
    fi
done

echo ""
echo -e "${GREEN}All JSON files validated successfully!${NC}"
echo ""

# Create test output directory
mkdir -p "$TEST_OUTPUT_DIR"

echo -e "${YELLOW}Step 2: Test activity executions...${NC}"
echo ""
echo -e "${BLUE}Note: This will execute each activity once with test data.${NC}"
echo -e "${BLUE}Activities will create files in: $TEST_OUTPUT_DIR${NC}"
echo ""

# Test 1: Component Creation
echo -e "${YELLOW}Test 1/5: Component Creation${NC}"
echo "Goal: Create a simple Button component"
echo ""

minibob --single "Create a Button component with variants (primary, secondary) and sizes (small, medium, large). Output to $TEST_OUTPUT_DIR/test-button" || {
    echo -e "${RED}✗ Component creation test failed${NC}"
    exit 1
}

echo -e "${GREEN}✓ Component creation test passed${NC}"
echo ""

# Test 2: App Scaffolding
echo -e "${YELLOW}Test 2/5: App Scaffolding${NC}"
echo "Goal: Create a test React application"
echo ""

minibob --single "Create a new React app called 'test-app' with Vite, routing, and TypeScript. Output to $TEST_OUTPUT_DIR/test-app" || {
    echo -e "${RED}✗ App scaffolding test failed${NC}"
    exit 1
}

echo -e "${GREEN}✓ App scaffolding test passed${NC}"
echo ""

# Test 3: UI Integration
echo -e "${YELLOW}Test 3/5: UI Integration${NC}"
echo "Goal: Create integration components"
echo ""

minibob --single "Create a UserProfile feature integration with mock API data. Include custom hooks and container/view separation. Output to $TEST_OUTPUT_DIR/test-integration" || {
    echo -e "${RED}✗ UI integration test failed${NC}"
    exit 1
}

echo -e "${GREEN}✓ UI integration test passed${NC}"
echo ""

# Test 4: Styling
echo -e "${YELLOW}Test 4/5: Styling${NC}"
echo "Goal: Style a component with CSS Modules"
echo ""

# First create a component to style
minibob --single "Create a Card component at $TEST_OUTPUT_DIR/test-card, then style it with CSS Modules using design tokens" || {
    echo -e "${RED}✗ Styling test failed${NC}"
    exit 1
}

echo -e "${GREEN}✓ Styling test passed${NC}"
echo ""

# Test 5: Full-Stack (Light version - just architecture)
echo -e "${YELLOW}Test 5/5: Full-Stack Architecture${NC}"
echo "Goal: Create application architecture plan"
echo ""

minibob --single "Plan the architecture for a simple todo app with authentication and CRUD operations. Create ARCHITECTURE.md at $TEST_OUTPUT_DIR/test-fullstack" || {
    echo -e "${RED}✗ Full-stack test failed${NC}"
    exit 1
}

echo -e "${GREEN}✓ Full-stack test passed${NC}"
echo ""

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All tests passed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Test output files created in: $TEST_OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Review generated files in $TEST_OUTPUT_DIR"
echo "2. Check activity dashboard for execution traces"
echo "3. Monitor Thompson Sampling metrics"
echo "4. Refine templates based on results"
echo ""
echo "To clean up test files:"
echo "  rm -rf $TEST_OUTPUT_DIR"
echo ""
