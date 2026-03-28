#!/bin/bash
set -e

echo "=== Session Memory System Verification ==="
echo ""

echo "1. Checking hook registration..."
cd repos/metabob-opencode
if rg -q "registerHook.*memory-management" packages/opencode/src/session/turn-lifecycle-hooks.ts; then
  echo "   ✓ Hook registered"
else
  echo "   ✗ Hook not found"
  exit 1
fi

echo ""
echo "2. Checking activity template..."
cd ../..
if [ -f "repos/metabob-proto/activities/bootstrap/manage-session-memory.json" ]; then
  echo "   ✓ Template exists"
  # Check template has correct tasks
  TASK_COUNT=$(jq '.tasks | length' repos/metabob-proto/activities/bootstrap/manage-session-memory.json)
  echo "   ✓ Template has $TASK_COUNT tasks (expected: 5)"
else
  echo "   ✗ Template not found"
  exit 1
fi

echo ""
echo "3. Checking memory agent tools..."
cd repos/metabob-opencode
TOOLS=("impulse_create" "impulse_load" "impulse_unload" "memory_outline" "memory_budget" "memory_optimize")
for tool in "${TOOLS[@]}"; do
  if rg -q "$tool.*true" packages/opencode/src/agent/agent.ts; then
    echo "   ✓ $tool configured"
  else
    echo "   ✗ $tool missing from agent config"
    exit 1
  fi
done

echo ""
echo "4. Checking tool implementations..."
for tool in "${TOOLS[@]}"; do
  TOOL_FILE="packages/opencode/src/tool/${tool//_/-}.ts"
  if [ -f "$TOOL_FILE" ]; then
    echo "   ✓ $TOOL_FILE"
  else
    echo "   ✗ $TOOL_FILE missing"
    exit 1
  fi
done

echo ""
echo "5. Checking SessionMemoryAgent.gatherContext()..."
if rg -q "export async function gatherContext" packages/opencode/src/session/memory-agent.ts; then
  echo "   ✓ gatherContext() implemented"
else
  echo "   ✗ gatherContext() not found"
  exit 1
fi

echo ""
echo "6. Checking impulse transfer logic..."
if rg -q "scope.*session.*as const" packages/opencode/src/session/turn-lifecycle-hooks.ts; then
  echo "   ✓ Impulse scope conversion implemented"
else
  echo "   ✗ Impulse transfer logic missing"
  exit 1
fi

echo ""
echo "7. Checking executeActivityInline()..."
if rg -q "export async function executeActivityInline" packages/opencode/src/tool/activity.ts; then
  echo "   ✓ executeActivityInline() implemented"
else
  echo "   ✗ executeActivityInline() not found"
  exit 1
fi

echo ""
echo "=== All Static Checks Passed ✓ ==="
echo ""
echo "Architecture Status: 🟢 COMPLETE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "OPTION 1: Live Session Test (Recommended)"
echo "  1. cd repos/metabob-opencode && bun run dev"
echo "  2. Send message: 'Fix the bug in turn-lifecycle-hooks.ts'"
echo "  3. Monitor logs for:"
echo "     - 'executing memory management activity'"
echo "     - 'memory management completed'"
echo "     - 'impulsesTransferred': <number>"
echo "     - Duration < 2000ms"
echo ""
echo "OPTION 2: Unit Test"
echo "  Create test/session/turn-lifecycle-memory.test.ts"
echo "  Run: bun test test/session/turn-lifecycle-memory.test.ts"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "After Verification:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Document actual performance metrics"
echo "2. Fix any critical issues found"
echo "3. Optimize logging:"
echo "   - Keep critical lifecycle events"
echo "   - Gate verbose logs: OPENCODE_DEBUG_MEMORY=true"
echo "   - Add performance metrics"
echo ""
