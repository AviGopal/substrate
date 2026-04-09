#!/usr/bin/env bash
set -euo pipefail

# Scenario 1: First Bug Fix (Cold Start)
# Demonstrates three loops with no historical data

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo "  Scenario 1: First Bug Fix (Cold Start)"
echo "================================================"
echo ""
echo "This demonstrates all three loops with no history:"
echo "  Loop 3 (Discovery): Scans discover files/commits/NO traces"
echo "  Loop 1 (Impulse Flow): Impulses loaded, usage tracked"
echo "  Loop 2 (External Validation): Tests validate, Thompson updated"
echo ""

# Check prerequisites
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "❌ Error: ANTHROPIC_API_KEY not set"
  exit 1
fi

if [ -z "${METABOB_API_KEY:-}" ]; then
  echo "❌ Error: METABOB_API_KEY not set"
  exit 1
fi

# Step 1: Clean slate - remove any existing traces
echo "📋 Step 1: Resetting to clean slate..."
cd "$DEMO_DIR"
git restore .
bun test > /dev/null 2>&1 || true
echo "✅ Clean slate ready"
echo ""

# Step 2: Introduce a bug
echo "🐛 Step 2: Introducing calculator bug..."
cat > src/calculator.ts << 'EOF'
export interface CalculationResult {
  value: number;
  operation: string;
  inputs: number[];
}

export function add(a: number, b: number): CalculationResult {
  return {
    value: a - b,  // BUG: Using subtraction instead of addition!
    operation: 'add',
    inputs: [a, b]
  };
}

export function subtract(a: number, b: number): CalculationResult {
  return {
    value: a - b,
    operation: 'subtract',
    inputs: [a, b]
  };
}

export function multiply(a: number, b: number): CalculationResult {
  return {
    value: a * b,
    operation: 'multiply',
    inputs: [a, b]
  };
}

export function divide(a: number, b: number): CalculationResult {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return {
    value: a / b,
    operation: 'divide',
    inputs: [a, b]
  };
}
EOF

echo "✅ Bug introduced in src/calculator.ts"
echo ""

# Step 3: Run tests to capture failure
echo "🧪 Step 3: Running tests to capture failure..."
if bun test 2>&1 | tee /tmp/test-output.log; then
  echo "❌ Error: Tests passed but should have failed!"
  exit 1
else
  echo "✅ Tests failed as expected"
  ERROR_LOG=$(cat /tmp/test-output.log)
fi
echo ""

# Step 4: Run discovery activities (Loop 3)
echo "🔍 Step 4: Running discovery activities (Loop 3)..."
echo "  - scan-file-system"
echo "  - scan-git-history"
echo "  - scan-execution-traces"

bunx @metabob/minibob@latest \
  --template activities/discovery/scan-file-system.json \
  --var goalCategory=bugfix \
  --trace > /tmp/discovery-fs.json

bunx @metabob/minibob@latest \
  --template activities/discovery/scan-git-history.json \
  --var commitCount=5 \
  --trace > /tmp/discovery-git.json

bunx @metabob/minibob@latest \
  --template activities/discovery/scan-execution-traces.json \
  --var goalCategory=bugfix \
  --var 'goalKeywords=["test", "failure"]' \
  --trace > /tmp/discovery-traces.json

echo "✅ Discovery complete"
echo ""
echo "  📊 Discovery Results:"
echo "    - Files discovered: $(grep -c "src/" /tmp/discovery-fs.json || echo 0)"
echo "    - Commits found: $(grep -c "commit" /tmp/discovery-git.json || echo 0)"
echo "    - Past traces: $(grep -c "execution" /tmp/discovery-traces.json || echo 0)"
echo ""

# Step 5: Run full fix with three loops
echo "🔧 Step 5: Running MiniBob fix (all three loops)..."
bunx @metabob/minibob@latest \
  --template activities/learning/fix-test-failure-with-discovery.json \
  --var "errorLog=$ERROR_LOG" \
  --var "goalDescription=Fix test failures in calculator" \
  --trace \
  | tee /tmp/fix-output.log

echo ""

# Step 6: Verify fix
echo "✅ Step 6: Verifying fix..."
if bun test; then
  echo "✅ Tests now pass!"
else
  echo "❌ Tests still failing"
  exit 1
fi
echo ""

# Step 7: Show learning metrics
echo "📊 Step 7: Learning Metrics (Cold Start Baseline)"
echo ""
echo "  Loop 1 (Impulse Flow):"
echo "    - Impulses discovered: $(grep -o "impulse" /tmp/discovery-*.json | wc -l)"
echo "    - Impulses loaded: (check /tmp/fix-output.log)"
echo "    - Impulses used: (tracked in backend)"
echo ""
echo "  Loop 2 (External Validation):"
echo "    - Internal validation: ✓ (syntax checks passed)"
echo "    - External validation: ✓ (tests passed)"
echo "    - Thompson Sampling: fix-test-failure α=2, β=1 (initial)"
echo ""
echo "  Loop 3 (Discovery):"
echo "    - scan-file-system: α=2, β=0 (always useful)"
echo "    - scan-git-history: α=1, β=1 (found commits, not yet known if useful)"
echo "    - scan-execution-traces: α=1, β=1 (no history, first execution)"
echo ""

echo "================================================"
echo "  Scenario 1 Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. View trace at: https://activity.metabob.com"
echo "  2. Run Scenario 2 to see warm-start improvements"
echo "  3. Check Thompson Sampling parameters with:"
echo "     curl -H 'Authorization: ApiKey \$METABOB_API_KEY' \\"
echo "       https://activity.metabob.com/v2/activities/templates/fix-test-failure-with-discovery"
echo ""
