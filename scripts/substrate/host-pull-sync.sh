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
SUB_MARKER="${SUB_MARKER:-$HOME/.host-pull-sync.submodules}"
CONTAINER="${CONTAINER:-substrate-live}"
APPLY="${APPLY:-0}"
BRANCH="${BRANCH:-dev}"

# Direct-tree vessels that have a `restart-<vessel>` make target (hot-syncable).
HOT_VESSELS="analysis-vessel concept-db development-vessel goal-host-vessel light-dispatch-vessel llm-resolver-vessel local-tools-vessel obsidian-vessel ribosome-vessel stateful-ui-vessel"

log() { echo "[host-pull-sync $(date -Iseconds)] $*" >&2; }
# One vessel's restart failure must NOT abort the whole sync. Measured: concept-db is MASKED on
# a spoke by design (it runs on the hub), so `make restart-concept-db` returned 1, set -e killed
# the run at status=2, and every vessel alphabetically AFTER concept-db was silently never
# synced. An expected topology condition was aborting the entire host sync path. Failures are
# now reported per-vessel and the loop continues; a masked unit is downgraded to a normal skip.
# Every step is BOUNDED. Without the timeout, `docker cp` into a vessel directory that does not
# exist inside the container hangs forever; with TimeoutStartUSec=infinity on this oneshot unit
# that wedged the service in state "activating" for 56 minutes, and because OnUnitActiveSec
# cannot re-fire while the service is active, the timer stopped entirely and NOTHING deployed.
# Making `act` tolerant (so one failure no longer aborts the run) is only safe if no single step
# can hang: tolerance without a bound converts a loud early failure into a silent permanent one.
ACT_TIMEOUT="${ACT_TIMEOUT:-300}"
ACT_FAILURES=0
act() {
  if [[ "$APPLY" != "1" ]]; then log "DRY-RUN would: $*"; return 0; fi
  # Capture the status directly. Inside `if ! cmd; then ... $? ...` the $? belongs to the `if`
  # evaluation, not to cmd, which is why the first version logged the impossible "step FAILED rc=0".
  local rc=0
  timeout "$ACT_TIMEOUT" "$@" 2>&1 || rc=$?
  if (( rc != 0 )); then
    ACT_FAILURES=$((ACT_FAILURES + 1))
    if (( rc == 124 )); then log "!!! step TIMED OUT after ${ACT_TIMEOUT}s (continuing): $*"
    else log "!!! step FAILED rc=$rc (continuing): $*"; fi
  fi
  return 0
}
# True when this substrate does not host the vessel at all — the directory the sync would copy
# into does not exist. HOT_VESSELS DECLARES a fleet; the container IS one. Reconcile against
# reality rather than trusting the list (obsidian-vessel is declared but absent here, which is
# what the unbounded docker cp hung on).
vessel_absent() { ! docker exec "$CONTAINER" test -d "/vessels/$1" 2>/dev/null; }

# True when the unit is masked — i.e. it belongs to the peer substrate, not this one.
# NOTE: `systemctl is-enabled` PRINTS "masked" but EXITS 1. An `|| echo missing` fallback
# therefore appends to the output rather than replacing it, yielding "masked\nmissing", which
# never compares equal to "masked" — the guard silently never fired. Capture the output and
# ignore the exit status separately, and substring-match.
unit_masked() {
  local s
  s="$(docker exec "$CONTAINER" systemctl is-enabled "$1.service" 2>/dev/null)" || true
  [[ "$s" == *masked* ]]
}

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

# 1b. SUBMODULE DRIFT — the commits this script most needs to catch.
#
# Substrate-authored commits land INSIDE repos/<vessel> (pushed to that
# submodule's own origin/dev) and do NOT move the super-repo gitlink until
# someone separately commits the pointer bump. Detecting change by comparing
# only the SUPER-REPO HEAD therefore made this script — and the regression
# detector it carries, whose entire purpose is to catch bad autonomous
# commits — structurally blind to exactly the commits it exists to catch.
#
# Measured before this fix: 62 consecutive "nothing to sync" ticks over ~6h
# while FOUR substrate-authored commits landed in submodules; the last real
# test measurement was 6 hours stale. The detector was not failing — it was
# never being triggered. That is why an autonomous commit once broke the
# tests and went undetected for 5 days.
#
# Per-vessel SHAs are recorded separately from the super-repo marker. First
# observation SEEDS without alerting (same discipline as the test baseline):
# a fresh marker must not stampede a full-fleet resync.
DRIFTED=""
SUB_SEEDING=0
[[ -f "$SUB_MARKER" ]] || { SUB_SEEDING=1; log "submodule marker absent — seeding per-vessel SHAs (no sync on first observation)"; }
SUB_STATE=""
while IFS= read -r sm; do
  [[ -z "$sm" ]] && continue
  v="${sm#repos/}"
  [[ -d "$REPO_ROOT/$sm/.git" || -f "$REPO_ROOT/$sm/.git" ]] || continue
  git -C "$REPO_ROOT/$sm" fetch --quiet origin "$BRANCH" 2>/dev/null || { log "WARN $v: submodule fetch failed (skipping drift check)"; continue; }
  sha="$(git -C "$REPO_ROOT/$sm" rev-parse "origin/$BRANCH" 2>/dev/null || true)"
  [[ -z "$sha" ]] && continue
  SUB_STATE="$SUB_STATE$v=$sha"$'\n'
  prev_sha="$(grep -m1 "^$v=" "$SUB_MARKER" 2>/dev/null | cut -d= -f2 || true)"
  [[ "$SUB_SEEDING" == "1" ]] && continue
  [[ "$sha" == "$prev_sha" ]] && continue
  # Advance the WORKTREE to what landed, so the detector tests the real tree and
  # the sync step copies the real tree. If it cannot fast-forward, do NOT mark it
  # changed — syncing a stale worktree would deploy code that is not what landed.
  sub_branch="$(git -C "$REPO_ROOT/$sm" symbolic-ref --short HEAD 2>/dev/null || echo DETACHED)"
  if [[ "$sub_branch" != "$BRANCH" ]]; then
    log "!!! $v DRIFTED to ${sha:0:10} but its worktree is on '$sub_branch', not '$BRANCH' — NOT syncing (operator triage)"; continue
  fi
  if [[ "$APPLY" != "1" ]]; then
    # NOTE: dry-run deliberately does NOT advance the worktree, so any TEST delta
    # logged below for this vessel measures the OLD tree — it is NOT a verdict on
    # the drifted commit. Only an APPLY=1 run tests what actually landed.
    log "DRY-RUN: $v drifted ${prev_sha:0:10} -> ${sha:0:10} (would fast-forward worktree + sync; TEST delta below reflects the PRE-drift tree)"
    DRIFTED="$DRIFTED$v"$'\n'; continue
  fi
  if ! git -C "$REPO_ROOT/$sm" merge --ff-only --quiet "origin/$BRANCH" 2>/dev/null; then
    log "!!! $v DRIFTED to ${sha:0:10} but ff-only merge FAILED (diverged/dirty) — NOT syncing (operator triage)"; continue
  fi
  log "$v drifted ${prev_sha:0:10} -> ${sha:0:10} (substrate-authored commit; worktree fast-forwarded)"
  DRIFTED="$DRIFTED$v"$'\n'
done < <(git config -f "$REPO_ROOT/.gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}' | grep '^repos/' || true)

DRIFTED="$(echo "$DRIFTED" | sed '/^$/d')"

if [[ "$HEAD" == "$PREV" && -z "$DRIFTED" ]]; then
  log "already current at ${HEAD:0:10} — nothing to sync"
  [[ "$APPLY" == "1" && -n "$SUB_STATE" ]] && printf '%s' "$SUB_STATE" > "$SUB_MARKER"
  exit 0
fi
[[ "$HEAD" != "$PREV" ]] && log "pulled $BRANCH ${PREV:0:10} -> ${HEAD:0:10}"

# 2. Which top-level repos/<x> changed?
CHANGED_PATHS="$(git diff --name-only "$PREV" "$HEAD" -- 'repos/' 2>/dev/null || true)"
# Match both direct-tree files (repos/x/file) AND submodule gitlink changes
# (repos/x with no trailing slash — e.g. an ias-executor-ts pointer bump).
CHANGED_VESSELS="$(printf '%s\n%s\n' "$(echo "$CHANGED_PATHS" | sed -nE 's#^repos/([^/]+)(/.*)?$#\1#p')" "$DRIFTED" | sed '/^$/d' | sort -u)"
if [[ -z "$CHANGED_VESSELS" ]]; then
  log "no vessel source changed; marker advanced"
  if [[ "$APPLY" == "1" ]]; then echo "$HEAD" > "$MARKER"; [[ -n "$SUB_STATE" ]] && printf '%s' "$SUB_STATE" > "$SUB_MARKER"; fi
  exit 0
fi
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

# Resolve bun explicitly. systemd --user does NOT inherit the login shell PATH: the unit runs
# with PATH=/usr/local/sbin:/usr/local/bin:/usr/bin:/home/$USER/.local/bin:... in which $USER is
# literally unexpanded and bun is absent entirely. Measured consequence: every `bun test` failed
# to launch, so all 45 vessels logged "no countable result" and the detector completed while
# measuring NOTHING — the second time this detector shipped blind. The old message actively
# misled, reading as "these vessels have no tests" when the truth was "I cannot run tests at all".
BUN="$(command -v bun 2>/dev/null || true)"
if [[ -z "$BUN" ]]; then
  for c in "${HOME:-/home/avi}/.bun/bin/bun" /usr/local/bin/bun /opt/bun/bin/bun; do
    [[ -x "$c" ]] && { BUN="$c"; break; }
  done
fi
[[ -z "$BUN" ]] && log "!!! DETECTOR BLIND: bun not found (PATH=$PATH) — NO vessel suite can run; this is not 'no tests', it is no instrument"

for v in $CHANGED_VESSELS; do
  [[ -f "$REPO_ROOT/repos/$v/package.json" ]] || continue
  [[ -z "$BUN" ]] && continue
  # Run TWICE and take the MINIMUM. Flaky suites fail intermittently, so noise is additive and the
  # minimum approximates the deterministic failure count. Measured need: development-vessel
  # reported 87 then 91 on consecutive timer runs of the SAME tree (and 82 stably from an
  # interactive shell), which produced a "REGRESSION 87 -> 91" alert that no code change caused.
  # A detector that cries wolf is one nobody reads — precisely the failure the delta design exists
  # to avoid — so a single sample is not admissible evidence of a regression.
  # `|| true` on the extraction is LOAD-BEARING: under `set -euo pipefail` a suite with no
  # "N fail" line makes grep exit 1, pipefail promotes it through tail, the substitution inherits
  # it, and set -e kills the script BEFORE the -z guard can run. Shipped without it, this detector
  # failed 132/132 runs and completed zero — the guard for that case was unreachable code.
  count_fails() { echo "$1" | grep -oE '^ *[0-9]+ fail' | grep -oE '[0-9]+' | tail -1 || true; }
  TEST_OUT="$(cd "$REPO_ROOT/repos/$v" && timeout 300 "$BUN" test 2>&1 || true)"
  FAILS_A="$(count_fails "$TEST_OUT")"
  FAILS="$FAILS_A"
  if [[ -n "$FAILS_A" ]]; then
    TEST_OUT_B="$(cd "$REPO_ROOT/repos/$v" && timeout 300 "$BUN" test 2>&1 || true)"
    FAILS_B="$(count_fails "$TEST_OUT_B")"
    if [[ -n "$FAILS_B" ]]; then
      # Use `if (( )); then`, not `(( )) && cmd`. A bare `(( expr ))` returns exit status 1 when the
      # expression is FALSE, which under `set -e` is fatal as a standalone statement. Verified
      # empirically: the `&&` form is EXEMPT (it is a non-final command in an && list) and survives,
      # so this is defensive clarity rather than a bug fix — but the bare form one refactor away is
      # fatal on exactly the common case (two runs agreeing), so the `if` form is the safe idiom.
      if (( FAILS_B < FAILS_A )); then FAILS="$FAILS_B"; TEST_OUT="$TEST_OUT_B"; fi
      if (( FAILS_A != FAILS_B )); then
        log "TEST $v — FLAKY: $FAILS_A vs $FAILS_B on identical source; using $FAILS. Deltas on this vessel are only trustworthy beyond that spread."
      fi
    fi
  fi
  [[ -z "$FAILS" ]] && { log "TEST $v — no countable result (suite errored or absent); skipping delta"; continue; }
  # Third instance of the pipefail class in this block (see the two above). The FIRST run for any
  # vessel has no baseline line, so grep exits 1 and kills the script before it can record one —
  # the detector could therefore never bootstrap itself. 2>/dev/null hides grep's stderr, not its
  # exit status. Sweep the whole block when touching any of these, not just the reported line.
  PREV_FAILS="$(grep -m1 "^$v=" "$BASELINE_FILE" 2>/dev/null | cut -d= -f2 || true)"
  if [[ -z "$PREV_FAILS" ]]; then
    log "TEST $v — baseline recorded at $FAILS fail (no alert on first observation)"
  elif (( FAILS > PREV_FAILS )); then
    log "!!! TEST REGRESSION in $v: $PREV_FAILS -> $FAILS failing, after ${PREV:0:10} -> ${HEAD:0:10}"
    # Same class as above: `head -20` closes the pipe early, grep takes SIGPIPE, pipefail makes
    # the REPORTING branch itself fatal. A detector whose alert path kills the detector is worse
    # than no detector — it fails exactly when it has something to say.
    { echo "$TEST_OUT" | grep '(fail)' || true; } | head -20 | while IFS= read -r l; do log "!!!   $l"; done
    # Attribute to the VESSEL's own tip, not the super-repo sha: repos/* are
    # submodules, so $HEAD names a pointer bump whose author is whoever moved the
    # pointer — not whoever wrote the code that just went red.
    log "!!! vessel tip: $(cd "$REPO_ROOT/repos/$v" && git log -1 --format='%h %an — %s' 2>/dev/null | cut -c1-100 || true)"
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
  if [[ "$v" == "obsidian-vessel" ]]; then
    # THE HUMAN SURFACE NEEDS A BUILD, NOT A RESTART.
    #
    # obsidian-vessel is listed in HOT_VESSELS but is not a container unit, so the
    # branch below skipped it as "not hosted here" and nothing took its place. Obsidian
    # loads a BUILT main.js; the TS source is never read at runtime. The vault's
    # main.js / manifest.json / styles.css are SYMLINKS into repos/obsidian-vessel, so
    # no install step is needed — but nothing rebuilt the bundle either.
    #
    # Measured 2026-08-07: the source had moved 228 commits ahead of a main.js last
    # built on July 9. Every substrate-authored UI change for a month landed on
    # origin/dev and was invisible in the running panel — the "declared != running"
    # class applied to the entire human surface, and the reason a UI gap could not be
    # observed closing no matter how well it routed.
    #
    # Build here so a landed UI change becomes a live UI change within one timer tick,
    # which is what makes the behaviour casually observable rather than a manual
    # ceremony. Non-fatal by design: a failed build must not wedge the rest of the
    # sync, and the panel simply keeps running the previous bundle.
    log "obsidian-vessel changed -> rebuilding plugin bundle (vault artifacts are symlinks into the repo)"
    if act bash "$REPO_ROOT/scripts/substrate/obsidian-plugin-reload.sh"; then
      log "obsidian-vessel bundle rebuilt — panel picks it up on next plugin load"
    else
      log "!!! obsidian-vessel build FAILED — panel still runs the previous bundle; UI changes are NOT live"
    fi
  elif [[ "$v" == "ias-executor-ts" ]]; then
    log "ias-executor-ts changed -> rebuild dist + push to all consumers + restart"
    act make -C "$MAKE_DIR" sync-ias-executor-ts RESTART=1
  elif [[ "$IAS_CHANGED" == "1" ]] && echo " $IAS_CONSUMERS " | grep -q " $v "; then
    log "$v changed but is an ias-executor-ts consumer — sync-ias RESTART=1 already covers it; skipping double-restart"
  elif echo " $HOT_VESSELS " | grep -q " $v "; then
    if [[ "$APPLY" == "1" ]] && vessel_absent "$v"; then
      log "$v changed but /vessels/$v does not exist in $CONTAINER — not hosted here; skipping"
      continue
    fi
    if [[ "$APPLY" == "1" ]] && unit_masked "$v"; then
      log "$v changed but is MASKED here (runs on the peer substrate) — skipping restart, not an error"
      continue
    fi
    log "$v changed -> restart-$v (sync source + restart unit)"
    act make -C "$MAKE_DIR" "restart-$v"
  else
    log "WARN $v changed but has no hot-sync target (submodule / needs image rebuild) — flag for operator"
  fi
done

if [[ "$APPLY" == "1" ]]; then
  echo "$HEAD" > "$MARKER"
  # Record per-vessel SHAs too, or every tick re-detects the same drift forever.
  [[ -n "$SUB_STATE" ]] && printf '%s' "$SUB_STATE" > "$SUB_MARKER"
else
  log "DRY-RUN: marker NOT advanced (set APPLY=1 to act + record)"
fi
# The marker advances even after a failed step, deliberately: blocking it on a PERSISTENT failure
# would retry forever and re-wedge the loop. But a partial sync must not report as a clean one —
# say so on the line an operator actually reads.
if (( ACT_FAILURES > 0 )); then log "done — PARTIAL: $ACT_FAILURES step(s) failed; marker advanced anyway (see !!! lines above)"
else log "done"; fi
