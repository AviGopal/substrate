#!/usr/bin/env bash
#
# Verify Rapid Validation Setup
#
# Checks that all required files exist and have correct permissions
#

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Verifying rapid validation setup..."
echo ""

# Check files
FILES=(
    "rapid-test.ts"
    "trace-pipeline.ts"
    "validation-metrics.ts"
    "auto-validate.sh"
    "VALIDATION_WORKFLOW.md"
    "example-goals.json"
    "sandbox.config.json"
)

echo "Checking files..."
for file in "${FILES[@]}"; do
    if [ -f "$SCRIPT_DIR/$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
        exit 1
    fi
done
echo ""

# Check executables
EXECUTABLES=(
    "rapid-test.ts"
    "trace-pipeline.ts"
    "validation-metrics.ts"
    "auto-validate.sh"
)

echo "Checking executables..."
for file in "${EXECUTABLES[@]}"; do
    if [ -x "$SCRIPT_DIR/$file" ]; then
        echo -e "${GREEN}✓${NC} $file (executable)"
    else
        echo -e "${RED}✗${NC} $file (not executable)"
        exit 1
    fi
done
echo ""

# Check TypeScript syntax (basic check - imports may fail without actual execution)
echo "Checking TypeScript file structure..."
for file in rapid-test.ts trace-pipeline.ts validation-metrics.ts; do
    if grep -q "#!/usr/bin/env bun" "$SCRIPT_DIR/$file" && grep -q "import" "$SCRIPT_DIR/$file"; then
        echo -e "${GREEN}✓${NC} $file (structure valid)"
    else
        echo -e "${RED}✗${NC} $file (invalid structure)"
        exit 1
    fi
done
echo ""

# Check JSON files
echo "Checking JSON files..."
for file in example-goals.json sandbox.config.json; do
    if jq . "$SCRIPT_DIR/$file" &>/dev/null; then
        echo -e "${GREEN}✓${NC} $file (valid JSON)"
    else
        echo -e "${RED}✗${NC} $file (invalid JSON)"
        exit 1
    fi
done
echo ""

echo -e "${GREEN}All checks passed!${NC}"
echo ""
echo "Next steps:"
echo "  1. Set environment variables (METABOB_API_KEY, ANTHROPIC_API_KEY)"
echo "  2. Run setup: ./sandbox/setup.sh"
echo "  3. Run quick test: bun sandbox/rapid-test.ts --scenario simple"
echo "  4. Run full validation: ./sandbox/auto-validate.sh"
echo ""
