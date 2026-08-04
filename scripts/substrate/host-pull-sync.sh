#!/usr/bin/env bash
# host-pull-sync.sh — Pull-side companion to host-sync-poller.sh.
#
# WHY: host-sync-poller handles the PUSH direction (substrate-authored cutovers
# → host commit → push dev). The PULL direction — bringing committed `dev`
# changes into the RUNNING vessels — was manual (`make sync-<vessel>` by hand).
# This closes the loop: fetch + ff-only pull `dev`, detect which vessels' source
# changed, and re-sync/restart only those inside substrate-live. Together they
# make the substrate self-syncing with the repos (CLAUDE.md "keep synced").
#
# SAFETY: pull is `--ff-only` (refuses divergent merges — fails loud, never
# merges); only vessels with a hot-sync make target are restarted; submodule
# vessels that need an image rebuild are flagged, not silently skipped;
# idempotent via a last-synced-SHA marker; dry-run by default (APPLY=1 to act).
#
# Operator install (one-time, mirrors host-sync-poller): the .service unit
# carries an absolute path, rendered from host-pull-sync.service.in at install
# time (systemd cannot expand env vars in unit-file locations). Use:
#   make -C scripts/substrate install-host-sync
#   systemctl --user enable --now host-pull-sync.timer
#
# Direct: bash scripts/substrate/host-pull-sync.sh --once          # dry-run
#         APPLY=1 bash scripts/substrate/host-pull-sync.sh --once  # act
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MAKE_DIR="$REPO_ROOT/scripts/substrate"
MARKER="${MARKER:-$HOME/.host-pull-sync.sha}"
CONTAINER="${CONTAINER:-substrate-live}"
APPLY="${APPLY:-0}"
BRANCH="${BRANCH:-dev}"

# Direct-tree vessels that have a `restart-<vessel>` make target (hot-syncable).
HOT_VESSELS="analysis-vessel concept-db development-vessel goal-host-vessel light-dispatch-vessel llm-resolver-vessel local-tools-vessel obsidian-vessel ribosome-vessel stateful-ui-vessel"

log() { echo "[host-pull-sync $(date -Iseconds)] $*" >&2; }
act() { if [[ "$APPLY" == "1" ]]; then "$@"; else log "DRY-RUN would: $*"; fi; }

cd "$REPO_ROOT"

# 0. Container must be up to sync into it (act mode only).
if [[ "$APPLY" == "1" ]] && ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  log "container $CONTAINER not running — skipping (will retry next tick)"; exit 0
fi

# 1. Fetch + fast-forward pull dev. --ff-only refuses divergence (fails loud).
PREV="$(cat "$MARKER" 2>/dev/null || git rev-parse HEAD)"
git fetch --quiet origin "$BRANCH" || { log "fetch failed — network? skipping"; exit 0; }
CUR_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo DETACHED)"
if [[ "$CUR_BRANCH" != "$BRANCH" ]]; then
  log "on '$CUR_BRANCH', not '$BRANCH' — refusing to switch (operator/dev-flow owns checkout); skipping"; exit 0
fi
# Three cases vs origin: behind (ff-pull), at/ahead (sync local commits since
# marker, no pull), or genuinely diverged (refuse).
if git merge-base --is-ancestor "origin/$BRANCH" HEAD 2>/dev/null; then
  log "local $BRANCH at/ahead of origin — no pull; will sync committed changes since marker"
elif git merge-base --is-ancestor HEAD "origin/$BRANCH" 2>/dev/null; then
  git pull --ff-only --quiet origin "$BRANCH" || { log "ff-only pull failed; triage"; exit 1; }
  git submodule update --init --quiet 2>/dev/null || log "WARN submodule update had issues (continuing)"
else
  log "local $BRANCH genuinely diverged from origin/$BRANCH — refusing; triage manually"; exit 1
fi
HEAD="$(git rev-parse HEAD)"

if [[ "$HEAD" == "$PREV" ]]; then
  log "already current at ${HEAD:0:10} — nothing to sync"; exit 0
fi
log "pulled $BRANCH ${PREV:0:10} -> ${HEAD:0:10}"

# 2. Which top-level repos/<x> changed?
CHANGED_PATHS="$(git diff --name-only "$PREV" "$HEAD" -- 'repos/' 2>/dev/null || true)"
# Match both direct-tree files (repos/x/file) AND submodule gitlink changes
# (repos/x with no trailing slash — e.g. an ias-executor-ts pointer bump).
CHANGED_VESSELS="$(echo "$CHANGED_PATHS" | sed -nE 's#^repos/([^/]+)(/.*)?$#\1#p' | sort -u)"
[[ -z "$CHANGED_VESSELS" ]] && { log "no vessel source changed; marker advanced"; echo "$HEAD" > "$MARKER"; exit 0; }
log "changed vessels: $(echo "$CHANGED_VESSELS" | tr '\n' ' ')"

# Consumers that `sync-ias-executor-ts RESTART=1` already restarts — skip their
# individual restart below if ias-executor-ts is in this batch (avoid double-restart
# churn, which can briefly stall the autonomous loop).
IAS_CONSUMERS="goal-host-vessel ribosome-vessel boredom-vessel development-vessel local-tools-vessel llm-resolver-vessel analysis-vessel"
IAS_CHANGED=0; echo "$CHANGED_VESSELS" | grep -qx "ias-executor-ts" && IAS_CHANGED=1

# 2b. REGRESSION DETECTOR (out-of-band). Run each changed vessel's own test suite
# against what just landed on origin/dev, BEFORE restarting it.
#
# Why here and nowhere else: this script runs as the operator's systemd --user
# timer on the HOST. The container mounts only named volumes — it cannot read or
# rewrite this file, cannot reach the host user's systemd, and has no credential
# to disable the timer. An equivalent check placed inside the container, or in a
# repo the substrate can author, is a file the substrate can edit; it is
# documentation, not a detector.
#
# DETECTION ONLY — never blocks the restart. Prevention was declined deliberately,
# and a blocking gate here could wedge the whole fleet on one red suite. The point
# is that a red suite becomes VISIBLE within one timer tick instead of sitting
# unnoticed: 4fa92b3 (substrate-authored) turned repairSignatureOf async on 07-30
# and left goal-host at 135 pass / 9 fail for five days, because no vessel repo has
# CI and `bun run lint` covers one of six test files. A full goal-host run costs
# ~220ms, so this is effectively free.
# It alerts on an INCREASE in failures, not on redness. Absolute redness is
# useless here and would have shipped as permanent noise: measured on this host,
# activity-api is 369 pass / 152 fail because most of its suite wants a live
# SurrealDB that is inside the container, not on the host. A detector that fires
# every run is a detector nobody reads. A regression is a DELTA, so the baseline
# per vessel lives in .pullsync-testbaseline and only a rise is reported.
BASELINE_FILE="${BASELINE_FILE:-$REPO_ROOT/.pullsync-testbaseline}"
for v in $CHANGED_VESSELS; do
  [[ -f "$REPO_ROOT/repos/$v/package.json" ]] || continue
  TEST_OUT="$(cd "$REPO_ROOT/repos/$v" && timeout 300 bun test 2>&1 || true)"
  FAILS="$(echo "$TEST_OUT" | grep -oE '^ *[0-9]+ fail' | grep -oE '[0-9]+' | tail -1)"
  [[ -z "$FAILS" ]] && { log "TEST $v — no countable result (suite errored or absent); skipping delta"; continue; }
  PREV_FAILS="$(grep -m1 "^$v=" "$BASELINE_FILE" 2>/dev/null | cut -d= -f2)"
  if [[ -z "$PREV_FAILS" ]]; then
    log "TEST $v — baseline recorded at $FAILS fail (no alert on first observation)"
  elif (( FAILS > PREV_FAILS )); then
    log "!!! TEST REGRESSION in $v: $PREV_FAILS -> $FAILS failing, after ${PREV:0:10} -> ${HEAD:0:10}"
    echo "$TEST_OUT" | grep '(fail)' | head -20 | while IFS= read -r l; do log "!!!   $l"; done
    # Attribute to the VESSEL's own tip, not the super-repo sha: repos/* are
    # submodules, so $HEAD names a pointer bump whose author is whoever moved the
    # pointer — not whoever wrote the code that just went red.
    log "!!! vessel tip: $(cd "$REPO_ROOT/repos/$v" && git log -1 --format='%h %an — %s' 2>/dev/null | cut -c1-100)"
    log "!!! restart proceeds anyway (detector, not gate) — triage manually"
  elif (( FAILS < PREV_FAILS )); then
    log "TEST $v improved: $PREV_FAILS -> $FAILS failing"
  fi
  # Record unconditionally: a ratcheted baseline would hide the SECOND regression
  # behind the first, and an unrepaired rise must not re-alert on every later push.
  if [[ "$APPLY" == "1" ]]; then
    touch "$BASELINE_FILE"
    grep -v "^$v=" "$BASELINE_FILE" > "$BASELINE_FILE.tmp" 2>/dev/null || true
    echo "$v=$FAILS" >> "$BASELINE_FILE.tmp"
    mv "$BASELINE_FILE.tmp" "$BASELINE_FILE"
  fi
done

# 3. Re-sync the hot-syncable ones; ias-executor-ts fans out to all consumers.
for v in $CHANGED_VESSELS; do
  if [[ "$v" == "ias-executor-ts" ]]; then
    log "ias-executor-ts changed -> rebuild dist + push to all consumers + restart"
    act make -C "$MAKE_DIR" sync-ias-executor-ts RESTART=1
  elif [[ "$IAS_CHANGED" == "1" ]] && echo " $IAS_CONSUMERS " | grep -q " $v "; then
    log "$v changed but is an ias-executor-ts consumer — sync-ias RESTART=1 already covers it; skipping double-restart"
  elif echo " $HOT_VESSELS " | grep -q " $v "; then
    log "$v changed -> restart-$v (sync source + restart unit)"
    act make -C "$MAKE_DIR" "restart-$v"
  else
    log "WARN $v changed but has no hot-sync target (submodule / needs image rebuild) — flag for operator"
  fi
done

[[ "$APPLY" == "1" ]] && echo "$HEAD" > "$MARKER" || log "DRY-RUN: marker NOT advanced (set APPLY=1 to act + record)"
log "done"
