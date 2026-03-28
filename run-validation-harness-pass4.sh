#!/bin/bash

# Validation Harness Runner for Pass 4
# Executes the Pass 4 validation harness and captures results

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_FILE="$SCRIPT_DIR/tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass4-harness.ts"
RESULTS_FILE="$SCRIPT_DIR/validation-results-pass4-$(date +%s%3N).json"

echo "🧪 Running Pass 4 Validation Harness..."
echo "   Harness: $HARNESS_FILE"
echo "   Results: $RESULTS_FILE"
echo ""

# Check prerequisites
if ! command -v tsx &> /dev/null; then
    echo "❌ Error: tsx not found. Install with: npm install -g tsx"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "⚠️  Warning: kubectl not found. K8s tests will be skipped."
fi

# Run the harness
echo "Running validation tests..."
if tsx "$HARNESS_FILE" > "$RESULTS_FILE"; then
    echo "✅ Validation harness completed successfully"
    echo ""
    echo "📊 Results saved to: $RESULTS_FILE"
    echo ""
    
    # Show summary
    if command -v jq &> /dev/null; then
        echo "Summary:"
        jq -r '.pass as $pass | .errors | length as $errorCount | if $pass then "  ✅ ALL TESTS PASSED" else "  ❌ \($errorCount) TESTS FAILED" end' "$RESULTS_FILE"
        echo ""
        jq -r '.errors[] | "  - \(.)"' "$RESULTS_FILE" 2>/dev/null || true
    else
        cat "$RESULTS_FILE"
    fi
    
    # Return exit code based on pass/fail
    if jq -e '.pass == true' "$RESULTS_FILE" > /dev/null 2>&1; then
        exit 0
    else
        exit 1
    fi
else
    echo "❌ Validation harness failed with error"
    echo ""
    echo "Results (if any):"
    cat "$RESULTS_FILE" 2>/dev/null || echo "No results file generated"
    exit 1
fi
