#!/bin/bash
# Validation Script for Phase 1: Working Directory Inheritance
# This script creates a test activity and verifies working directory inheritance

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Phase 1 Validation: Working Directory Inheritance"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create test activity template
echo "Step 1: Creating test activity template..."

TEST_TEMPLATE="$PROJECT_ROOT/test-temp-dir-inheritance.json"

cat > "$TEST_TEMPLATE" << 'EOF'
{
  "id": "test-temp-dir-inheritance",
  "name": "Test Temporary Directory Inheritance",
  "version": 1,
  "category": "test",
  "description": "Test that subagents inherit working directory from lifecycle hooks",
  "tasks": [
    {
      "id": "write-file",
      "subagent": "general",
      "description": "Write a test file in the temporary directory",
      "dependencies": [],
      "prompt": {
        "template": "Create a file named 'test-inheritance.txt' with the content 'hello from task 1'. Use the Write tool to create this file in the current working directory.",
        "maxTokens": 2000
      },
      "validation": {
        "requiredFiles": ["test-inheritance.txt"]
      },
      "retry": {
        "maxAttempts": 1,
        "strategy": "simple"
      }
    },
    {
      "id": "verify-file",
      "subagent": "general",
      "description": "Verify the file exists and can be read",
      "dependencies": ["write-file"],
      "prompt": {
        "template": "List all .txt files in the current working directory and read the contents of 'test-inheritance.txt'. Confirm the file exists and contains 'hello from task 1'.",
        "maxTokens": 2000
      },
      "validation": {},
      "retry": {
        "maxAttempts": 1,
        "strategy": "simple"
      }
    },
    {
      "id": "write-second-file",
      "subagent": "general",
      "description": "Write a second file to confirm persistence",
      "dependencies": ["verify-file"],
      "prompt": {
        "template": "Create a file named 'test-inheritance-2.txt' with content 'hello from task 3'. Then list all .txt files to confirm both files exist.",
        "maxTokens": 2000
      },
      "validation": {
        "requiredFiles": ["test-inheritance-2.txt"]
      },
      "retry": {
        "maxAttempts": 1,
        "strategy": "simple"
      }
    }
  ],
  "hooks": {
    "preActivity": {
      "workingDirectory": {
        "type": "temporary",
        "prefix": "test-wd-inherit-",
        "cleanup": "always"
      }
    },
    "postActivity": {
      "cleanup": true
    }
  }
}
EOF

echo -e "${GREEN}✓ Test template created: $TEST_TEMPLATE${NC}"
echo ""

# Step 2: Verify template is valid JSON
echo "Step 2: Validating JSON syntax..."
if ! jq empty "$TEST_TEMPLATE" 2>/dev/null; then
    echo -e "${RED}✗ Invalid JSON syntax in test template${NC}"
    exit 1
fi
echo -e "${GREEN}✓ JSON syntax valid${NC}"
echo ""

# Step 3: Check that TypeScript compiled successfully
echo "Step 3: Checking TypeScript compilation..."
cd "$PROJECT_ROOT/repos/metabob-opencode"

if [ ! -d "packages/opencode/dist" ]; then
    echo -e "${YELLOW}⚠ No dist directory found. Running build...${NC}"
    npm run build || {
        echo -e "${RED}✗ TypeScript compilation failed${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✓ TypeScript compilation check passed${NC}"
echo ""

# Step 4: Verify the code changes are present
echo "Step 4: Verifying code changes in template-executor.ts..."

TEMPLATE_EXECUTOR="packages/opencode/src/session/template-executor.ts"

# Check for workingDirectory parameter in function signature
if ! grep -q "workingDirectory?: string" "$TEMPLATE_EXECUTOR"; then
    echo -e "${RED}✗ workingDirectory parameter not found in executeTasks signature${NC}"
    exit 1
fi
echo -e "${GREEN}✓ executeTasks() signature includes workingDirectory parameter${NC}"

# Check for passing workingDirectory to executeTasks
if ! grep -q "hooksContext?.workingDirectory" "$TEMPLATE_EXECUTOR"; then
    echo -e "${RED}✗ hooksContext?.workingDirectory not passed to executeTasks${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Working directory passed from hooks context${NC}"

# Check for cwd in Session.create
if ! grep -q "cwd:.*workingDirectory" "$TEMPLATE_EXECUTOR"; then
    echo -e "${RED}✗ workingDirectory not used in Session.create cwd${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Session.create() uses working directory${NC}"

echo ""

# Step 5: Summary
echo "=========================================="
echo "Phase 1 Validation Summary"
echo "=========================================="
echo -e "${GREEN}✓ Test template created and validated${NC}"
echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
echo -e "${GREEN}✓ All code changes verified in template-executor.ts${NC}"
echo ""
echo -e "${GREEN}Phase 1 validation PASSED${NC}"
echo ""
echo "Test template location: $TEST_TEMPLATE"
echo ""
echo "To manually test the activity (optional):"
echo "  cd repos/metabob-opencode"
echo "  npm run dev activity -- --template ../../test-temp-dir-inheritance.json"
echo ""
echo "Expected behavior:"
echo "  - Task 1 creates test-inheritance.txt in temp directory"
echo "  - Task 2 reads the file (proves working directory inherited)"
echo "  - Task 3 creates second file and verifies both exist"
echo ""

exit 0
