#!/bin/bash
# External E2E Activity Lifecycle Validation Runner
# Specification: external-e2e-activity-lifecycle-validation
#
# This script:
# 1. Builds OpenCode distribution (compiled binary)
# 2. Runs external E2E validation harness
# 3. Reports results with evidence

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "External E2E Activity Lifecycle Validation"
echo "========================================"
echo ""

# Step 1: Build OpenCode distribution
echo "Step 1: Building OpenCode distribution..."
cd repos/metabob-opencode
if ! bun run build; then
  echo "❌ Build failed"
  exit 1
fi
echo "✓ Build complete"
cd "$PROJECT_ROOT"
echo ""

# Step 2: Verify binary
OPENCODE_BIN="repos/metabob-opencode/dist/opencode-linux-x64/bin/opencode"
if [[ ! -f "$OPENCODE_BIN" ]]; then
  echo "❌ OpenCode binary not found: $OPENCODE_BIN"
  exit 1
fi
echo "✓ Binary verified: $OPENCODE_BIN"
echo ""

# Step 3: Run validation harness
echo "Step 2: Running external E2E validation harness..."
if ! npx ts-node tests/validation-harnesses/external-e2e-activity-lifecycle-validation-harness.ts; then
  echo ""
  echo "❌ VALIDATION FAILED"
  exit 1
fi

echo ""
echo "✅ VALIDATION PASSED - COMPLETE LIFECYCLE VALIDATED"
exit 0
