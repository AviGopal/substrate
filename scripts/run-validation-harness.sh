#!/bin/bash
# Runner script for DevBob validation harness
# This script can be executed inside the DevBob container

set -e

HARNESS_FILE="/workspace/tests/validation-harnesses/devbob-independent-execution-validation-harness.ts"
OUTPUT_FILE="/tmp/validation-results.json"

echo "==================================================================="
echo "Running DevBob Independent Execution Validation Harness"
echo "==================================================================="
echo ""

if [ ! -f "$HARNESS_FILE" ]; then
    echo "ERROR: Harness file not found: $HARNESS_FILE"
    echo "Please ensure the validation harness is copied to the pod."
    exit 1
fi

echo "Executing validation harness..."
echo ""

# Run the harness with bun
cd /workspace
bun run "$HARNESS_FILE"

EXIT_CODE=$?

echo ""
echo "==================================================================="
echo "Validation Results"
echo "==================================================================="
echo ""

if [ -f "$OUTPUT_FILE" ]; then
    echo "Results written to: $OUTPUT_FILE"
    echo ""
    cat "$OUTPUT_FILE" | bun run -e "import {readFileSync} from 'fs'; const data = JSON.parse(readFileSync('/dev/stdin', 'utf-8')); console.log('Overall:', data.overallPass ? 'PASS ✓' : 'FAIL ✗'); console.log('Passed:', data.summary.passed + '/' + data.summary.total);"
    echo ""
else
    echo "ERROR: Results file not found at $OUTPUT_FILE"
    exit 1
fi

exit $EXIT_CODE
