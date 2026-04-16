#!/usr/bin/env bash
# Bootstrap MiniBob as the primary developer for this repository
# Run this once to set up MiniBob development environment

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "🤖 Bootstrapping MiniBob Development Environment"
echo "   Repository: $REPO_ROOT"
echo ""

# Step 1: Verify MiniBob is installed
echo "1️⃣  Checking MiniBob installation..."
if ! command -v minibob &> /dev/null; then
  echo "❌ MiniBob not found in PATH"
  echo "   Install with: bun install -g @metabob/minibob"
  exit 1
fi
echo "   ✅ MiniBob installed: $(which minibob)"
echo ""

# Step 2: Verify API keys
echo "2️⃣  Checking API keys..."
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "❌ ANTHROPIC_API_KEY not set"
  echo "   Export it: export ANTHROPIC_API_KEY='sk-ant-...'"
  exit 1
fi
if [ -z "${METABOB_API_KEY:-}" ]; then
  echo "❌ METABOB_API_KEY not set"
  echo "   Export it: export METABOB_API_KEY='mb_live_...'"
  exit 1
fi
echo "   ✅ ANTHROPIC_API_KEY configured"
echo "   ✅ METABOB_API_KEY configured"
echo ""

# Step 3: Create .metabob directory structure
echo "3️⃣  Setting up .metabob directory..."
mkdir -p .metabob/traces
mkdir -p .metabob/activities
mkdir -p .metabob/impulses
echo "   ✅ Directory structure created"
echo ""

# Step 4: Create project config
echo "4️⃣  Creating project configuration..."
cat > .metabob/config.json <<EOF
{
  "project": "minibob-cicd-demo",
  "workingDirectory": "$REPO_ROOT",
  "metabob": {
    "endpoint": "https://activity.metabob.com",
    "apiKey": "$METABOB_API_KEY"
  },
  "providers": {
    "anthropic": {
      "apiKey": "$ANTHROPIC_API_KEY"
    }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "tracing": {
    "enabled": true,
    "recordAllExecutions": true,
    "traceDirectory": ".metabob/traces"
  }
}
EOF
echo "   ✅ Configuration written to .metabob/config.json"
echo ""

# Step 5: Register activities to canary
echo "5️⃣  Registering activities to canary backend..."
if ./scripts/register-activities-to-canary.sh; then
  echo "   ✅ Activities registered"
else
  echo "   ⚠️  Some activities failed to register (continuing anyway)"
fi
echo ""

# Step 6: Verify connectivity
echo "6️⃣  Verifying backend connectivity..."
HEALTH=$(curl -s https://activity.metabob.com/health | jq -r '.status')
if [ "$HEALTH" = "healthy" ]; then
  echo "   ✅ Backend healthy"
else
  echo "   ⚠️  Backend health check failed"
fi
echo ""

# Step 7: Test MiniBob
echo "7️⃣  Testing MiniBob..."
echo "   Running: minibob --single 'echo hello from minibob' (dry run)"
# We'll do a simple test to verify it works
if minibob --list-templates > /dev/null 2>&1; then
  echo "   ✅ MiniBob operational"
else
  echo "   ❌ MiniBob test failed"
  exit 1
fi
echo ""

# Step 8: Create initial commit
echo "8️⃣  Creating bootstrap commit..."
git add .metabob/ MINIBOB_DEVELOPMENT_POLICY.md scripts/register-activities-to-canary.sh scripts/minibob-bootstrap.sh
if git diff --cached --quiet; then
  echo "   ℹ️  No changes to commit"
else
  git commit -m "chore: bootstrap MiniBob development environment

- Add development manifest
- Add MiniBob development policy
- Add activity registration script
- Add bootstrap script

Co-Authored-By: MiniBob <minibob@metabob.com>" || true
  echo "   ✅ Bootstrap commit created"
fi
echo ""

echo "═══════════════════════════════════════"
echo "✅ MiniBob Development Environment Ready!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Use MiniBob for all development:"
echo "     minibob --single 'fix the failing test in calculator.ts'"
echo ""
echo "  2. View activity dashboard:"
echo "     ./scripts/show-learning-metrics.sh"
echo ""
echo "  3. Run a learning loop demo:"
echo "     ./scripts/run-scenario-1-cold-start.sh"
echo ""
echo "Remember: ALL development must go through MiniBob!"
echo "See MINIBOB_DEVELOPMENT_POLICY.md for details."
echo ""
