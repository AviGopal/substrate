#!/usr/bin/env bash
# Thin wrapper around the Bun orchestrator.
#
# Usage:
#   ./run.sh <prompt-file> <workspace-name> [--model <id>] [--timeout <seconds>] [--only <agent>]
#
# Example:
#   ./run.sh prompts/01-fix-failing-test.md pristine-typescript-project
#
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: $0 <prompt-file> <workspace-name> [extra orchestrator flags]" >&2
  exit 1
fi

PROMPT="$1"; shift
WORKSPACE="$1"; shift

DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun run "$DIR/lib/orchestrator.ts" \
  --prompt "$PROMPT" \
  --workspace "$WORKSPACE" \
  "$@"
