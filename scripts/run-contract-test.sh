#!/usr/bin/env bash
#
# run-contract-test.sh - Execute contract enforcement activity
#
# Purpose: Rapid iteration on contract validation
# Backend: Uses production activity.metabob.com
# Approach: MiniBob executes contract activity, stores trace, reports result
#
# Usage:
#   ./run-contract-test.sh --spec SPEC_PATH --impl IMPL_PATH
#   ./run-contract-test.sh --activity ACTIVITY_ID --spec SPEC_PATH --impl IMPL_PATH
#   ./run-contract-test.sh --spec SPEC_PATH --impl IMPL_PATH --verify-expected EXPECTED_JSON

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
MINIBOB_PATH="${REPO_ROOT}/repos/minibob"

# Production backend (not local)
METABOB_ENDPOINT="${METABOB_ENDPOINT:-https://activity.metabob.com}"

# API key from environment or user config
if [[ -z "${METABOB_API_KEY:-}" ]]; then
  if [[ -f ~/.metabob/config.json ]]; then
    METABOB_API_KEY=$(jq -r '.metabob.apiKey // .instance.apiKey' ~/.metabob/config.json)
  fi
fi

if [[ -z "${METABOB_API_KEY:-}" ]]; then
  echo "❌ Error: METABOB_API_KEY not set"
  echo "   Set via environment variable or ~/.metabob/config.json"
  exit 1
fi

# ==============================================================================
# Parse Arguments
# ==============================================================================

SPEC_PATH=""
IMPL_PATH=""
ACTIVITY_ID="validate-spec-compliance"  # Default activity
VERIFY_EXPECTED=""
OUTPUT_PATH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --spec)
      SPEC_PATH="$2"
      shift 2
      ;;
    --impl)
      IMPL_PATH="$2"
      shift 2
      ;;
    --activity)
      ACTIVITY_ID="$2"
      shift 2
      ;;
    --verify-expected)
      VERIFY_EXPECTED="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Usage: $0 [OPTIONS]

Execute contract enforcement activity and collect traces.

Options:
  --spec PATH             Path to OpenSpec specification (required)
  --impl PATH             Path to implementation under test (required)
  --activity ID           Activity template ID (default: validate-spec-compliance)
  --verify-expected PATH  Compare result against expected JSON
  --output PATH           Save compliance report to file
  -h, --help              Show this help

Examples:
  # Basic validation
  $0 --spec test-fixtures/specifications/user-auth.md \\
     --impl test-fixtures/implementations/user-auth/good

  # Custom activity
  $0 --activity validate-performance-contract \\
     --spec specs/api-latency.md \\
     --impl src/api/

  # Verify expected result
  $0 --spec specs/user-auth.md \\
     --impl implementations/auth/ \\
     --verify-expected test-fixtures/expected-results/user-auth-good.json

Environment:
  METABOB_API_KEY         API key for activity.metabob.com (required)
  METABOB_ENDPOINT        Backend URL (default: https://activity.metabob.com)
  ANTHROPIC_API_KEY       Anthropic API key for LLM (required)

EOF
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "$SPEC_PATH" ]]; then
  echo "❌ Error: --spec required"
  exit 1
fi

if [[ -z "$IMPL_PATH" ]]; then
  echo "❌ Error: --impl required"
  exit 1
fi

if [[ ! -f "$SPEC_PATH" ]]; then
  echo "❌ Error: Specification not found: $SPEC_PATH"
  exit 1
fi

if [[ ! -e "$IMPL_PATH" ]]; then
  echo "❌ Error: Implementation not found: $IMPL_PATH"
  exit 1
fi

# ==============================================================================
# Execution
# ==============================================================================

echo "=================================================="
echo "Contract Enforcement Testing"
echo "=================================================="
echo "Specification: $SPEC_PATH"
echo "Implementation: $IMPL_PATH"
echo "Activity: $ACTIVITY_ID"
echo "Backend: $METABOB_ENDPOINT"
echo "=================================================="
echo ""

# Prepare variables for MiniBob
SPEC_ABS_PATH="$(realpath "$SPEC_PATH")"
IMPL_ABS_PATH="$(realpath "$IMPL_PATH")"

# Create temporary output directory
TEMP_OUTPUT=$(mktemp -d)
trap "rm -rf $TEMP_OUTPUT" EXIT

# Export environment variables for MiniBob
export METABOB_ENDPOINT
export METABOB_API_KEY
export MINIBOB_WORKDIR="$IMPL_ABS_PATH"

# Run MiniBob with contract validation goal
echo "🚀 Running contract validation..."
echo ""

cd "$MINIBOB_PATH"

# Build goal description
GOAL="Validate contract compliance for specification at $SPEC_ABS_PATH against implementation at $IMPL_ABS_PATH. Use activity $ACTIVITY_ID. Report compliance status (PASS/DRIFT/FAIL) and drift percentages."

# Execute MiniBob
EXECUTION_OUTPUT=$(mktemp)
if bun run index.ts --single "$GOAL" > "$EXECUTION_OUTPUT" 2>&1; then
  EXECUTION_STATUS="success"
else
  EXECUTION_STATUS="failed"
fi

# Display output
cat "$EXECUTION_OUTPUT"
echo ""

# Parse execution trace ID from output
TRACE_ID=$(grep -oP 'Execution trace: \K[a-z0-9_]+' "$EXECUTION_OUTPUT" || echo "")

if [[ -z "$TRACE_ID" ]]; then
  echo "⚠️  Warning: Could not extract trace ID from execution"
  TRACE_ID="unknown"
fi

echo "=================================================="
echo "Execution Result"
echo "=================================================="
echo "Status: $EXECUTION_STATUS"
echo "Trace ID: $TRACE_ID"
echo ""

# ==============================================================================
# Fetch Compliance Report
# ==============================================================================

if [[ "$TRACE_ID" != "unknown" ]]; then
  echo "📊 Fetching compliance report from backend..."

  REPORT_FILE="${OUTPUT_PATH:-$TEMP_OUTPUT/compliance-report.json}"

  # Query backend for execution trace
  curl -s -X POST "$METABOB_ENDPOINT/v2/impulses/resolve" \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"pointer\": {
        \"type\": \"activityExecutionTrace\",
        \"executionId\": \"$TRACE_ID\"
      }
    }" | jq '.' > "$REPORT_FILE"

  if [[ -f "$REPORT_FILE" ]]; then
    echo "✅ Compliance report saved to: $REPORT_FILE"
    echo ""

    # Display summary
    echo "------------------------------------------------"
    echo "Compliance Summary"
    echo "------------------------------------------------"
    jq -r '
      "Status: \(.status // "unknown")",
      "Functional Drift: \(.compliance.functional.drift // "N/A")%",
      "Performance Drift: \(.compliance.performance.drift // "N/A")%",
      "Overall Drift: \(.summary.overallDrift // "N/A")%",
      "Requirements Met: \(.summary.metRequirements // 0) / \(.summary.totalRequirements // 0)"
    ' "$REPORT_FILE" 2>/dev/null || echo "Could not parse compliance data"
    echo "------------------------------------------------"
  fi
fi

# ==============================================================================
# Verify Expected Results (if provided)
# ==============================================================================

if [[ -n "$VERIFY_EXPECTED" ]]; then
  echo ""
  echo "🔍 Verifying against expected results..."

  if [[ ! -f "$VERIFY_EXPECTED" ]]; then
    echo "❌ Expected results file not found: $VERIFY_EXPECTED"
    exit 1
  fi

  if [[ ! -f "$REPORT_FILE" ]]; then
    echo "❌ Compliance report not available for verification"
    exit 1
  fi

  # Compare key fields
  EXPECTED_STATUS=$(jq -r '.expectedStatus' "$VERIFY_EXPECTED")
  ACTUAL_STATUS=$(jq -r '.status // "unknown"' "$REPORT_FILE")

  echo "Expected status: $EXPECTED_STATUS"
  echo "Actual status: $ACTUAL_STATUS"

  if [[ "$EXPECTED_STATUS" == "$ACTUAL_STATUS" ]]; then
    echo "✅ Status matches expected"
  else
    echo "❌ Status mismatch!"
    exit 1
  fi

  # Compare drift percentages (within 5% tolerance)
  EXPECTED_DRIFT=$(jq -r '.expectedDrift.overall // 0' "$VERIFY_EXPECTED")
  ACTUAL_DRIFT=$(jq -r '.summary.overallDrift // 0' "$REPORT_FILE")

  DRIFT_DIFF=$(echo "$ACTUAL_DRIFT - $EXPECTED_DRIFT" | bc -l)
  DRIFT_DIFF_ABS=$(echo "$DRIFT_DIFF" | tr -d '-')

  if (( $(echo "$DRIFT_DIFF_ABS < 5" | bc -l) )); then
    echo "✅ Drift within 5% tolerance (expected: ${EXPECTED_DRIFT}%, actual: ${ACTUAL_DRIFT}%)"
  else
    echo "⚠️  Drift outside tolerance (expected: ${EXPECTED_DRIFT}%, actual: ${ACTUAL_DRIFT}%)"
  fi
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "=================================================="
echo "Contract Test Complete"
echo "=================================================="
echo "Execution: $EXECUTION_STATUS"
echo "Trace ID: $TRACE_ID"
echo "Backend: Traces stored at $METABOB_ENDPOINT"
echo ""
echo "Next Steps:"
echo "  • View trace in dashboard: https://internal.metabob.com/executions/$TRACE_ID"
echo "  • Query traces: curl $METABOB_ENDPOINT/v2/activities/execution-traces"
echo "  • Analyze patterns: bun run scripts/analyze-contract-traces.ts"
echo "=================================================="
