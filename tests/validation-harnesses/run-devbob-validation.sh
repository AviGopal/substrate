#!/bin/bash
# Runner script for DevBob Independent Activity Execution validation harness

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_FILE="$SCRIPT_DIR/devbob-independent-activity-execution-harness.ts"

echo "════════════════════════════════════════════════════════════"
echo "  DevBob Independent Activity Execution - Validation Runner"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if we're in DevBob pod or local environment
if [ -d "/workspace" ] && [ -d "/workspace/.config/opencode" ]; then
    echo "🔍 Environment: Running inside DevBob pod"
    EXEC_MODE="pod"
else
    echo "🔍 Environment: Running locally (will use kubectl exec)"
    EXEC_MODE="local"
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        echo "❌ ERROR: kubectl not found. Cannot run validation from local environment."
        exit 1
    fi
    
    # Check if devbob pod exists
    if ! kubectl get pod -n metabob devbob-84466fdfff-dd87l &> /dev/null; then
        echo "❌ ERROR: DevBob pod not found. Is it running?"
        exit 1
    fi
fi

echo ""

# Compile TypeScript to JavaScript if needed
if command -v tsx &> /dev/null; then
    echo "📦 Running with tsx..."
    tsx "$HARNESS_FILE"
elif command -v ts-node &> /dev/null; then
    echo "📦 Running with ts-node..."
    ts-node "$HARNESS_FILE"
else
    echo "⚠️  tsx/ts-node not found, attempting to compile..."
    
    if command -v tsc &> /dev/null; then
        JS_FILE="${HARNESS_FILE%.ts}.js"
        tsc "$HARNESS_FILE" --lib es2020 --module commonjs --target es2020
        node "$JS_FILE"
        rm -f "$JS_FILE"
    else
        echo "❌ ERROR: No TypeScript runtime found (tsx, ts-node, or tsc)"
        echo "   Install with: npm install -g tsx"
        exit 1
    fi
fi

echo ""
echo "✅ Validation complete!"
