#!/bin/bash
set -e

# Terminal Vessel Development with Observation Loop
# This script demonstrates the complete observe/learn/improve cycle

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERMINAL_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$TERMINAL_DIR")")"

echo "🔬 Terminal Vessel Development with Observation"
echo "================================================"
echo ""

# Check if MiniBob is configured
if ! command -v minibob &> /dev/null; then
    echo "❌ MiniBob not found. Install it first:"
    echo "   curl -fsSL https://minibob.dev/install.sh | sh"
    exit 1
fi

# Check if API key is configured
if [ -z "$METABOB_API_KEY" ]; then
    echo "⚠️  METABOB_API_KEY not set"
    echo "   Set it in ~/.metabob/config.json or export METABOB_API_KEY=..."
    exit 1
fi

echo "✅ Environment configured"
echo "   MiniBob: $(which minibob)"
echo "   API endpoint: ${METABOB_ENDPOINT:-https://activity.metabob.com}"
echo ""

# ============================================================
# STEP 1: Run Test Observation
# ============================================================
echo "🧪 Step 1: Observing test execution..."

cd "$TERMINAL_DIR"
minibob --single "execute activity: terminal-observe-test-run"

echo "✅ Test observation complete"
echo ""

# ============================================================
# STEP 2: Analyze Traces
# ============================================================
echo "🔍 Step 2: Analyzing traces..."

minibob --single "execute activity: terminal-analyze-development-traces"

echo "✅ Analysis complete"
echo ""

echo "📊 View results at: https://activity.metabob.com/traces?repository=terminal-vessel"
