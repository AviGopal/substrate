#!/usr/bin/env bash
set -e

# Script to introduce bugs for CI/CD demo
# Usage: ./scripts/introduce-bug.sh [type]
# Types: test, type, lint, random

BUG_TYPE="${1:-random}"

echo "🐛 Introducing bug type: ${BUG_TYPE}"

case "${BUG_TYPE}" in
  test|random)
    echo "Introducing test failure bug..."
    # Break the multiply function
    sed -i 's/value: a \* b,/value: a + b,/' src/calculator.ts
    echo "✓ Changed multiply to use + instead of *"
    ;;

  type)
    echo "Introducing type error..."
    # Add a function with wrong return type
    cat >> src/calculator.ts << 'EOF'

export function modulo(a: number, b: number): string {
  return {
    value: a % b,
    operation: 'modulo',
    inputs: [a, b],
  };
}
EOF
    echo "✓ Added modulo function with wrong return type (string instead of CalculationResult)"
    ;;

  lint)
    echo "Introducing lint violations..."
    # Add lint violations
    cat >> src/calculator.ts << 'EOF'

export function squareRoot(n: number): CalculationResult {
  var result = Math.sqrt(n);
  console.log("Computing square root");
  const unused_variable = 42;
  return {
    value: result,
    operation: 'sqrt',
    inputs: [n],
  };
}
EOF
    echo "✓ Added function with var, console.log, and unused variable"
    ;;

  *)
    echo "Unknown bug type: ${BUG_TYPE}"
    echo "Available types: test, type, lint, random"
    exit 1
    ;;
esac

echo ""
echo "Bug introduced! Status:"
git diff --stat src/calculator.ts

echo ""
echo "Next steps:"
echo "1. Commit and push to a feature branch:"
echo "   git checkout -b feature/test-pr-workflow"
echo "   git add -A"
echo "   git commit -m 'feat: add new functions (with intentional bug)'"
echo "   git push origin feature/test-pr-workflow"
echo ""
echo "2. This will trigger ci-with-pr.yml workflow"
echo "3. MiniBob will create a PR with the fix"
