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

# The cutover push leg leaves the clone's working tree with unstaged deletions
# (src/ gone) after committing only its staged files; mirroring that state
# severs the live runtime's source (observed obsidian-vessel, 2026-07-13).
# These clones exist solely to push committed state — restore to HEAD first so
# the mirror always reflects the commit, never push-leg working-tree damage.
git -C "$SRC" checkout -f -- . 2>/dev/null || log "WARN could not restore $SRC working tree to HEAD"

# Repo package.json declares workspace deps as RELATIVE file: paths
# (file:../ias-executor-ts, file:../../packages/...). The runtime layout is
# flat under /vessels, so rewrite to absolute paths — the same rewrite the
# Dockerfile does at build time. Without it, bun install over the image's
# physical copy produced a circular package.json symlink and the vessel
# crash-looped on "Cannot find module" (analysis-vessel, 2026-07-02).
# Change detection compares the REWRITTEN form so an unchanged dep set never
# triggers a reinstall.
NEWPKG=""
DEPS_CHANGED=0
if [ -f "$SRC/package.json" ]; then
  NEWPKG="$(sed "s|file:\.\./\.\./packages/|file:${RUNTIME_DIR}/packages/|g; s|file:\.\./|file:${RUNTIME_DIR}/|g" "$SRC/package.json")"
  if [ "$NEWPKG" != "$(cat "$DST/package.json" 2>/dev/null)" ]; then DEPS_CHANGED=1; fi
fi

if [ -d "$SRC/src" ]; then
  rm -rf "$DST/src"
  cp -r "$SRC/src" "$DST/src"
fi
# NB: deliberately NOT bun.lock/bun.lockb — the clone's lockfile pins the
# RELATIVE file: paths and poisons resolution in the runtime layout.
for f in tsconfig.json index.ts; do
  [ -f "$SRC/$f" ] && cp "$SRC/$f" "$DST/$f"
done
[ -n "$NEWPKG" ] && printf '%s\n' "$NEWPKG" > "$DST/package.json"

if [ "$DEPS_CHANGED" = 1 ]; then
  log "$VESSEL: package.json changed — clean bun install"
  # Clean install: mixing bun's symlink install into an image-time physical
  # copy is what created the circular-symlink state.
  rm -rf "$DST/node_modules" "$DST/bun.lock" "$DST/bun.lockb"
  (cd "$DST" && /root/.bun/bin/bun install --silent 2>&1 | tail -2) || log "WARN bun install failed for $VESSEL"
fi

log "$VESSEL mirrored ($(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo '?')) -> $DST"
