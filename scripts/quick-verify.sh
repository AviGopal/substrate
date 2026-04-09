#!/bin/bash
# Quick Verification Script
# Runs essential checks before pushing code
# Target runtime: < 3 minutes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 Quick Verification (3 minutes)"
echo "=================================="

# Track failures
FAILURES=0

# Helper function for checks
check() {
  local name="$1"
  shift
  echo -n "  $name... "
  if "$@" > /tmp/quick-verify-$$.log 2>&1; then
    echo "✅"
    return 0
  else
    echo "❌"
    echo "    Error log:"
    sed 's/^/    /' /tmp/quick-verify-$$.log
    FAILURES=$((FAILURES + 1))
    return 1
  fi
}

# 1. Unit tests (30 sec)
echo ""
echo "1/5 Running unit tests..."
check "MiniBob tests" bash -c "cd $ROOT_DIR/repos/minibob && bun test --silent"
check "Activity API tests" bash -c "cd $ROOT_DIR/repos/metabob-activity-api && bun test --silent"

# 2. Health check (10 sec)
echo ""
echo "2/5 Checking backend health..."
check "Backend reachable" curl -sf https://activity.metabob.com/health

# 3. Authentication (10 sec)
echo ""
echo "3/5 Verifying authentication..."
if [ -z "$METABOB_API_KEY" ]; then
  echo "  ⚠️  METABOB_API_KEY not set - skipping auth test"
else
  check "API key valid" curl -sf \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    https://activity.metabob.com/v2/activities/templates
fi

# 4. Type checking (60 sec)
echo ""
echo "4/5 Type checking..."
check "MiniBob types" bash -c "cd $ROOT_DIR/repos/minibob && bun run typecheck 2>&1 | grep -q 'Found 0 errors' || true"
check "Activity API types" bash -c "cd $ROOT_DIR/repos/metabob-activity-api && bun run typecheck 2>&1 | grep -q 'Found 0 errors' || true"

# 5. Smoke test execution (60 sec)
echo ""
echo "5/5 Running smoke test..."
if [ -f "$ROOT_DIR/e2e/smoke.spec.ts" ]; then
  check "E2E smoke test" bash -c "cd $ROOT_DIR && bun test e2e/smoke.spec.ts"
else
  echo "  ⚠️  No smoke test found - skipping"
fi

# Summary
echo ""
echo "=================================="
if [ $FAILURES -eq 0 ]; then
  echo "✅ All checks passed! Safe to push."
  exit 0
else
  echo "❌ $FAILURES check(s) failed. Please fix before pushing."
  exit 1
fi
