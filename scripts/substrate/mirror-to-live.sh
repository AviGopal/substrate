#!/usr/bin/env bash
# mirror-to-live.sh — mirror a vessel's git clone into the live /vessels runtime.
#
#   mirror-to-live.sh <vessel> [clone-dir]
#
# The single in-container equivalent of the host Makefile's sync-<vessel>
# recipe (wipe src, copy src, bun install iff package.json changed) — shared by
# substrate-pull-sync (periodic + boot convergence) so mirror semantics cannot
# drift between callers. Copies src/ plus the root build files; deliberately
# NOT node_modules (bun install owns that) and NOT .git.
#
# cp INTO an existing dir nests (src/src — the docker-cp gotcha, 2026-07-01):
# always rm the target first, then cp the tree.
set -uo pipefail

VESSEL="${1:?usage: mirror-to-live.sh <vessel> [clone-dir]}"
CLONE_DIR="${2:-${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}}"
RUNTIME_DIR="${MITOSIS_RUNTIME_DIR:-/vessels}"

SRC="$CLONE_DIR/$VESSEL"
DST="$RUNTIME_DIR/$VESSEL"
log() { echo "[mirror-to-live] $*"; }

[ -d "$SRC/.git" ] || { log "no clone at $SRC — nothing to mirror"; exit 1; }
[ -d "$DST" ] || { log "no live runtime at $DST — vessel not baked/installed here; skipping"; exit 0; }

# Detect dependency changes before overwriting.
DEPS_CHANGED=0
if [ -f "$SRC/package.json" ]; then
  if ! cmp -s "$SRC/package.json" "$DST/package.json" 2>/dev/null; then DEPS_CHANGED=1; fi
fi

if [ -d "$SRC/src" ]; then
  rm -rf "$DST/src"
  cp -r "$SRC/src" "$DST/src"
fi
for f in package.json tsconfig.json bun.lock bun.lockb index.ts; do
  [ -f "$SRC/$f" ] && cp "$SRC/$f" "$DST/$f"
done

if [ "$DEPS_CHANGED" = 1 ]; then
  log "$VESSEL: package.json changed — bun install"
  (cd "$DST" && /root/.bun/bin/bun install --silent 2>&1 | tail -2) || log "WARN bun install failed for $VESSEL"
fi

log "$VESSEL mirrored ($(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo '?')) -> $DST"
