#!/bin/bash
# Run External E2E Activity Lifecycle Validation Harness
# 
# Usage:
#   ./scripts/run-validation-harness.sh [test-case-id]
#
# Examples:
#   ./scripts/run-validation-harness.sh                    # Run default test
#   ./scripts/run-validation-harness.sh case-1            # Run specific test case
#   ./scripts/run-validation-harness.sh case-2            # Run k8s environment test

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Parse arguments
TEST_CASE_ID="${1:-default}"

echo "========================================"
echo "External E2E Activity Lifecycle Validation"
echo "========================================"
echo "Test Case: $TEST_CASE_ID"
echo ""

# If test case ID provided, load from impulse
if [[ "$TEST_CASE_ID" != "default" ]]; then
  IMPULSE_FILE="impulses/validation-external-e2e-activity-lifecycle-validation-${TEST_CASE_ID}.json"
  
  if [[ ! -f "$IMPULSE_FILE" ]]; then
    echo "❌ Test case not found: $IMPULSE_FILE"
    echo ""
    echo "Available test cases:"
    ls impulses/validation-external-e2e-activity-lifecycle-validation-case-*.json 2>/dev/null | xargs -n 1 basename | sed 's/validation-external-e2e-activity-lifecycle-validation-/  - /' | sed 's/.json//'
    exit 1
  fi
  
  echo "Loading test case from: $IMPULSE_FILE"
  
  # Extract input from impulse and set environment variables
  export SURREAL_URL=$(jq -r '.input.surrealUrl' "$IMPULSE_FILE")
  export SURREAL_USER=$(jq -r '.input.surrealUser' "$IMPULSE_FILE")
  export SURREAL_PASS=$(jq -r '.input.surrealPass' "$IMPULSE_FILE")
  export SURREAL_NS=$(jq -r '.input.surrealNs' "$IMPULSE_FILE")
  export SURREAL_DB=$(jq -r '.input.surrealDb' "$IMPULSE_FILE")
  
  echo "✓ Test case loaded"
fi

echo ""
echo "Running validation harness..."
echo ""

# Run harness
if npx ts-node tests/validation-harnesses/external-e2e-activity-lifecycle-validation-harness.ts; then
  echo ""
  echo "✅ VALIDATION PASSED"
  exit 0
else
  echo ""
  echo "❌ VALIDATION FAILED"
  exit 1
fi
