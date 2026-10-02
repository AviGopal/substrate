#!/usr/bin/env bash
# federation-pull-sync.sh — pull-side sync for a FEDERATION of substrate instances.
#
# WHY: a federation needs EVERY peer container to converge to upstream
# `origin/<BRANCH>` for ARBITRARY substrate-authored multi-file changes —
# including the "core" vessels discovery-vessel + activity-api (peer-auth and
# evidence-folding live there), not just the per-vessel files a
# `restart-<vessel>` make target knows about (mostly src/index.ts). This script:
#   1. (host) git fetch + ff-only pull origin/<BRANCH> into the shared super-repo
#      mirror (idempotent via a SHA marker; refuses divergence — fails loud).
#   2. diffs PREV..HEAD to find changed repos/<vessel> trees.
#   3. for each changed vessel, for each container in CONTAINERS: docker cp the
#      WHOLE src/ tree (+ sql/ if present) into <container>:/vessels/<vessel>/,
#      then `systemctl restart <unit>` (works for hot AND core vessels alike).
#
# IDIOMATIC / PLUGGABLE: today every instance shares one upstream (origin/dev) via
# REPO_ROOT — "for the time being we trust the upstream repo". A future instance
# with its OWN repo / SVN / share mechanism points REPO_ROOT + REMOTE at its own
# source; the per-container (cp src tree -> restart unit) contract is unchanged.
# Drop a vessel->unit exception into VESSEL_UNIT below if a unit name ever diverges.
#
# TRUST/SAFETY: ff-only pull (never merges divergence); restart only (never
# force-push, never touches git in the containers); DRY-RUN by default (APPLY=1).
#
# Usage:
#   bash federation-pull-sync.sh --once                       # dry-run, both peers
#   APPLY=1 bash federation-pull-sync.sh --once               # act
#   APPLY=1 CONTAINERS="substrate-live substrate-b" bash federation-pull-sync.sh --once
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BRANCH="${BRANCH:-dev}"
REMOTE="${REMOTE:-origin}"
CONTAINERS="${CONTAINERS:-substrate-live substrate-b}"
APPLY="${APPLY:-0}"
MARKER="${MARKER:-$HOME/.federation-pull-sync.sha}"

# vessel -> systemd unit override (default: unit name == vessel name).
declare -A VESSEL_UNIT=(
  [boredom-vessel]=boredom-vessel
)

log() { echo "[fed-pull-sync $(date -Iseconds)] $*" >&2; }
act() { if [[ "$APPLY" == "1" ]]; then "$@"; else log "DRY-RUN would: $*"; fi; }

cd "$REPO_ROOT"

# 1. Fetch + ff-only pull. Divergence is never merged away: a genuinely diverged
#    mirror is refused with a nonzero exit for triage, never reconciled silently.
PREV="$(cat "$MARKER" 2>/dev/null || git rev-parse HEAD)"
git fetch --quiet "$REMOTE" "$BRANCH" || { log "fetch failed — network? skipping"; exit 0; }
CUR_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo DETACHED)"
if [[ "$CUR_BRANCH" != "$BRANCH" ]]; then
  log "on '$CUR_BRANCH', not '$BRANCH' — refusing to switch; skipping"; exit 0
fi
if git merge-base --is-ancestor "$REMOTE/$BRANCH" HEAD 2>/dev/null; then
  log "local $BRANCH at/ahead of $REMOTE — no pull; syncing committed changes since marker"
elif git merge-base --is-ancestor HEAD "$REMOTE/$BRANCH" 2>/dev/null; then
  git pull --ff-only --quiet "$REMOTE" "$BRANCH" || { log "ff-only pull failed; triage"; exit 1; }
  git submodule update --init --quiet 2>/dev/null || log "WARN submodule update had issues (continuing)"
else
  log "local $BRANCH genuinely diverged from $REMOTE/$BRANCH — refusing; triage"; exit 1
fi
HEAD="$(git rev-parse HEAD)"

if [[ "$HEAD" == "$PREV" ]]; then
  log "already current at ${HEAD:0:10} — nothing to sync"; exit 0
fi
log "upstream $BRANCH ${PREV:0:10} -> ${HEAD:0:10}"

# 2. Which repos/<vessel> trees changed?
CHANGED_VESSELS="$(git diff --name-only "$PREV" "$HEAD" -- 'repos/' 2>/dev/null \
  | sed -nE 's#^repos/([^/]+)(/.*)?$#\1#p' | sort -u)"
if [[ -z "$CHANGED_VESSELS" ]]; then
  log "no vessel source changed; marker advanced"; [[ "$APPLY" == "1" ]] && echo "$HEAD" > "$MARKER"; exit 0
fi
log "changed vessels: $(echo "$CHANGED_VESSELS" | tr '\n' ' ')"

# 3. Propagate each changed vessel into each federation container, then restart.
for v in $CHANGED_VESSELS; do
  src="$REPO_ROOT/repos/$v"
  [[ -d "$src/src" ]] || { log "WARN repos/$v has no src/ (submodule/package?) — flag for operator"; continue; }
  unit="${VESSEL_UNIT[$v]:-$v}"
  for c in $CONTAINERS; do
    if ! docker ps --format '{{.Names}}' | grep -qx "$c"; then
      log "container $c not running — skipping"; continue
    fi
    # Only sync into containers that actually run this vessel.
    if ! docker exec "$c" test -d "/vessels/$v" 2>/dev/null; then
      log "$c has no /vessels/$v — skipping"; continue
    fi
    log "$v -> $c: sync src/ (+sql/ if present) + restart $unit"
    act docker cp "$src/src/." "$c:/vessels/$v/src/"
    [[ -d "$src/sql" ]] && act docker cp "$src/sql/." "$c:/vessels/$v/sql/"
    [[ -f "$src/package.json" ]] && act docker cp "$src/package.json" "$c:/vessels/$v/package.json"
    act docker exec "$c" systemctl restart "$unit.service"
  done
done

[[ "$APPLY" == "1" ]] && echo "$HEAD" > "$MARKER" || log "DRY-RUN: marker NOT advanced (APPLY=1 to act + record)"
log "done"
