#!/bin/bash
# Test validation fix

set -e

echo "========================================="
echo "Testing Validation Fix"
echo "========================================="
echo ""

# Test 1: Create a file that PASSES validation
echo "Test 1: File with all required patterns (SHOULD PASS)"
echo "Creating test file..."

cat > /tmp/test-validation-pass.md << 'EOF'
# Test Activity

## Workflow Steps
1. Step 1
2. Step 2

## Input Variables
- var1: description
- var2: description

## Validation Criteria
- Check 1
- Check 2
EOF

echo "File created at /tmp/test-validation-pass.md"
echo "Content:"
cat /tmp/test-validation-pass.md
echo ""

# Test 2: Create a file that FAILS validation (missing pattern)
echo "Test 2: File missing required pattern (SHOULD FAIL)"
echo "Creating test file..."

cat > /tmp/test-validation-fail.md << 'EOF'
# Test Activity

## Workflow Steps
1. Step 1
2. Step 2

## Input Variables
- var1: description
- var2: description

# Missing "## Validation Criteria" section
EOF

echo "File created at /tmp/test-validation-fail.md"
echo "Content:"
cat /tmp/test-validation-fail.md
echo ""

echo "========================================="
echo "Manual Testing Required:"
echo "========================================="
echo ""
echo "1. Restart dev server:"
echo "   cd repos/metabob-opencode && pkill -f 'bun run dev' && bun run dev ../.."
echo ""
echo "2. Test passing validation:"
echo "   - Modify create-activity-self-contained template to use /tmp/test-validation-pass.md"
echo "   - Run activity"
echo "   - Should complete successfully"
echo ""
echo "3. Test failing validation:"
echo "   - Modify template to use /tmp/test-validation-fail.md"
echo "   - Run activity"
echo "   - Should throw: 'Validation failed: Required patterns not found'"
echo ""
echo "4. Test missing file:"
echo "   - Modify template to require /tmp/nonexistent.md"
echo "   - Run activity"
echo "   - Should throw: 'Validation failed: Required files not found'"
echo ""
