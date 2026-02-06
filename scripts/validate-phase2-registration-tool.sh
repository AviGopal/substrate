#!/bin/bash
# Validation Script for Phase 2: register_activity_template Tool
# This script validates the tool creation and tests registration functionality

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Phase 2 Validation: register_activity_template Tool"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify tool file exists
echo "Step 1: Verifying tool file exists..."

TOOL_FILE="$PROJECT_ROOT/repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts"

if [ ! -f "$TOOL_FILE" ]; then
    echo -e "${RED}✗ Tool file not found: $TOOL_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tool file exists: register-activity-template.ts${NC}"
echo ""

# Step 2: Verify tool is exported
echo "Step 2: Verifying tool is exported in index.ts..."

TOOL_INDEX="$PROJECT_ROOT/repos/metabob-opencode/packages/opencode/src/tool/registry.ts"

if ! grep -q "RegisterActivityTemplateTool" "$TOOL_INDEX"; then
    echo -e "${RED}✗ Tool not found in registry.ts${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tool registered in registry.ts${NC}"
echo ""

# Step 3: Check TypeScript compilation
echo "Step 3: Checking TypeScript compilation..."
cd "$PROJECT_ROOT/repos/metabob-opencode"

# Try to build
npm run build > /tmp/phase2-build.log 2>&1 || {
    echo -e "${RED}✗ TypeScript compilation failed${NC}"
    echo "Build log:"
    cat /tmp/phase2-build.log | tail -50
    exit 1
}

echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
echo ""

# Step 4: Create test templates
echo "Step 4: Creating test templates..."

# Create a minimal valid template
VALID_TEMPLATE="$PROJECT_ROOT/test-valid-template.json"
cat > "$VALID_TEMPLATE" << 'EOF'
{
  "id": "test-minimal-valid",
  "name": "Test Minimal Valid Template",
  "version": 1,
  "category": "test",
  "description": "Minimal valid template for testing registration",
  "tasks": [
    {
      "id": "hello",
      "subagent": "general",
      "description": "Say hello",
      "dependencies": [],
      "prompt": {
        "template": "Say hello world",
        "maxTokens": 1000
      },
      "validation": {},
      "retry": {
        "maxAttempts": 1,
        "strategy": "simple"
      }
    }
  ]
}
EOF

echo -e "${GREEN}✓ Created valid test template: $VALID_TEMPLATE${NC}"

# Create an invalid template (missing required fields)
INVALID_TEMPLATE="$PROJECT_ROOT/test-invalid-template.json"
cat > "$INVALID_TEMPLATE" << 'EOF'
{
  "name": "Invalid Template",
  "category": "test"
}
EOF

echo -e "${GREEN}✓ Created invalid test template: $INVALID_TEMPLATE${NC}"
echo ""

# Step 5: Verify tool schema validation
echo "Step 5: Verifying tool implementation..."

# Check for key features in the tool file
if ! grep -q "ActivityTemplate.Schema.safeParse" "$TOOL_FILE"; then
    echo -e "${RED}✗ Tool does not use schema validation${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tool uses ActivityTemplate.Schema validation${NC}"

if ! grep -q "TemplateRepository.save" "$TOOL_FILE"; then
    echo -e "${RED}✗ Tool does not save to TemplateRepository${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tool saves to TemplateRepository${NC}"

if ! grep -q "validate_only" "$TOOL_FILE"; then
    echo -e "${RED}✗ Tool does not support validate_only mode${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tool supports validate_only mode${NC}"

echo ""

# Step 6: Create a Node.js test script to test the tool
echo "Step 6: Creating runtime test script..."

TEST_SCRIPT="$PROJECT_ROOT/test-registration-tool.js"
cat > "$TEST_SCRIPT" << 'EOFJS'
// Runtime test for register_activity_template tool
const path = require('path');

async function testRegistrationTool() {
  console.log('Testing register_activity_template tool...\n');
  
  try {
    // Import the tool
    const toolPath = path.join(__dirname, 'repos/metabob-opencode/packages/opencode/dist/tool/register-activity-template.js');
    console.log('Importing tool from:', toolPath);
    
    const { RegisterActivityTemplateTool } = require(toolPath);
    
    if (!RegisterActivityTemplateTool) {
      console.error('✗ Tool export not found');
      process.exit(1);
    }
    console.log('✓ Tool imported successfully\n');
    
    // Check tool structure
    if (!RegisterActivityTemplateTool.name) {
      console.error('✗ Tool missing name');
      process.exit(1);
    }
    console.log('✓ Tool name:', RegisterActivityTemplateTool.name);
    
    if (!RegisterActivityTemplateTool.description) {
      console.error('✗ Tool missing description');
      process.exit(1);
    }
    console.log('✓ Tool has description');
    
    if (!RegisterActivityTemplateTool.schema) {
      console.error('✗ Tool missing schema');
      process.exit(1);
    }
    console.log('✓ Tool has schema');
    
    if (typeof RegisterActivityTemplateTool.fn !== 'function') {
      console.error('✗ Tool fn is not a function');
      process.exit(1);
    }
    console.log('✓ Tool has fn function\n');
    
    // Test validate_only with valid template
    console.log('Testing validate_only with valid template...');
    const validResult = await RegisterActivityTemplateTool.fn({
      file_path: path.join(__dirname, 'test-valid-template.json'),
      validate_only: true
    }, {});
    
    if (!validResult.success) {
      console.error('✗ Valid template validation failed:', validResult);
      process.exit(1);
    }
    console.log('✓ Valid template passed validation');
    console.log('  Template ID:', validResult.template_id);
    console.log('  Template name:', validResult.template_name);
    console.log('  Task count:', validResult.task_count);
    console.log('');
    
    // Test validate_only with invalid template
    console.log('Testing validate_only with invalid template...');
    const invalidResult = await RegisterActivityTemplateTool.fn({
      file_path: path.join(__dirname, 'test-invalid-template.json'),
      validate_only: true
    }, {});
    
    if (invalidResult.success) {
      console.error('✗ Invalid template should have failed validation');
      process.exit(1);
    }
    console.log('✓ Invalid template correctly rejected');
    console.log('  Error:', invalidResult.error);
    console.log('  Validation errors:', invalidResult.validation_errors?.length || 0);
    console.log('');
    
    // Test file not found
    console.log('Testing with non-existent file...');
    const notFoundResult = await RegisterActivityTemplateTool.fn({
      file_path: '/tmp/does-not-exist.json',
      validate_only: true
    }, {});
    
    if (notFoundResult.success) {
      console.error('✗ Non-existent file should have failed');
      process.exit(1);
    }
    console.log('✓ Non-existent file correctly rejected');
    console.log('  Error:', notFoundResult.error);
    console.log('');
    
    console.log('========================================');
    console.log('All runtime tests passed! ✓');
    console.log('========================================');
    
  } catch (error) {
    console.error('✗ Runtime test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRegistrationTool();
EOFJS

echo -e "${GREEN}✓ Created runtime test script${NC}"
echo ""

# Step 7: Run the runtime test
echo "Step 7: Running runtime tests..."
cd "$PROJECT_ROOT"

if ! node "$TEST_SCRIPT"; then
    echo -e "${RED}✗ Runtime tests failed${NC}"
    exit 1
fi

echo ""

# Step 8: Summary
echo "=========================================="
echo "Phase 2 Validation Summary"
echo "=========================================="
echo -e "${GREEN}✓ Tool file created: register-activity-template.ts${NC}"
echo -e "${GREEN}✓ Tool exported and registered${NC}"
echo -e "${GREEN}✓ TypeScript compilation successful${NC}"
echo -e "${GREEN}✓ Tool implementation verified${NC}"
echo -e "${GREEN}✓ Runtime tests passed${NC}"
echo "  - Valid template validation works"
echo "  - Invalid template correctly rejected"
echo "  - File not found handled correctly"
echo ""
echo -e "${GREEN}Phase 2 validation PASSED${NC}"
echo ""
echo "Test templates created:"
echo "  - $VALID_TEMPLATE"
echo "  - $INVALID_TEMPLATE"
echo ""
echo "Next steps:"
echo "  - Tool is ready for use by agents"
echo "  - Can be called via: register_activity_template({ file_path: '...', validate_only: false })"
echo "  - Validates templates against ActivityTemplate.Schema"
echo "  - Registers templates to TemplateRepository"
echo ""

exit 0
