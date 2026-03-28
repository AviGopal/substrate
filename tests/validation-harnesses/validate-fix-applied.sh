#!/bin/bash
# Simple validation: Check if fix was applied to source code

set -e

SOURCE_FILE="repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts"

echo "🧪 Validating fix-opencode-cli-subcommand-parsing"
echo "================================================"
echo ""

PASS=0
FAIL=0

# Test 1: Check if REGISTERED_SUBCOMMANDS constant exists
echo "Test 1: REGISTERED_SUBCOMMANDS constant exists"
if grep -q "const REGISTERED_SUBCOMMANDS = new Set" "$SOURCE_FILE"; then
  echo "✓ PASS - REGISTERED_SUBCOMMANDS constant found"
  ((PASS++))
else
  echo "✗ FAIL - REGISTERED_SUBCOMMANDS constant not found"
  ((FAIL++))
fi
echo ""

# Test 2: Check if .check() validation uses REGISTERED_SUBCOMMANDS
echo "Test 2: .check() validation uses subcommand detection"
if grep -A 3 "Skip validation for registered subcommands" "$SOURCE_FILE" | grep -q "REGISTERED_SUBCOMMANDS.has(firstArg)"; then
  echo "✓ PASS - .check() function uses subcommand detection"
  ((PASS++))
else
  echo "✗ FAIL - .check() function doesn't use subcommand detection"
  ((FAIL++))
fi
echo ""

# Test 3: Check if handler skips subcommands
echo "Test 3: Handler skips subcommands"
if grep -A 3 "Skip if it's a subcommand" "$SOURCE_FILE" | grep -q "REGISTERED_SUBCOMMANDS.has(firstArg)"; then
  echo "✓ PASS - Handler skips subcommands"
  ((PASS++))
else
  echo "✗ FAIL - Handler doesn't skip subcommands"
  ((FAIL++))
fi
echo ""

# Test 4: Check if all 10 subcommands are registered
echo "Test 4: All 10 subcommands registered"
SUBCOMMANDS=("list" "template" "run" "init" "clear" "metrics" "recommend" "search" "promote" "evolve")
FOUND=0
for cmd in "${SUBCOMMANDS[@]}"; do
  if grep "const REGISTERED_SUBCOMMANDS" -A 12 "$SOURCE_FILE" | grep -q "'$cmd'"; then
    ((FOUND++))
  fi
done

if [ $FOUND -eq 10 ]; then
  echo "✓ PASS - All 10 subcommands registered: ${SUBCOMMANDS[*]}"
  ((PASS++))
else
  echo "✗ FAIL - Only $FOUND/10 subcommands registered"
  ((FAIL++))
fi
echo ""

# Test 5: Check if validation logic was updated (uses firstArg instead of templateId)
echo "Test 5: Validation logic uses firstArg variable"
if grep ".check((argv) =>" -A 15 "$SOURCE_FILE" | grep -q "const firstArg = positionals\[0\] as string"; then
  echo "✓ PASS - Validation logic updated to use firstArg"
  ((PASS++))
else
  echo "✗ FAIL - Validation logic not updated"
  ((FAIL++))
fi
echo ""

# Test 6: Check if handler logic was updated
echo "Test 6: Handler logic uses firstArg variable"
if grep "handler: async (args) =>" -A 15 "$SOURCE_FILE" | grep -q "const firstArg = positionals\[0\] as string"; then
  echo "✓ PASS - Handler logic updated to use firstArg"
  ((PASS++))
else
  echo "✗ FAIL - Handler logic not updated"
  ((FAIL++))
fi
echo ""

# Summary
echo "================================================"
echo "📊 Results: $PASS passed, $FAIL failed out of 6 tests"
if [ $FAIL -eq 0 ]; then
  echo "✅ All validation tests passed!"
  echo ""
  echo "Fix successfully applied:"
  echo "  ✓ REGISTERED_SUBCOMMANDS constant added"
  echo "  ✓ .check() validation detects subcommands"
  echo "  ✓ Handler skips subcommands"
  echo "  ✓ All 10 subcommands registered"
  echo "  ✓ Code logic properly updated"
  exit 0
else
  echo "❌ Some validation tests failed"
  exit 1
fi
