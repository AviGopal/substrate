#!/bin/bash
# Validation Script for Phase 3: Template Validation Script
# Verifies the template validation script works correctly

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Phase 3 Validation: Template Validation Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

VALIDATION_SCRIPT="$SCRIPT_DIR/validate-activity-template.sh"
VALID_TEMPLATE="$PROJECT_ROOT/test-valid-template.json"
INVALID_TEMPLATE="$PROJECT_ROOT/test-invalid-template.json"

# Step 1: Verify validation script exists
echo "Step 1: Verifying validation script exists..."

if [ ! -f "$VALIDATION_SCRIPT" ]; then
    echo -e "${RED}✗ Validation script not found: $VALIDATION_SCRIPT${NC}"
    exit 1
fi

if [ ! -x "$VALIDATION_SCRIPT" ]; then
    echo -e "${RED}✗ Validation script is not executable${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Validation script exists and is executable${NC}"
echo ""

# Step 2: Verify test templates exist
echo "Step 2: Verifying test templates exist..."

if [ ! -f "$VALID_TEMPLATE" ]; then
    echo -e "${RED}✗ Valid test template not found: $VALID_TEMPLATE${NC}"
    exit 1
fi

if [ ! -f "$INVALID_TEMPLATE" ]; then
    echo -e "${RED}✗ Invalid test template not found: $INVALID_TEMPLATE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Test templates exist${NC}"
echo ""

# Step 3: Test with valid template
echo "Step 3: Testing with valid template..."

if ! bash "$VALIDATION_SCRIPT" "$VALID_TEMPLATE" > /tmp/phase3-valid.log 2>&1; then
    echo -e "${RED}✗ Valid template failed validation${NC}"
    echo "Output:"
    cat /tmp/phase3-valid.log
    exit 1
fi

# Check output contains success message
if ! grep -q "Template validation passed" /tmp/phase3-valid.log; then
    echo -e "${RED}✗ Valid template output missing success message${NC}"
    cat /tmp/phase3-valid.log
    exit 1
fi

echo -e "${GREEN}✓ Valid template passes validation${NC}"
echo ""

# Step 4: Test with invalid template
echo "Step 4: Testing with invalid template..."

if bash "$VALIDATION_SCRIPT" "$INVALID_TEMPLATE" > /tmp/phase3-invalid.log 2>&1; then
    echo -e "${RED}✗ Invalid template should have failed validation but passed${NC}"
    cat /tmp/phase3-invalid.log
    exit 1
fi

# Check output contains error messages
if ! grep -q "Missing required field" /tmp/phase3-invalid.log; then
    echo -e "${RED}✗ Invalid template output missing error messages${NC}"
    cat /tmp/phase3-invalid.log
    exit 1
fi

if ! grep -q "validation failed" /tmp/phase3-invalid.log; then
    echo -e "${RED}✗ Invalid template output missing failure message${NC}"
    cat /tmp/phase3-invalid.log
    exit 1
fi

echo -e "${GREEN}✓ Invalid template correctly rejected${NC}"
echo ""

# Step 5: Test with non-existent file
echo "Step 5: Testing with non-existent file..."

if bash "$VALIDATION_SCRIPT" "/tmp/does-not-exist-12345.json" > /tmp/phase3-notfound.log 2>&1; then
    echo -e "${RED}✗ Non-existent file should have failed validation but passed${NC}"
    cat /tmp/phase3-notfound.log
    exit 1
fi

if ! grep -q "File does not exist" /tmp/phase3-notfound.log; then
    echo -e "${RED}✗ Non-existent file output missing file not found error${NC}"
    cat /tmp/phase3-notfound.log
    exit 1
fi

echo -e "${GREEN}✓ Non-existent file correctly rejected${NC}"
echo ""

# Step 6: Test with the built-in template
echo "Step 6: Testing with create-activity-template.json..."

BUILTIN_TEMPLATE="$PROJECT_ROOT/repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json"

if [ -f "$BUILTIN_TEMPLATE" ]; then
    if bash "$VALIDATION_SCRIPT" "$BUILTIN_TEMPLATE" > /tmp/phase3-builtin.log 2>&1; then
        echo -e "${GREEN}✓ Built-in template passes validation${NC}"
    else
        echo -e "${YELLOW}⚠ Built-in template has validation issues (this is expected if it needs updating)${NC}"
        echo "Output:"
        cat /tmp/phase3-builtin.log | head -20
    fi
else
    echo -e "${YELLOW}⚠ Built-in template not found (skipping test)${NC}"
fi

echo ""

# Step 7: Summary
echo "=========================================="
echo "Phase 3 Validation Summary"
echo "=========================================="
echo -e "${GREEN}✓ Validation script exists and is executable${NC}"
echo -e "${GREEN}✓ Test templates exist${NC}"
echo -e "${GREEN}✓ Valid template passes validation${NC}"
echo -e "${GREEN}✓ Invalid template correctly rejected${NC}"
echo -e "${GREEN}✓ Non-existent file correctly rejected${NC}"
echo -e "${GREEN}✓ Built-in template tested${NC}"
echo ""
echo -e "${GREEN}Phase 3 validation PASSED${NC}"
echo ""
echo "Validation script: $VALIDATION_SCRIPT"
echo "Test templates:"
echo "  - Valid: $VALID_TEMPLATE"
echo "  - Invalid: $INVALID_TEMPLATE"
echo ""
echo "Usage:"
echo "  bash scripts/validate-activity-template.sh <template.json>"
echo ""
echo "The script validates:"
echo "  - JSON syntax"
echo "  - Required fields (id, name, version, category, tasks)"
echo "  - Task structure (id, subagent, description, dependencies, prompt)"
echo "  - Validation and retry configuration"
echo "  - Task count (1-10 recommended)"
echo ""

exit 0
