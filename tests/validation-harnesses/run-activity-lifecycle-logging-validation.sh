#!/bin/bash
# Activity Lifecycle Logging Validation - Shell Runner
# Compiles and executes the TypeScript validation harness

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_FILE="$SCRIPT_DIR/activity-lifecycle-logging-harness.ts"
COMPILED_FILE="$SCRIPT_DIR/activity-lifecycle-logging-harness.js"

echo "=== Activity Lifecycle Logging Validation Runner ==="
echo ""

# Check if TypeScript is installed
if ! command -v tsc &> /dev/null; then
    echo "❌ TypeScript (tsc) not found. Please install: npm install -g typescript"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js"
    exit 1
fi

# Compile TypeScript harness
echo "Step 1: Compiling TypeScript harness..."
tsc "$HARNESS_FILE" --lib es2015,es2017 --target es2015 --module commonjs --esModuleInterop

if [ ! -f "$COMPILED_FILE" ]; then
    echo "❌ Compilation failed - output file not found"
    exit 1
fi

echo "✅ Compilation successful"
echo ""

# Run the validation
echo "Step 2: Running validation harness..."
echo ""

# Pass environment variables
export DEVBOB_POD="${DEVBOB_POD:-devbob-794b69b4f4-rhnwg}"
export DEVBOB_NAMESPACE="${DEVBOB_NAMESPACE:-metabob}"
export TEMPLATE_ID="${TEMPLATE_ID:-simple-file-analysis}"

node "$COMPILED_FILE"
EXIT_CODE=$?

echo ""
echo "=== Validation Complete ==="
echo "Exit code: $EXIT_CODE"

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ VALIDATION PASSED"
else
    echo "❌ VALIDATION FAILED"
fi

exit $EXIT_CODE
