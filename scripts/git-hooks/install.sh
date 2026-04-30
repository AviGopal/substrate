#!/usr/bin/env bash
#
# Install the super-repo git hooks for this clone.
#
# Sets `core.hooksPath` to scripts/git-hooks so the versioned hooks here run
# on commit. Idempotent. Run after a fresh clone or after pulling new hooks.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="scripts/git-hooks"

cd "$REPO_ROOT"

if [[ ! -d "$HOOK_DIR" ]]; then
  echo "error: $HOOK_DIR not found; run from the metabob-devbob super-repo." >&2
  exit 1
fi

# Make every hook executable.
chmod +x "$HOOK_DIR"/* 2>/dev/null || true

git config core.hooksPath "$HOOK_DIR"
echo "core.hooksPath -> $HOOK_DIR"
echo "hooks: $(ls "$HOOK_DIR" | grep -v '\.\(md\|sh\)$' | tr '\n' ' ')"
