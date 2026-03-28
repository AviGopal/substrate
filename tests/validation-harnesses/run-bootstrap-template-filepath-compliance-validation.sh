#!/bin/bash
# Runner script for bootstrap-template-filepath-compliance validation harness

set -e

echo "========================================="
echo "Bootstrap Template Filepath Compliance"
echo "Validation Harness"
echo "========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_FILE="$SCRIPT_DIR/bootstrap-template-filepath-compliance-harness.ts"
RESULTS_FILE="$SCRIPT_DIR/validation-results-bootstrap-template-filepath-compliance.json"

if [ ! -f "$HARNESS_FILE" ]; then
  echo "❌ Error: Harness file not found: $HARNESS_FILE"
  exit 1
fi

echo "Running validation harness..."
echo "Harness: $HARNESS_FILE"
echo ""

# Run the harness and capture output
if bun run "$HARNESS_FILE"; then
  echo ""
  echo "========================================="
  echo "✅ VALIDATION PASSED"
  echo "========================================="
  exit 0
else
  EXIT_CODE=$?
  echo ""
  echo "========================================="
  echo "❌ VALIDATION FAILED (exit code: $EXIT_CODE)"
  echo "========================================="
  exit $EXIT_CODE
fi
