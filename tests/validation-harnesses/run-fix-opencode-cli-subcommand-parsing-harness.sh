#!/bin/bash
# Run validation harness for fix-opencode-cli-subcommand-parsing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🧪 OpenCode CLI Subcommand Parsing Validation Harness"
echo "=================================================="
echo ""

# Check if OpenCode is built
OPENCODE_DIR="$PROJECT_ROOT/repos/metabob-opencode/packages/opencode"
if [ ! -f "$OPENCODE_DIR/dist/cli/index.js" ]; then
  echo "❌ OpenCode CLI not built. Building now..."
  cd "$OPENCODE_DIR" && npm run build
  echo "✅ Build complete"
  echo ""
fi

# Compile the harness
echo "📦 Compiling validation harness..."
cd "$SCRIPT_DIR"
npx tsc --skipLibCheck fix-opencode-cli-subcommand-parsing-harness.ts || {
  echo "⚠️  TypeScript compilation failed, trying with ts-node..."
  npx ts-node fix-opencode-cli-subcommand-parsing-harness.ts
  exit $?
}

# Run the harness
echo ""
echo "🚀 Running validation tests..."
echo ""
node fix-opencode-cli-subcommand-parsing-harness.js

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All validation tests passed!"
else
  echo ""
  echo "❌ Some validation tests failed (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE
