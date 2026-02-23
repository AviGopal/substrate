#!/bin/bash
# Run all validation harnesses

set -e

echo "=================================="
echo "Running All Validation Harnesses"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Run dual-write-activity-metrics validation
echo "Running: dual-write-activity-metrics"
echo "----------------------------------"
if bun run "$(dirname "$0")/dual-write-activity-metrics-harness.ts" hello-world-minimal; then
  echo -e "${GREEN}✓ dual-write-activity-metrics PASSED${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ dual-write-activity-metrics FAILED${NC}"
  FAILED=$((FAILED + 1))
fi
echo ""

# Add more validation harnesses here as they are created

# Summary
echo "=================================="
echo "Validation Summary"
echo "=================================="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All validations PASSED ✓${NC}"
  exit 0
else
  echo -e "${RED}Some validations FAILED ✗${NC}"
  exit 1
fi
