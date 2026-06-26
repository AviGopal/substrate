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
