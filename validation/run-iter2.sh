#!/usr/bin/env bash
# Phase 13 iter2 benchmark runner — reads API key from ~/.metabob/config.json
set -euo pipefail

VALIDATION_DIR="$(cd "$(dirname "$0")" && pwd)"
ANTHROPIC_API_KEY="$(jq -r '.providers.anthropic.apiKey' ~/.metabob/config.json)"
export ANTHROPIC_API_KEY

PROMPT="$1"
WORKSPACE="$2"
shift 2

exec bun run "$VALIDATION_DIR/lib/orchestrator.ts" \
  --prompt "$PROMPT" \
  --workspace "$WORKSPACE" \
  "$@"
