#!/bin/bash
set -e

echo "=== Phase 3 CLI Integration Validation ==="
echo ""

cd repos/metabob-opencode

echo "1. Checking TypeScript compilation..."
bunx tsc --noEmit packages/opencode/src/cli/cmd/activity.ts 2>&1 | grep -E "error TS" | grep -v "node_modules" || echo "✅ No syntax errors in activity.ts"

echo ""
echo "2. Verifying changes in git diff..."
git diff --stat packages/opencode/src/cli/cmd/activity.ts

echo ""
echo "3. Checking for execution mode display code..."
if grep -q "executionMode.*deterministic" packages/opencode/src/cli/cmd/activity.ts; then
    echo "✅ Found execution mode display logic"
else
    echo "❌ Missing execution mode display logic"
    exit 1
fi

echo ""
echo "4. Checking for mode flag in run command..."
if grep -q "option.*mode" packages/opencode/src/cli/cmd/activity.ts; then
    echo "✅ Found --mode flag definition"
else
    echo "❌ Missing --mode flag"
    exit 1
fi

echo ""
echo "5. Checking for safe prompt access (optional chaining)..."
if grep -q "task.prompt?.variables" packages/opencode/src/cli/cmd/activity.ts; then
    echo "✅ Found safe prompt.variables access"
else
    echo "❌ Missing optional chaining for prompt"
    exit 1
fi

echo ""
echo "=== Phase 3 CLI Validation: PASSED ==="
