#!/usr/bin/env bash
# Run a single benchmark cell for iter2.
# Usage: run-cell.sh <prompt-name> <workspace-name>
# e.g.:  run-cell.sh 01-fix-failing-test pristine-typescript-project
set -euo pipefail

VALIDATION_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$HOME/.metabob/config.json"

# Read the API key from the config file
read -r ANTHROPIC_API_KEY < <(jq -r '.providers.anthropic.apiKey' "$CONFIG_FILE")
export ANTHROPIC_API_KEY

PROMPT_NAME="$1"
WORKSPACE="$2"

PROMPT_FILE="$VALIDATION_DIR/prompts/${PROMPT_NAME}.md"

echo "[run-cell] prompt=$PROMPT_NAME workspace=$WORKSPACE" >&2

exec bun run "$VALIDATION_DIR/lib/orchestrator.ts" \
  --prompt "$PROMPT_FILE" \
  --workspace "$WORKSPACE" \
  --only minibob \
  --no-backend
