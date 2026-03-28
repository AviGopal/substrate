#!/bin/bash
# Run validation test case 1: Basic Activity Execution

set -e

echo "🧪 Running Validation Test Case 1: Basic Activity Execution"
echo "============================================================"

# Test input from impulse
ACTIVITY_ID="trace-data-flow-single-feature"
VARIABLES='{"featureName": "user-authentication", "entryPoint": "src/auth/login.ts"}'

# Run harness
bun run tests/validation-harnesses/activity-template-mcp-only-flow-harness.ts "$ACTIVITY_ID" "$VARIABLES"

exit $?
