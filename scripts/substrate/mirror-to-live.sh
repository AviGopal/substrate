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

# EXPECTED SHA — the deploy's only defence against shipping the wrong commit.
#
# Everything below restores the clone to HEAD and copies it, then logs the SHA it
# happened to find. That log line is a REPORT, not a CHECK: `reset --hard HEAD`
# moves to whatever HEAD is, so a clone left on a stale commit (fetch failed, a
# push leg raced, the wrong branch checked out) mirrors the wrong code and the
# deploy still exits 0 saying "mirrored". Every caller then believes it shipped
# what it asked for. That is task #51, and it is the same shape as the six sync
# targets that copied one file while printing success (50f10bb9).
#
# Pass the SHA you MEANT to deploy — as $3 or MIRROR_EXPECT_SHA — and a mismatch
# fails loudly BEFORE the live tree is touched. Omitted, behaviour is exactly as
# before, so no existing caller changes; this is a check callers can opt into,
# not a new requirement they must satisfy.
EXPECT_SHA="${3:-${MIRROR_EXPECT_SHA:-}}"
if [ -n "$EXPECT_SHA" ]; then
  ACTUAL_SHA="$(git -C "$SRC" rev-parse HEAD 2>/dev/null || echo "")"
  if [ -z "$ACTUAL_SHA" ]; then
    log "ERROR cannot read HEAD of $SRC — refusing to mirror against an expected SHA"
    exit 1
  fi
  # Prefix match so a caller may pass a short or full SHA.
  case "$ACTUAL_SHA" in
    "$EXPECT_SHA"*) : ;;
    *)
      log "ERROR $VESSEL clone is at ${ACTUAL_SHA%"${ACTUAL_SHA#???????}"}… but the deploy asked for $EXPECT_SHA"
      log "      REFUSING to mirror — the live tree is untouched"
      log "      likely: the clone never fetched the commit, or is on another branch"
      exit 1
      ;;
  esac
fi
[ -d "$DST" ] || { log "no live runtime at $DST — vessel not baked/installed here; skipping"; exit 0; }

# The cutover push leg leaves the clone's working tree with unstaged deletions
# (src/ gone) after committing only its staged files; mirroring that state
# severs the live runtime's source (observed obsidian-vessel, 2026-07-13).
# These clones exist solely to push committed state — restore to HEAD first so
# the mirror always reflects the commit, never push-leg working-tree damage.
# NOTE: `checkout -f -- .` restores from the INDEX, which the cutover push leg leaves
# STALE (committed HEAD ahead of a working tree/index that still reflects the pre-commit
# state) — so the mirror shipped OLD code even when HEAD carried a freshly-landed commit.
# That is a root cause of "landed on origin/dev but never went live" hollow landings
# (self-authored AND operator commits). `reset --hard HEAD` forces BOTH the index and the
# working tree to the committed HEAD — which is what "restore to HEAD" always intended.
git -C "$SRC" reset --hard HEAD 2>/dev/null || log "WARN could not restore $SRC working tree to HEAD"

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
# sql/ (schemas + migrations) MUST mirror too: init-database.ts (the vessel's
# ExecStartPre) applies sql/schemas + sql/migrations on every start, so a new
# migration committed to origin/dev only takes effect if it reaches the runtime.
# Without this, the runtime sql/ stayed frozen at the image-baked version and
# schema changes (e.g. execution-table field additions) silently never applied
# — the deploy carries the whole vessel, code AND schema, not just src/.
if [ -d "$SRC/sql" ]; then
  rm -rf "$DST/sql"
  cp -r "$SRC/sql" "$DST/sql"
fi
# scripts/ carries init-database.ts + apply-migration helpers the runtime runs;
# mirror so changes to the migration runner itself also deploy.
if [ -d "$SRC/scripts" ]; then
  rm -rf "$DST/scripts"
  cp -r "$SRC/scripts" "$DST/scripts"
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

FINAL_SHA="$(git -C "$SRC" rev-parse HEAD 2>/dev/null || echo '?')"

# POST-MIRROR CHECK. The pre-flight above proves the clone was right BEFORE the
# copy; it cannot prove the copy happened. `reset --hard` runs between them, and
# the copy itself can partially fail. Re-reading HEAD afterwards costs nothing
# and closes the window — a deploy must verify the artifact, not its intention.
if [ -n "$EXPECT_SHA" ]; then
  case "$FINAL_SHA" in
    "$EXPECT_SHA"*) : ;;
    *)
      log "ERROR $VESSEL clone moved to $FINAL_SHA during the mirror (expected $EXPECT_SHA)"
      log "      the live tree may now hold code from neither commit — re-run this deploy"
      exit 1
      ;;
  esac
fi

# Assert the copy actually produced a source tree. `cp` failing after the rm
# leaves an EMPTY live dir, which starts a vessel that crash-loops on a missing
# entrypoint — and until now that exited 0 as "mirrored".
if [ -d "$SRC/src" ] && [ ! -d "$DST/src" ]; then
  log "ERROR $DST/src is missing after the mirror — the copy did not land"
  exit 1
fi

log "$VESSEL mirrored (${FINAL_SHA%"${FINAL_SHA#???????}"}${EXPECT_SHA:+ verified}) -> $DST"
