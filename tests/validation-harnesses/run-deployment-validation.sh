#!/bin/bash
#
# Quick runner script for deployment-vessel-job-management validation harness
#
# Usage:
#   ./run-deployment-validation.sh
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#   2 - Harness execution error

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=================================================="
echo "Deployment Vessel Job Management Validation"
echo "=================================================="
echo ""
echo "Project root: $PROJECT_ROOT"
echo "Harness: deployment-vessel-job-management-harness.ts"
echo ""

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx not found. Please install Node.js and npm."
    exit 2
fi

# Check if harness file exists
HARNESS_FILE="$SCRIPT_DIR/deployment-vessel-job-management-harness.ts"
if [ ! -f "$HARNESS_FILE" ]; then
    echo "❌ Error: Harness file not found: $HARNESS_FILE"
    exit 2
fi

echo "Running validation harness..."
echo ""

# Run the harness
cd "$PROJECT_ROOT"
if npx ts-node "$HARNESS_FILE"; then
    echo ""
    echo "=================================================="
    echo "✅ Validation PASSED"
    echo "=================================================="
    exit 0
else
    EXIT_CODE=$?
    echo ""
    echo "=================================================="
    echo "❌ Validation FAILED (exit code: $EXIT_CODE)"
    echo "=================================================="
    exit 1
fi
