#!/bin/bash
# Reset the demo to clean state

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Resetting demo to clean state..."

# Restore files from git
git checkout -- src/calculator.ts src/index.ts 2>/dev/null || true

# Remove any generated files
rm -f FAILURE_ANALYSIS.md
rm -f *.log

echo "Demo reset complete."
echo "Run 'bun run ci' to verify everything passes."
