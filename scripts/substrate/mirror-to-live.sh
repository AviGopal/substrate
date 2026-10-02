#!/usr/bin/env bash
# mirror-to-live.sh — mirror a vessel's git clone into the live /vessels runtime.
#
#   mirror-to-live.sh <vessel> [clone-dir] [expect-sha] [ref]
#
# [ref] (or MIRROR_REF) mirrors that commit instead of HEAD — see MATERIALISE A
# REF below; the clone itself never leaves its branch.
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

VESSEL="${1:?usage: mirror-to-live.sh <vessel> [clone-dir] [expect-sha] [ref]}"
CLONE_DIR="${2:-${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}}"
RUNTIME_DIR="${MITOSIS_RUNTIME_DIR:-/vessels}"

SRC="$CLONE_DIR/$VESSEL"
DST="$RUNTIME_DIR/$VESSEL"
log() { echo "[mirror-to-live] $*"; }

[ -d "$SRC/.git" ] || { log "no clone at $SRC — nothing to mirror"; exit 1; }
CLONE="$SRC"

# MATERIALISE A REF, NOT JUST HEAD. pull-sync's unhealthy revert used to
# `git checkout PREV_GOOD -- .` in the clone and then call this script — whose
# `reset --hard HEAD` below discarded that checkout and mirrored HEAD, the very
# code being reverted, while the caller logged "reverted". A revert target is
# therefore an INPUT here: with a ref, the clone is still restored to HEAD (that
# protection is unchanged), then the ref is checked out into a throwaway detached
# worktree and everything below copies from it. The clone never leaves its branch;
# the worktree is removed on exit. Omitted, behaviour is exactly as before.
REF="${4:-${MIRROR_REF:-}}"
REF_SHA=""; REF_WT=""
if [ -n "$REF" ]; then
  REF_SHA="$(git -C "$CLONE" rev-parse -q --verify "$REF^{commit}" 2>/dev/null || true)"
  [ -n "$REF_SHA" ] || { log "ERROR $VESSEL: ref $REF is not a commit in $CLONE — REFUSING to mirror; the live tree is untouched"; exit 1; }
fi
# What the deploy is about to ship: the ref when given, else the clone's HEAD.
target_sha() { if [ -n "$REF_SHA" ]; then git -C "$SRC" rev-parse HEAD 2>/dev/null; else git -C "$CLONE" rev-parse HEAD 2>/dev/null; fi; }

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
  ACTUAL_SHA="${REF_SHA:-$(git -C "$CLONE" rev-parse HEAD 2>/dev/null || echo "")}"
  if [ -z "$ACTUAL_SHA" ]; then
    log "ERROR cannot read HEAD of $SRC — refusing to mirror against an expected SHA"
    exit 1
  fi
  # Prefix match so a caller may pass a short or full SHA.
  case "$ACTUAL_SHA" in
    "$EXPECT_SHA"*) : ;;
    *)
      log "ERROR $VESSEL ${REF_SHA:+ref $REF resolves to}${REF_SHA:-clone is at} ${ACTUAL_SHA%"${ACTUAL_SHA#???????}"}… but the deploy asked for $EXPECT_SHA"
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
git -C "$CLONE" reset --hard HEAD 2>/dev/null || log "WARN could not restore $CLONE working tree to HEAD"
if [ -n "$REF_SHA" ]; then
  REF_WT="$(mktemp -d "${TMPDIR:-/tmp}/mirror-$VESSEL-ref.XXXXXX")" || { log "ERROR cannot create a worktree dir for $REF"; exit 1; }
  rmdir "$REF_WT"
  trap 'git -C "$CLONE" worktree remove --force "$REF_WT" >/dev/null 2>&1; rm -rf "$REF_WT"; git -C "$CLONE" worktree prune >/dev/null 2>&1' EXIT
  git -C "$CLONE" worktree prune >/dev/null 2>&1 || true
  if ! git -C "$CLONE" worktree add -q --detach "$REF_WT" "$REF_SHA" >/dev/null 2>&1; then
    log "ERROR $VESSEL: cannot check out $REF into a worktree — REFUSING to mirror; the live tree is untouched"; exit 1
  fi
  SRC="$REF_WT"
  log "$VESSEL: mirroring ref $REF (${REF_SHA%"${REF_SHA#???????}"}) — clone stays at $(git -C "$CLONE" rev-parse --short HEAD 2>/dev/null)"
fi

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
# The directories copied here (src/, sql/, scripts/, and the tracked build
# output below) MUST equal the ones substrate-pull-sync.sh's content_hash
# fingerprints; a directory copied here but not hashed there never converges.
if [ -d "$SRC/scripts" ]; then
  rm -rf "$DST/scripts"
  cp -r "$SRC/scripts" "$DST/scripts"
fi
# TRACKED BUILD OUTPUT — a dist/ the vessel repo COMMITS (human-surface-vessel's
# ui/dist: its .gitignore says git is the only channel by which a UI change
# reaches a running surface, since nothing rebuilds on pull). The three copies
# above never carried it, so a UI commit was pulled into the clone and the
# runtime kept serving the previous bundle — index.html naming an asset hash the
# clone no longer had. Which dirs count is READ FROM GIT, not listed here:
# tracked_output_dirs below. Root dist/ is excluded by rule — that one is the
# gitignored package build pull-sync's fan-out owns (.dist.stage/.dist.prev).
# THIS FUNCTION MUST EQUAL substrate-pull-sync.sh's tracked_output_dirs, which
# feeds content_hash; a dir mirrored here but not hashed there never converges.
tracked_output_dirs() { # clone-root -> one dir per line (e.g. ui/dist), sorted, may be empty
  git -C "$1" ls-files 2>/dev/null \
    | awk '/^(src|sql|scripts|dist)\// || /(^|\/)node_modules\// {next}
           { n = index($0, "/dist/"); if (n > 0) print substr($0, 1, n + 4) }' \
    | LC_ALL=C sort -u
}
# Swapped in whole, exactly as pull-sync swaps a package dist: stage the TRACKED
# files beside the live dir as .dist.stage, move live aside to .dist.prev, rename
# the stage in, drop prev. Staging from the tracked list (not cp -r of the
# working tree) is what drops assets a commit deleted; the rename means a
# request mid-mirror reads either the old bundle or the new one, never a mix of the two. (Between the two renames ui/dist is briefly absent, so a
# request in that window can 404 — microseconds; a tab still holding the old index.html
# will 404 its deleted assets until reloaded.)
while IFS= read -r _od; do
  [ -n "$_od" ] || continue
  _parent="$DST/$(dirname "$_od")"; _live="$DST/$_od"
  _stage="$_parent/.dist.stage"; _prev="$_parent/.dist.prev"
  mkdir -p "$_parent" && rm -rf "$_stage" && mkdir -p "$_stage" || { log "ERROR cannot stage $_od"; exit 1; }
  if ! (cd "$SRC/$_od" && git -C "$SRC" ls-files -z -- "$_od" \
          | sed -z "s|^$_od/||" | tar --null -T - -cf -) | (cd "$_stage" && tar -xf -); then
    rm -rf "$_stage"; log "ERROR staging tracked $_od failed — live $_od untouched"; exit 1
  fi
  rm -rf "$_prev"
  [ -e "$_live" ] && mv "$_live" "$_prev"
  mv "$_stage" "$_live" || { [ -e "$_prev" ] && mv "$_prev" "$_live"; log "ERROR swapping $_od failed"; exit 1; }
  rm -rf "$_prev"
done <<EOF
$(tracked_output_dirs "$SRC")
EOF
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

FINAL_SHA="$(target_sha || echo '?')"

# POST-MIRROR CHECK. The pre-flight above proves the clone was right BEFORE the
# copy; it cannot prove the copy happened. `reset --hard` runs between them, and
# the copy itself can partially fail. Re-reading HEAD afterwards costs nothing
# and closes the window — a deploy must verify the artifact, not its intention.
if [ -n "$EXPECT_SHA" ]; then
  case "$FINAL_SHA" in
    "$EXPECT_SHA"*) : ;;
    *)
      log "ERROR $VESSEL ${REF_SHA:+ref worktree}${REF_SHA:-clone} moved to $FINAL_SHA during the mirror (expected $EXPECT_SHA)"
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
while IFS= read -r _od; do
  [ -z "$_od" ] || [ -d "$DST/$_od" ] || { log "ERROR $DST/$_od is missing after the mirror — the swap did not land"; exit 1; }
done <<EOF
$(tracked_output_dirs "$SRC")
EOF

log "$VESSEL mirrored (${FINAL_SHA%"${FINAL_SHA#???????}"}${REF_SHA:+ from ref $REF}${EXPECT_SHA:+ verified}) -> $DST"
