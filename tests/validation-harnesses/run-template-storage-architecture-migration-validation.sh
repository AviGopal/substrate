#!/bin/bash

# Runner script for Template Storage Architecture Migration validation harness
# This script executes the validation harness with all test cases

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_FILE="$SCRIPT_DIR/template-storage-architecture-migration-harness.ts"
TEST_CASES_FILE="/tmp/validation-test-cases.json"

echo "=================================================="
echo "Template Storage Architecture Migration Validation"
echo "=================================================="
echo ""

# Check if harness exists
if [ ! -f "$HARNESS_FILE" ]; then
    echo "❌ Error: Harness file not found at $HARNESS_FILE"
    exit 1
fi

# Check if test cases exist
if [ ! -f "$TEST_CASES_FILE" ]; then
    echo "❌ Error: Test cases file not found at $TEST_CASES_FILE"
    echo "   Please ensure validation test cases are generated first"
    exit 1
fi

echo "📂 Harness file: $HARNESS_FILE"
echo "📂 Test cases: $TEST_CASES_FILE"
echo ""

# Execute harness with Bun
echo "🚀 Executing validation harness..."
echo ""

if bun run "$HARNESS_FILE"; then
    echo ""
    echo "=================================================="
    echo "✅ VALIDATION PASSED"
    echo "=================================================="
    echo ""
    echo "All architectural constraints enforced successfully:"
    echo "  • No local template storage writes"
    echo "  • Backend-only template retrieval via MCP"
    echo "  • Embedded bootstrap templates for cold-start"
    echo "  • No local file writes during registration"
    echo ""
    exit 0
else
    EXIT_CODE=$?
    echo ""
    echo "=================================================="
    echo "❌ VALIDATION FAILED"
    echo "=================================================="
    echo ""
    echo "Exit code: $EXIT_CODE"
    echo ""
    echo "Architectural constraint violations detected."
    echo "Review the output above for details."
    echo ""
    exit $EXIT_CODE
fi
