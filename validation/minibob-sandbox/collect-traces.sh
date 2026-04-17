#!/usr/bin/env bash
set -euo pipefail

# Quick Trace Collection Script
# Runs subset of tests to rapidly collect execution traces

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "MiniBob Trace Collection"
echo "========================"
echo ""

# Check environment
if [ -z "${METABOB_API_KEY:-}" ]; then
  echo "ERROR: METABOB_API_KEY not set"
  exit 1
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY not set"
  exit 1
fi

# Parse arguments
PRIORITY="${1:-high}"
COUNT="${2:-5}"

echo "Priority: $PRIORITY"
echo "Count:    First $COUNT tests"
echo ""

# Run validation with priority filter
cd "$SCRIPT_DIR"

if [ ! -d workspace ]; then
  echo "Workspace not found - running setup..."
  ./setup.sh
  echo ""
fi

echo "Running validation tests..."
echo ""

# Run tests and capture exit code
set +e
bun run run-validation.ts "$PRIORITY"
EXIT_CODE=$?
set -e

# Show results
if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✓ All tests passed"
else
  echo ""
  echo "⚠ Some tests failed (exit code: $EXIT_CODE)"
fi

# Show trace collection summary
if [ -f reports/validation-report.json ]; then
  echo ""
  echo "Trace Collection Summary:"
  echo "-------------------------"
  bun run -e "
    const report = await Bun.file('reports/validation-report.json').json();
    console.log('Collected:  ' + report.summary.traceCollection.collected);
    console.log('Submitted:  ' + report.summary.traceCollection.submitted);
    console.log('Failed:     ' + report.summary.traceCollection.failed);
    console.log('');
    console.log('Cost:       $' + report.totalCost.toFixed(4));
    console.log('Duration:   ' + (report.totalDuration / 1000).toFixed(1) + 's');
  "
fi

# Show backend URL
echo ""
echo "Backend: https://activity.metabob.com"
echo "View traces in Activity Dashboard"
echo ""

exit $EXIT_CODE
