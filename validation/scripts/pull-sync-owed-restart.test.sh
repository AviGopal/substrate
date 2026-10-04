#!/usr/bin/env bash
# pull-sync takes an owed restart even when the content moved after it was owed
# (scripts/substrate/substrate-pull-sync.sh, the "AN OWED RESTART OUTRANKS THE
# CONTENT SHORT-CIRCUIT" block). Runs that block, taken from the script itself,
# against temp marker/runtime dirs with systemctl stubbed to record restarts.
#
# The failure it pins: a restart deferred for in-flight work was recorded as
# PENDING keyed on the clone's content hash, and the clone advanced in the same
# tick (mirror copied the newer commit). Every later tick compared the marker to
# a hash that no longer exists, so the owed restart was never taken and the unit
# served code older than its own files — green health, nothing loaded.
#
#   (a) pending recorded for an OLDER content hash -> restart taken, marker cleared
#   (b) pending for the current hash -> restart taken (control)
#   (c) no marker, first sight of the unit -> baselined, no restart (control)
#   (d) no marker, non-test content changed under the same unit start -> restart
#       taken (the by-effect detector: loaded code is older than the code on disk)
#   (g) only a TEST file changed under the same start -> no restart: mirror's
#       `cp -r` refreshes every mtime, so the detector must not read mtime
#   (h) content changed but the unit restarted since the baseline -> re-baseline,
#       no restart (the unit loaded what was on disk when it started)
#   (e) owed restart while work is in flight -> deferred, counter increments,
#       marker kept, no restart
#   (f) unit inactive -> marker cleared, no restart
#   (i) owed restart deferred RESTART_DEFER_MAX times and work still in flight ->
#       quiesce (admission marker written, then removed), drain to 0, restart taken
#   (j) same, but in-flight never drains within the bound -> restart taken anyway,
#       the loss is logged, the quiesce marker is removed
#   (k) at the cap but the deferral is an open probe window -> no quiesce, no restart,
#       still deferred (a probe window is not starvation)
#
# THE MIRROR PATH'S QUIESCE COVERS DRAIN + MIRROR + RESTART, NOT THE GATE (l-o). Runs the
# script's own in-flight block (`if [ -z "$DEFER_MARKER" ]` .. the 3-pre test gate), whatever
# it runs between the gate's verdict and the mirror (after `rm -f …testgate-refusals`, up to
# PREV_GOOD=, with mirror_quiesce_drain when defined), and its restart block (`# 3. Restart`
# .. the restart's stagger sleep), with the test gate and the mirror replaced by stubs that
# record whether the admission marker is held, and the REAL restart_age_defer reading a
# /health stub. The gate reads only the clone, so admission stays OPEN through it.
# The vessel is modelled, not canned: in_flight is a counter, `sleep` drains it by one,
# and a request that tries to start during the gate is admitted only while the
# quiesce marker is absent (development-vessel's quiesced() check).
# Measured 2026-10-03 (node 1): drained 19:41:55, the marker was removed at once, the
# gate ran to 19:47:00, a compose was admitted ~19:45:20, and the restart logged
# "DEFERRING restart — 1 in flight" at 19:47:01: the drain bought nothing.
#   (l) 1 in flight, a request arrives during the gate and another during the mirror ->
#       the marker is ABSENT while the gate runs (the gate request is admitted), and HELD
#       from the drain's first wait through the mirror to the restart; the drain follows
#       the gate and drains both; the mirror request is REFUSED; restart taken this tick,
#       no "DEFERRING restart", marker released after the restart
#   (l2) qrace control: a request arriving between drain and restart is REFUSED, and the
#       restart is taken this tick without deferring
#   (l3) the gate refuses the commit -> admission was never closed (no quiesce at all)
#   (l4) the tick budget is spent by the time the gate passes, 1 still in flight -> the
#       bound path ("converging anyway"), never a false "drained to 0"
#   (m) control: nothing in flight -> no quiesce, no marker, gate, mirror, restart
#   (n) the quiesce hits its bound (never drains) while the compose PROGRESSED 30 s
#       ago -> NO restart: the tick budget ran out, not the compose. The marker stays
#       held past the tick (carry recorded) and the restart is owed
#   (n2) control, no progress field: the announced "converging anyway" is honoured:
#       restart taken, not deferred; marker released (today's behaviour)
#   (n3) progress published but silent past the stall bound -> restart, released
#   (n4) progressing but owed past the max hold -> LOSSY restart, released
#   (o) structural: the release runs first in every vessel-loop pass (every
#       `continue` lands there), after the loop, and in the EXIT trap
#
# THE MARKER SELF-EXPIRES (q). An EXIT trap does not run on SIGKILL (systemd's TimeoutStartSec
# kill), so a killed tick left admission closed until development-vessel's 20-min mtime bound.
# Every marker pull-sync writes or re-touches carries expires_at (ISO-8601 UTC): the tick's
# start + the unit's TimeoutStartSec while the tick holds it; now + 20 min for a CARRIED hold,
# which is meant to outlive the tick (the vessel's own staleness bound, so a carry is unchanged).
#   (q1) the owed path's quiesce_drain marker carries the tick expiry
#   (q2) the mirror path's marker, as the mirror sees it, carries the tick expiry
#   (q3) a carried hold's marker carries the carry horizon (now + 20 min), not the tick expiry
#   (q4) structural: UNIT_TIMEOUT_S's default equals the unit file's TimeoutStartSec
#
# usage: validation/scripts/pull-sync-owed-restart.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, awk, sed, find, GNU date/touch. No root: every path is a temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── the code under test, taken from the script itself ─────────────────────────
{
  sed -n '/^content_hash_nontest() {/,/^}/p' "$SCRIPT"
  sed -n '/^loaded_code_stale() {/,/^}/p' "$SCRIPT"
  sed -n '/^quiesce_drain() {/,/^}/p' "$SCRIPT"
  sed -n '/^quiesce_mark() {/,/^}/p' "$SCRIPT"
  sed -n '/^quiesce_release() {/,/^}/p' "$SCRIPT"
  sed -n '/^owed_hold_bound() {/,/^}/p' "$SCRIPT"
  echo 'run_block() {'
  echo 'for v in "$VESSEL"; do'
  awk '/^  # AN OWED RESTART OUTRANKS THE CONTENT SHORT-CIRCUIT/{on=1} on && /^  if \[ "\$CLONE_HASH" = "\$RUNTIME_HASH" \]; then$/{exit} on{print}' "$SCRIPT"
  echo 'done'
  echo '}'
} > "$T/fns.sh"
grep -q 'PENDING_FILE=' "$T/fns.sh" || { echo "FAIL - could not extract the owed-restart block"; exit 1; }

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
UNIT_ACTIVE=1; UNIT_STARTED=""   # UNIT_STARTED: a `date -d` string, the unit's last start
systemctl() {
  case "$1" in
    is-active) [ "$UNIT_ACTIVE" = 1 ] ;;
    restart) echo "RESTART $2" >> "$CALLS" ;;
    show) [ "$2" = "-p" ] && [ "$3" = "ActiveEnterTimestamp" ] && echo "$UNIT_STARTED" ;;
    is-enabled) echo "${UNIT_ENABLED:-enabled}" ;;
    *) : ;;
  esac
}
vessel_unit() { echo "$1.service"; }
health_port() { echo 9999; }
DEFER=0
PROBE=0
restart_age_defer() { RA_INFLIGHT=0; RA_OLDEST=""; RA_DEFER="$DEFER"; RA_WHY=""; RA_PROBE="$PROBE"; [ "$DEFER" = 1 ] && { RA_INFLIGHT=2; RA_WHY="2 in flight"; }; return 0; }
restart_breadcrumb() { :; }
HEALTH_SEQ_FILE="$T/health-seq"   # one in_flight value per line, one per /health call; the last repeats
health_seq() { printf '%s\n' "$@" > "$HEALTH_SEQ_FILE"; }
curl() {   # runs inside $( ), so the sequence must live in a file, not a variable
  local first; first="$(head -1 "$HEALTH_SEQ_FILE" 2>/dev/null)"
  [ "$(wc -l < "$HEALTH_SEQ_FILE" 2>/dev/null || echo 0)" -gt 1 ] && sed -i 1d "$HEALTH_SEQ_FILE"
  [ -n "$QDIR_SEEN_FILE" ] && [ -e "$QUIESCE_DIR/$VESSEL" ] && cp "$QUIESCE_DIR/$VESSEL" "$QDIR_SEEN_FILE"
  printf '{"in_flight":%s}' "${first:-0}"
}
sleep() { :; }
# shellcheck disable=SC1090
source "$T/fns.sh"

VESSEL=demo-vessel
RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; STAGGER_SECONDS=0
QUIESCE_DIR="$T/quiesce"; QUIESCE_STEP_S=1; QUIESCE_WAIT_S=5; UNIT_TIMEOUT_S=900; QUIESCE_MARGIN_S=0; QDIR_SEEN_FILE=""
PULLSYNC_TICK_T0=$(( $(date +%s) - 800 ))   # this tick started 800 s ago: its expiry (T0 + 900) is 100 s away
EXP_TICK="$(date -u -d "@$(( PULLSYNC_TICK_T0 + 900 ))" +%Y-%m-%dT%H:%M:%SZ)"
expires_of() { jq -r '.expires_at // empty' "$1" 2>/dev/null || true; }
P="$MARKER_DIR/$VESSEL.restart-pending"; DF="$MARKER_DIR/$VESSEL.restart-deferrals"

setup() { # a running unit and its runtime src
  rm -rf "$RUNTIME_DIR" "$MARKER_DIR"; mkdir -p "$RUNTIME_DIR/$VESSEL/src" "$MARKER_DIR"
  echo 'export const x = 1;' > "$RUNTIME_DIR/$VESSEL/src/x.ts"
  echo 'test("x", () => {});' > "$RUNTIME_DIR/$VESSEL/src/x.test.ts"
  UNIT_STARTED="Sat 2026-10-03 10:26:55 UTC"
  UNIT_ACTIVE=1; DEFER=0; PROBE=0; CLONE_HASH=newhash; : > "$CALLS"; : > "$LOG"
}
restarted() { grep -q "^RESTART $VESSEL.service$" "$CALLS"; }

# ── (a) marker for an older hash, content advanced since ───────────────────────
setup; echo oldhash > "$P"; echo 1 > "$DF"
run_block
if restarted && [ ! -e "$P" ] && [ ! -e "$DF" ]; then ok "(a) pending for an older hash: restart taken, markers cleared"
else bad "(a) pending for an older hash: expected a restart and cleared markers (calls: $(tr '\n' ' ' < "$CALLS"); pending $( [ -e "$P" ] && echo kept || echo cleared))"; fi

# ── (b) marker for the current hash (control) ──────────────────────────────────
setup; echo newhash > "$P"
run_block
if restarted && [ ! -e "$P" ]; then ok "(b) pending for the current hash: restart taken"
else bad "(b) pending for the current hash: expected a restart"; fi

# ── (c) first sight: baseline, no restart (control) ────────────────────────────
setup
run_block
if ! restarted && [ -s "$MARKER_DIR/$VESSEL.loaded" ]; then ok "(c) first sight of a running unit: baselined, no restart"
else bad "(c) first sight of a running unit: expected a baseline and no restart (calls: $(tr '\n' ' ' < "$CALLS"))"; fi

# ── (d) non-test content changed under the same start ──────────────────────────
setup; run_block; : > "$CALLS"
echo 'export const x = 2;' > "$RUNTIME_DIR/$VESSEL/src/x.ts"
run_block
if restarted && grep -qi "older than" "$LOG"; then ok "(d) non-test content changed under a running unit: restart taken and said why"
else bad "(d) non-test content changed under a running unit: expected a restart with a reason (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (g) only a test file changed: no restart ───────────────────────────────────
setup; run_block; : > "$CALLS"
echo 'test("x2", () => {});' >> "$RUNTIME_DIR/$VESSEL/src/x.test.ts"
touch "$RUNTIME_DIR/$VESSEL/src/x.ts"   # what cp -r does to every file
run_block
if ! restarted; then ok "(g) test-only change and refreshed mtimes: no restart"
else bad "(g) test-only change and refreshed mtimes: restarted anyway"; fi

# ── (h) content changed, but the unit restarted since: re-baseline ─────────────
setup; run_block; : > "$CALLS"
echo 'export const x = 3;' > "$RUNTIME_DIR/$VESSEL/src/x.ts"
UNIT_STARTED="Sat 2026-10-03 11:30:00 UTC"
run_block
if ! restarted && grep -q '^Sat 2026-10-03 11:30:00 UTC' "$MARKER_DIR/$VESSEL.loaded"; then ok "(h) unit restarted since the baseline: re-baselined, no restart"
else bad "(h) unit restarted since the baseline: expected a re-baseline and no restart"; fi

# ── (e) owed but work in flight: defer, keep the marker ────────────────────────
setup; echo oldhash > "$P"; DEFER=1
run_block
if ! restarted && [ -e "$P" ] && [ "$(cat "$DF" 2>/dev/null)" = 1 ]; then ok "(e) owed with work in flight: deferred, marker kept, counter 1"
else bad "(e) owed with work in flight: expected deferral (calls: $(tr '\n' ' ' < "$CALLS"); deferrals $(cat "$DF" 2>/dev/null || echo none))"; fi

# ── (f) unit inactive: nothing to restart, marker cleared ──────────────────────
setup; echo oldhash > "$P"; UNIT_ACTIVE=0
run_block
if ! restarted && [ ! -e "$P" ]; then ok "(f) unit inactive: no restart, marker cleared"
else bad "(f) unit inactive: expected no restart and a cleared marker"; fi

# ── (i) deferred to the cap, still busy: quiesce, drain, restart ───────────────
setup; echo oldhash > "$P"; echo 3 > "$DF"; DEFER=1; health_seq 2 1 0; QDIR_SEEN_FILE="$T/seen"; rm -f "$QDIR_SEEN_FILE"
run_block
if restarted && [ -e "$QDIR_SEEN_FILE" ] && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && grep -q "drained to 0" "$LOG" && [ ! -e "$P" ]; then ok "(i) deferred to the cap: quiesced, drained, restart taken, marker removed"
else bad "(i) deferred to the cap: expected quiesce then restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi
[ "$(expires_of "$QDIR_SEEN_FILE")" = "$EXP_TICK" ] && ok "(q1) the owed path's quiesce marker carries expires_at = tick start + TimeoutStartSec ($EXP_TICK)" \
  || bad "(q1) owed-path marker expires_at '$(expires_of "$QDIR_SEEN_FILE")', expected $EXP_TICK (marker: $(head -c 300 "$QDIR_SEEN_FILE" 2>/dev/null))"
QDIR_SEEN_FILE=""

# ── (j) deferred to the cap, never drains: restart anyway, loss logged ─────────
setup; echo oldhash > "$P"; echo 3 > "$DF"; DEFER=1; health_seq 1
run_block
if restarted && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && grep -q "IS lost" "$LOG"; then ok "(j) never drains: restart taken anyway, loss logged, marker removed"
else bad "(j) never drains: expected a logged forced restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (k) at the cap, deferral is a probe window: stays deferred ─────────────────
setup; echo oldhash > "$P"; echo 5 > "$DF"; DEFER=1; PROBE=1; health_seq 0
run_block
if ! restarted && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && ! grep -q QUIESCED "$LOG" && [ -e "$P" ]; then ok "(k) probe window at the cap: no quiesce, no restart, still owed"
else bad "(k) probe window at the cap: expected a plain deferral (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ══ (p-u) PROGRESS, NOT AGE, DECIDES WHETHER A PAST-CEILING COMPOSE IS STUCK ══
# The owed block again, now with the REAL restart_age_defer reading a file-backed
# /health that publishes in_flight_oldest_ms and (when the vessel stamps stage
# transitions) in_flight_last_progress_ms: ms since the most recent stage transition
# of any in-flight request. Age alone killed composes that were still working
# (scope -> plan -> apply -> verify routinely runs past the 900 s ceiling).
#   (p) aged 1000 s, last progress 30 s ago -> NOT restarted: deferred, "progressing",
#       still owed, the owed-since clock started
#   (q) aged 1000 s, silent 700 s (> stall 600 s) -> restarted
#   (r) aged 1000 s, progressing, but owed for 3000 s (> max hold 2700 s) -> restarted
#       anyway, LOSSY logged, naming the attempt /health published
#   (s) CONTROL: no progress field, aged 1000 s -> restarted (today's ceiling)
#   (t) CONTROL: no progress field, aged 100 s -> deferred (today's ceiling)
#   (u) the stall bound is the SHAPED pull_sync.stall_seconds: 20 s -> progress 30 s
#       ago is a stall, restarted
{
  sed -n '/^restart_age_defer() {/,/^}/p' "$SCRIPT"
} > "$T/rad.sh"
grep -q '^restart_age_defer() {' "$T/rad.sh" || { echo "FAIL - could not extract restart_age_defer"; exit 1; }
# shellcheck disable=SC1090
source "$T/rad.sh"
probe_window_open() { return 1; }
DEFERRAL_LOG="$T/deferrals.jsonl"
TP_STALL=""   # a shaped pull_sync.stall_seconds row, when set; otherwise the default is taken
tuning_param() { TP_VALUE="$2"; case "$1" in pull_sync.stall_seconds) [ -n "$TP_STALL" ] && TP_VALUE="$TP_STALL" ;; esac; echo "TP $1" >> "$CALLS"; }
HEALTH_JSON="$T/health.json"
curl() { cat "$HEALTH_JSON" 2>/dev/null; }
OS="$MARKER_DIR/$VESSEL.restart-owed-since"
psetup() { setup; OS="$MARKER_DIR/$VESSEL.restart-owed-since"; echo oldhash > "$P"; rm -f "$DEFERRAL_LOG"; TP_STALL=""; printf '%s' "$1" > "$HEALTH_JSON"; }

# ── (p) MUST-FAIL before the fix: past the ceiling but progressing ─────────────
psetup '{"in_flight":1,"in_flight_oldest_ms":1000000,"in_flight_last_progress_ms":30000,"in_flight_last_progress_id":"gap-demo"}'
run_block
if ! restarted && [ -e "$P" ] && grep -q "progressing" "$LOG" && [ -s "$OS" ]; then
  ok "(p) aged 1000 s, progress 30 s ago: owed restart deferred as progressing, still owed, hold clock started"
else bad "(p) aged 1000 s, progress 30 s ago: expected a deferral logged as progressing (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (q) past the ceiling and silent longer than the stall bound ────────────────
psetup '{"in_flight":1,"in_flight_oldest_ms":1000000,"in_flight_last_progress_ms":700000}'
run_block
if restarted && [ ! -e "$P" ] && [ ! -e "$OS" ]; then ok "(q) aged 1000 s, silent 700 s: restarted, markers cleared"
else bad "(q) aged 1000 s, silent 700 s: expected a restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (r) progressing, but the restart has been owed past the max hold ───────────
psetup '{"in_flight":1,"in_flight_oldest_ms":1000000,"in_flight_last_progress_ms":30000,"in_flight_last_progress_id":"gap-demo"}'
echo $(( $(date +%s) - 3000 )) > "$OS"
run_block
if restarted && grep -q "LOSSY" "$LOG" && grep -q "gap-demo" "$LOG" && grep -q '"action":"forced_owed_restart_lossy"' "$DEFERRAL_LOG" 2>/dev/null && [ ! -e "$OS" ]; then
  ok "(r) owed 3000 s > max hold 2700 s: restarted anyway, LOSSY logged naming the attempt"
else bad "(r) owed past the max hold: expected a LOSSY restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (s) CONTROL: no progress published, past the ceiling -> today's restart ────
psetup '{"in_flight":1,"in_flight_oldest_ms":1000000}'
run_block
if restarted && ! grep -q "progressing\|LOSSY" "$LOG" && ! grep -q '^TP ' "$CALLS"; then ok "(s) control, no progress field, aged 1000 s: restarted at the ceiling as before, no tuning read"
else bad "(s) control, no progress field: expected today's ceiling restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (t) CONTROL: no progress published, under the ceiling -> today's deferral ──
psetup '{"in_flight":1,"in_flight_oldest_ms":100000}'
run_block
if ! restarted && [ -e "$P" ] && ! grep -q "progressing" "$LOG"; then ok "(t) control, no progress field, aged 100 s: deferred under the ceiling as before"
else bad "(t) control, under the ceiling: expected today's deferral (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (u) the stall bound is shaped ──────────────────────────────────────────────
psetup '{"in_flight":1,"in_flight_oldest_ms":1000000,"in_flight_last_progress_ms":30000}'; TP_STALL=20
run_block
if restarted && grep -q '^TP pull_sync.stall_seconds$' "$CALLS"; then ok "(u) shaped pull_sync.stall_seconds=20: progress 30 s ago is a stall, restarted"
else bad "(u) shaped stall bound: expected the shaped 20 s to apply (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi
TP_STALL=""

# ══ (v-y) A HOLD CARRIED ACROSS TICKS (mirror-path quiesce bound with a progressing compose) ══
# When the mirror path's quiesce runs out of tick budget while a compose is still progressing,
# pull-sync does not restart: it keeps the admission marker (so no NEW work enters) and records
# the carry in <vessel>.quiesce-carry. On later ticks the owed path re-touches that marker (the
# vessel ignores markers older than QUIESCE_MAX_MS, 20 min, and a hold may run 45 min) and ends
# the hold the moment the compose drains, goes silent, or the max hold passes.
#   (v) carry + progressing, marker 25 min old -> no restart, marker RE-TOUCHED, still held after
#       the tick ends (quiesce_release, as the loop head and EXIT trap run it)
#   (w) carry + silent past the stall bound (young, under the ceiling) -> restart, marker released
#   (x) carry + drained to 0 -> restart, marker released
#   (y) carry with no restart owed any more (pending marker gone) -> stale carry dropped, marker released
#   (z) 4 progress deferrals, then progress stops under the age ceiling -> an ordinary deferral
#       (counter 1), not an immediate drain: progress deferrals do not count toward RESTART_DEFER_MAX
#   (cm) carry + the unit is MASKED -> the vessel-loop skip releases the marker and the carry (nothing
#       will restart a masked unit), says so, keeps the owed restart; no restart
#   (cp) carry + an open probe window -> the loop-head hold releases the marker and the carry with a
#       logged reason (a closed admission would refuse the probes' own composes for up to the window
#       cap, past the max hold), keeps the owed restart; no restart
#   Both skips `continue` BEFORE the owed path, so without an explicit release the carried marker was
#   neither re-touched nor released and silently went stale (fail-open after QUIESCE_MAX_MS).
QD2="$T/quiesce2"
csetup() { psetup "$1"; mkdir -p "$QD2"; : > "$QD2/$VESSEL"; echo "$QD2/$VESSEL" > "$MARKER_DIR/$VESSEL.quiesce-carry"; Q_HELD=""; Q_CARRY=""; Q_BOUND=""; }
fresh() { [ -e "$1" ] && [ $(( $(date +%s) - $(stat -c %Y "$1") )) -lt 60 ]; }

csetup '{"in_flight":1,"in_flight_oldest_ms":1000000,"in_flight_last_progress_ms":30000,"in_flight_last_progress_id":"gap-demo"}'
touch -d '25 minutes ago' "$QD2/$VESSEL"
run_block; quiesce_release
if ! restarted && fresh "$QD2/$VESSEL" && [ -s "$MARKER_DIR/$VESSEL.quiesce-carry" ] && [ -e "$P" ]; then
  ok "(v) carried hold, compose progressing: no restart, marker re-touched past the vessel's 20 min staleness, still held across the tick"
else bad "(v) carried hold, progressing: expected a held, re-touched marker and no restart (calls: $(tr '\n' ' ' < "$CALLS"); marker $( [ -e "$QD2/$VESSEL" ] && stat -c %y "$QD2/$VESSEL" || echo gone); log: $(tr '\n' ' ' < "$LOG"))"; fi

csetup '{"in_flight":1,"in_flight_oldest_ms":200000,"in_flight_last_progress_ms":700000}'
run_block; quiesce_release
if restarted && [ ! -e "$QD2/$VESSEL" ] && [ ! -e "$MARKER_DIR/$VESSEL.quiesce-carry" ]; then ok "(w) carried hold, compose silent past stall: restarted, marker released"
else bad "(w) carried hold, silent: expected a restart and a released marker (calls: $(tr '\n' ' ' < "$CALLS"); marker $( [ -e "$QD2/$VESSEL" ] && echo held || echo gone); log: $(tr '\n' ' ' < "$LOG"))"; fi

csetup '{"in_flight":0}'
run_block; quiesce_release
if restarted && [ ! -e "$QD2/$VESSEL" ] && [ ! -e "$MARKER_DIR/$VESSEL.quiesce-carry" ]; then ok "(x) carried hold, drained: restarted, marker released"
else bad "(x) carried hold, drained: expected a restart and a released marker (calls: $(tr '\n' ' ' < "$CALLS"); marker $( [ -e "$QD2/$VESSEL" ] && echo held || echo gone))"; fi

csetup '{"in_flight":1,"in_flight_oldest_ms":1000000,"in_flight_last_progress_ms":30000}'; rm -f "$P"
run_block; quiesce_release
if [ ! -e "$QD2/$VESSEL" ] && [ ! -e "$MARKER_DIR/$VESSEL.quiesce-carry" ]; then ok "(y) carry with nothing owed: stale carry dropped, marker released"
else bad "(y) stale carry: expected the marker released (marker $( [ -e "$QD2/$VESSEL" ] && echo held || echo gone))"; fi
Q_HELD=""; Q_CARRY=""; Q_BOUND=""

# ── (z) a PROGRESS deferral does not count toward RESTART_DEFER_MAX ─────────────
# Four ticks deferred because a past-ceiling compose was progressing, then progress stops while
# the request in flight is under the age ceiling: that tick is an ORDINARY deferral (counter 1),
# not an immediate quiesce_drain because the progress ticks had already run the counter to the cap.
psetup '{"in_flight":1,"in_flight_oldest_ms":1000000,"in_flight_last_progress_ms":30000}'; rm -f "$DF"
for _ in 1 2 3 4; do run_block; done
_z_after_progress="$(cat "$DF" 2>/dev/null || echo 0)"
printf '%s' '{"in_flight":1,"in_flight_oldest_ms":100000}' > "$HEALTH_JSON"; : > "$LOG"
run_block
if ! restarted && [ "$_z_after_progress" = 0 ] && [ "$(cat "$DF" 2>/dev/null)" = 1 ] && ! grep -q QUIESCED "$LOG"; then
  ok "(z) 4 progress deferrals leave the counter at 0; the next under-ceiling deferral is ordinary (counter 1), no drain"
else bad "(z) progress deferrals counted: counter after 4 progress ticks $_z_after_progress, then $(cat "$DF" 2>/dev/null || echo none) (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (cm, cp) the vessel loop's own skips must not strand a carried hold ─────────
# The probe-window skip (loop head) and the masked-unit skip, taken from the script, run before the
# owed path, so they are the only code that sees a carried hold on those ticks.
{
  sed -n '/^release_carried_hold() {/,/^}/p' "$SCRIPT"
  echo 'run_skips() {'
  echo 'for v in "$VESSEL"; do'
  awk '$0 == "  if probe_window_open; then" {on=1} on{print} on && /^  fi$/{exit}' "$SCRIPT"
  awk 'index($0, "  if [ -n \"$SELF_UNIT\" ] && [ \"${SELF_UNIT%.service}\" != \"$SELF_UNIT\" ] \\") == 1 {on=1} on{print} on && /^  fi$/{exit}' "$SCRIPT"
  echo 'echo PAST-SKIPS >> "$CALLS"'
  echo 'done'
  echo '}'
} > "$T/sfns.sh"
grep -q 'PW_LOGGED' "$T/sfns.sh" && grep -q 'is MASKED' "$T/sfns.sh" \
  || { echo "FAIL - could not extract the vessel loop's probe-window and masked-unit skips"; exit 1; }
# shellcheck disable=SC1090
source "$T/sfns.sh"
PW_OPEN=0
probe_window_open() { PW_WHY="probe window pw-demo tag=r9"; [ "$PW_OPEN" = 1 ]; }
held() { [ -e "$QD2/$VESSEL" ] && echo held || echo gone; }

csetup '{"in_flight":1}'; SELF_UNIT="$VESSEL.service"; UNIT_ENABLED=masked; PW_OPEN=0; PW_LOGGED=""; skipped=0
run_skips; quiesce_release
if ! restarted && ! grep -q PAST-SKIPS "$CALLS" && [ ! -e "$QD2/$VESSEL" ] && [ ! -e "$MARKER_DIR/$VESSEL.quiesce-carry" ] \
   && [ -e "$P" ] && grep -q "carried quiesce hold" "$LOG" && grep -q "MASKED" "$LOG"; then
  ok "(cm) carried hold, unit masked: marker and carry released with a log line, restart still owed, no restart"
else bad "(cm) carried hold, unit masked: expected the marker and the carry released and logged (marker $(held); carry $( [ -e "$MARKER_DIR/$VESSEL.quiesce-carry" ] && echo kept || echo gone); calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

csetup '{"in_flight":1}'; SELF_UNIT="$VESSEL.service"; UNIT_ENABLED=enabled; PW_OPEN=1; PW_LOGGED=""; skipped=0
run_skips; quiesce_release
if ! restarted && ! grep -q PAST-SKIPS "$CALLS" && [ ! -e "$QD2/$VESSEL" ] && [ ! -e "$MARKER_DIR/$VESSEL.quiesce-carry" ] \
   && [ -e "$P" ] && grep -q "carried quiesce hold" "$LOG" && grep -q "pw-demo" "$LOG"; then
  ok "(cp) carried hold, probe window open: marker and carry released with the window named, restart still owed, no restart"
else bad "(cp) carried hold, probe window open: expected the marker and the carry released and logged (marker $(held); carry $( [ -e "$MARKER_DIR/$VESSEL.quiesce-carry" ] && echo kept || echo gone); calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

csetup '{"in_flight":1}'; SELF_UNIT="$VESSEL.service"; UNIT_ENABLED=enabled; PW_OPEN=0; PW_LOGGED=""; skipped=0
run_skips; quiesce_release
if grep -q PAST-SKIPS "$CALLS" && [ -e "$QD2/$VESSEL" ] && [ -s "$MARKER_DIR/$VESSEL.quiesce-carry" ] && ! grep -q "carried quiesce hold" "$LOG"; then
  ok "(cc) control, unmasked and no window: neither skip fires, the carried hold is left for the owed path"
else bad "(cc) control: expected no skip and the carry untouched (marker $(held); calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi
probe_window_open() { return 1; }; UNIT_ENABLED=""; Q_HELD=""; Q_CARRY=""; Q_BOUND=""

# ══ (l-o) the mirror path's quiesce holds admission through drain, mirror, restart ══
{
  sed -n '/^restart_age_defer() {/,/^}/p' "$SCRIPT"
  sed -n '/^quiesce_release() {/,/^}/p' "$SCRIPT"
  sed -n '/^owed_hold_bound() {/,/^}/p' "$SCRIPT"
  echo 'run_mirror_block() {'
  echo 'for v in "$VESSEL"; do'
  echo 'quiesce_release'
  echo 'DEFER_MARKER=""; IS_AUTHORING_HOST=""'
  awk '/^  if \[ -z "\$DEFER_MARKER" \]; then$/{on=1} on && /^  # 3-pre\. TEST GATE/{exit} on{print}' "$SCRIPT"
  sed -n '/^mirror_quiesce_drain() {/,/^}/p' "$SCRIPT"
  sed -n '/^quiesce_mark() {/,/^}/p' "$SCRIPT"
  echo 'gate_stub || continue'
  awk '/^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{on=1; next} on && /^  PREV_GOOD=/{exit} on{print}' "$SCRIPT"
  echo 'mirror_stub'
  awk '/^  # 3\. Restart \+ health-gate/{on=1} on{print} on && /^    sleep "\$STAGGER_SECONDS"$/{exit}' "$SCRIPT"
  echo '  fi'
  echo 'done'
  echo 'quiesce_release'
  echo '}'
} > "$T/mfns.sh"
grep -q 'drained to 0 in' "$T/mfns.sh" && grep -q 'DEFERRING restart' "$T/mfns.sh" \
  || { echo "FAIL - could not extract the mirror quiesce and restart blocks"; exit 1; }
quiesce_release() { :; }   # absent before the fix; the extracted definition replaces this
IFC="$T/inflight"          # the vessel's in_flight counter
MOLD=""; MPROG=""   # in_flight_oldest_ms / in_flight_last_progress_ms the vessel publishes, when set
curl() { printf '{"in_flight":%s,"drain_ms":80000%s%s}' "$(cat "$IFC" 2>/dev/null || echo 0)" "${MOLD:+,\"in_flight_oldest_ms\":$MOLD}" "${MPROG:+,\"in_flight_last_progress_ms\":$MPROG,\"in_flight_last_progress_id\":\"gap-mirror\"}"; }
sleep() {                  # time passing drains one request (admission closed or not)
  [ "${1:-0}" != 0 ] && echo "WAIT marker=$([ -e "$QUIESCE_DIR/$VESSEL" ] && echo held || echo absent)" >> "$CALLS"
  [ "${NODRAIN:-0}" = 1 ] && return 0
  local n; n="$(cat "$IFC" 2>/dev/null || echo 0)"; [ "$n" -gt 0 ] && echo $((n - 1)) > "$IFC"; return 0
}
probe_window_open() { return 1; }
test_only_range() { return 1; }
emit_gap() { :; }
mstate() { [ -e "$QUIESCE_DIR/$VESSEL" ] && echo held || echo absent; }
try_admit() { # where — a long-running request tries to start (development-vessel's quiesced() check)
  if [ -e "$QUIESCE_DIR/$VESSEL" ]; then echo "REFUSED new request at $1 (admission closed)" >> "$CALLS"
  else echo $(( $(cat "$IFC") + 1 )) > "$IFC"; echo "ADMITTED new request at $1" >> "$CALLS"; fi
}
GATE_RC=0
gate_stub() {   # new content in the same tick; the gate reads only the clone
  HEAD=head-newer; CLONE_HASH=content-newer
  echo "GATE marker=$(mstate)" >> "$CALLS"
  case " ${ARRIVE:-} " in *" gate "*) try_admit gate ;; esac
  return "$GATE_RC"
}
mirror_stub() {
  echo "MIRROR marker=$(mstate)" >> "$CALLS"
  [ -e "$QUIESCE_DIR/$VESSEL" ] && echo "MIRROR-EXPIRES $(expires_of "$QUIESCE_DIR/$VESSEL")" >> "$CALLS"
  case " ${ARRIVE:-} " in *" mirror "*) try_admit mirror ;; esac
  return 0
}
# shellcheck disable=SC1090
source "$T/mfns.sh"
HEAD=head-old; DEFERRAL_LOG="$T/deferrals.jsonl"; AUTHORING_HOST_VESSEL=other-vessel
COMPOSE_CEILING_MS=900000; GATE_T0="$(date +%s)"; RUNTIME_NONTEST=old; CLONE_NONTEST=new; PREV_GOOD=""
msetup() { MOLD=""; MPROG=""; Q_CARRY=""; setup; skipped=0; deferred=0; synced=0; failed=0; rm -rf "$QUIESCE_DIR"; echo "$1" > "$IFC"; ARRIVE="${2:-}"; NODRAIN=0; GATE_RC=0; GATE_T0="$(date +%s)"; rm -f "$DEFERRAL_LOG"; HEAD=head-old; CLONE_HASH=content-old; }
_sysctl_base="$(declare -f systemctl)"
systemctl() { [ "$1" = restart ] && echo "RESTART-SEES marker=$([ -e "$QUIESCE_DIR/$VESSEL" ] && echo held || echo absent)" >> "$CALLS"; _sysctl_inner "$@"; }
eval "${_sysctl_base/systemctl ()/_sysctl_inner ()}"
order() { grep -n "$1" "$CALLS" | head -1 | cut -d: -f1; }

# ── (l) admission OPEN through the gate, CLOSED from the drain to the restart ──
msetup 1 "gate mirror"; QUIESCE_WAIT_S=30   # room for two waits: the request admitted mid-gate drains too
run_mirror_block; QUIESCE_WAIT_S=5
W_HELD="$(grep -c '^WAIT marker=held' "$CALLS")"; W_ABS="$(grep -c '^WAIT marker=absent' "$CALLS")"
if grep -q '^GATE marker=absent' "$CALLS" && grep -q '^ADMITTED new request at gate' "$CALLS"; then
  ok "(l) the marker is ABSENT while the gate runs (a request arriving mid-gate is admitted)"
else bad "(l) admission was closed during the gate (calls: $(tr '\n' ' ' < "$CALLS"))"; fi
if [ "$W_HELD" -ge 1 ] && [ "$W_ABS" = 0 ] && [ "$(order '^GATE')" -lt "$(order '^WAIT')" ] && [ "$(order '^WAIT')" -lt "$(order '^MIRROR')" ] \
   && grep -q '^MIRROR marker=held' "$CALLS" && grep -q '^RESTART-SEES marker=held' "$CALLS"; then
  ok "(l) the marker is HELD from the drain (after the gate) through the mirror to the restart"
else bad "(l) expected gate < drain(held) < mirror(held) < restart(held) (calls: $(tr '\n' ' ' < "$CALLS"))"; fi
if restarted && grep -q "drained to 0" "$LOG" && grep -q '^REFUSED new request at mirror' "$CALLS" \
   && ! grep -q "DEFERRING restart" "$LOG" && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && [ "$(cat "$IFC")" = 0 ]; then
  ok "(l) the drain covers the request admitted mid-gate, the mirror-time request is refused, restart this tick, marker released after it"
else bad "(l) expected a full drain, a refused mirror-time request and a restart this tick (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'drained\|DEFERRING\|restarting\|QUIESCED' "$LOG" | tr '\n' ' '))"; fi

grep -qxF "MIRROR-EXPIRES $EXP_TICK" "$CALLS" && ok "(q2) the mirror path's marker carries expires_at = tick start + TimeoutStartSec" \
  || bad "(q2) mirror-path marker expiry: '$(grep -a '^MIRROR-EXPIRES' "$CALLS")', expected $EXP_TICK"

# ── (l2) qrace control: nothing is admitted between the drain and the restart ──
msetup 1 "mirror"
run_mirror_block
if restarted && grep -q "drained to 0" "$LOG" && grep -q '^REFUSED new request at mirror' "$CALLS" && ! grep -q '^ADMITTED' "$CALLS" \
   && ! grep -q "DEFERRING restart" "$LOG" && grep -q '^RESTART-SEES marker=held' "$CALLS" && [ ! -e "$QUIESCE_DIR/$VESSEL" ] \
   && [ "$(order '^MIRROR')" -lt "$(order '^RESTART ')" ]; then
  ok "(l2) qrace guarantee: a request between drain and restart is REFUSED, restart taken this tick, marker released after it"
else bad "(l2) qrace: expected admission closed from drain to restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'drained\|DEFERRING\|restarting' "$LOG" | tr '\n' ' '))"; fi

# ── (l3) a refused gate never closes admission ─────────────────────────────────
msetup 1 ""; GATE_RC=1
run_mirror_block
if ! restarted && ! grep -q QUIESCED "$LOG" && ! grep -q '=held' "$CALLS" && [ ! -e "$QUIESCE_DIR/$VESSEL" ]; then
  ok "(l3) the gate refused the commit: admission was never closed"
else bad "(l3) a refused gate closed admission (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'QUIESCED\|drained' "$LOG" | tr '\n' ' '))"; fi

# ── (l4) the budget is spent when the gate passes: bound path, never a false drain ──
msetup 1 ""; NODRAIN=1; GATE_T0=$(( $(date +%s) - 2000 ))
run_mirror_block
if ! grep -q "drained to 0" "$LOG" && grep -q "converging anyway" "$LOG"; then
  ok "(l4) budget spent at the gate's end with 1 in flight: the bound path, not 'drained to 0'"
else bad "(l4) expected the bound path (log: $(grep -a 'drained\|anyway\|capped' "$LOG" | tr '\n' ' '))"; fi
NODRAIN=0; quiesce_release; Q_CARRY=""

# ── (m) control: nothing in flight ─────────────────────────────────────────────
msetup 0 ""
run_mirror_block
if restarted && ! grep -q QUIESCED "$LOG" && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && ! grep -q '=held' "$CALLS" \
   && grep -q '^GATE' "$CALLS" && grep -q '^MIRROR' "$CALLS" && ! grep -q "DEFERRING restart" "$LOG"; then
  ok "(m) control, nothing in flight: no quiesce, gate + mirror + restart as before"
else bad "(m) control: expected plain gate/mirror/restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (n) the quiesce hits its bound while the compose is still PROGRESSING: hold, do not kill ──
# The tick budget ran out, not the compose. Admission stays closed (marker held across the tick
# end, carry recorded) and the restart is owed; the owed path ends the hold on a later tick.
msetup 1 ""; NODRAIN=1; MOLD=1000000; MPROG=30000
run_mirror_block
if ! restarted && [ -e "$QUIESCE_DIR/$VESSEL" ] && [ -s "$MARKER_DIR/$VESSEL.quiesce-carry" ] && [ -e "$P" ] \
   && grep -q "progressing" "$LOG"; then
  ok "(n) quiesce bound hit, compose progressed 30 s ago: NO restart, admission marker still held, restart owed"
else bad "(n) quiesce bound hit while progressing: expected a held marker and no restart (calls: $(tr '\n' ' ' < "$CALLS"); marker $( [ -e "$QUIESCE_DIR/$VESSEL" ] && echo held || echo gone); log: $(grep -a 'anyway\|DEFERRING\|restarting\|progressing\|LOSSY' "$LOG" | tr '\n' ' '))"; fi
_q3="$(expires_of "$QUIESCE_DIR/$VESSEL")"; _q3e="$(date -u -d "$_q3" +%s 2>/dev/null || echo 0)"
if [ -n "$_q3" ] && [ "$_q3e" -ge $(( $(date +%s) + 1100 )) ] && [ "$_q3e" -le $(( $(date +%s) + 1300 )) ]; then ok "(q3) a carried hold's marker carries the carry horizon (now + 20 min): $_q3"
else bad "(q3) carried marker expires_at '$_q3', expected ~now + 1200 s (the tick expiry $EXP_TICK would reopen admission between ticks)"; fi
quiesce_release; Q_CARRY=""

# ── (n2) CONTROL: no progress field published -> today's converge-anyway ──────────────────────
msetup 1 ""; NODRAIN=1
run_mirror_block
if restarted && grep -q "converging anyway" "$LOG" && ! grep -q "DEFERRING restart" "$LOG" && [ ! -e "$QUIESCE_DIR/$VESSEL" ]; then
  ok "(n2) control, no progress field: quiesce bound hit, restart taken this tick as before, marker released"
else bad "(n2) control: expected the restart, not a deferral (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'anyway\|DEFERRING\|restarting' "$LOG" | tr '\n' ' '))"; fi

# ── (n3) progress published but silent past the stall bound -> restart as today ──────────────
msetup 1 ""; NODRAIN=1; MOLD=1000000; MPROG=700000
run_mirror_block
if restarted && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && [ ! -e "$MARKER_DIR/$VESSEL.quiesce-carry" ]; then
  ok "(n3) quiesce bound hit, compose silent 700 s: restart taken, marker released"
else bad "(n3) silent past stall: expected the restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'anyway\|DEFERRING\|restarting' "$LOG" | tr '\n' ' '))"; fi

# ── (n4) progressing, but the restart has been owed past the max hold -> LOSSY restart ────────
msetup 1 ""; NODRAIN=1; MOLD=1000000; MPROG=30000
echo $(( $(date +%s) - 3000 )) > "$MARKER_DIR/$VESSEL.restart-owed-since"
run_mirror_block
if restarted && grep -q "LOSSY" "$LOG" && grep -q "gap-mirror" "$LOG" && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && [ ! -e "$MARKER_DIR/$VESSEL.quiesce-carry" ]; then
  ok "(n4) quiesce bound hit, progressing, owed 3000 s > max hold: LOSSY restart naming the attempt, marker released"
else bad "(n4) past max hold: expected a LOSSY restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'anyway\|DEFERRING\|restarting\|LOSSY' "$LOG" | tr '\n' ' '))"; fi
NODRAIN=0; MOLD=""; MPROG=""

# ── (o) structural: where the release runs in the real script ─────────────────
LOOP_HEAD="$(awk '/^for d in "\$CLONE_DIR"\/\*\/; do$/{on=1;n=0} on{print; if (++n>=4) exit}' "$SCRIPT")"
AFTER_LOOP="$(awk '/^for d in "\$CLONE_DIR"\/\*\/; do$/{inloop=1} inloop && /^done$/{getline; print; exit}' "$SCRIPT")"
if printf '%s' "$LOOP_HEAD" | grep -q '^  quiesce_release$' && [ "$AFTER_LOOP" = quiesce_release ] \
   && grep -q '^trap .*quiesce_release.* EXIT$' "$SCRIPT"; then
  ok "(o) the quiesce hold is released first in every vessel pass, after the loop, and on EXIT"
else bad "(o) expected quiesce_release at the vessel-loop head, right after its done, and in the EXIT trap (head: $(printf '%s' "$LOOP_HEAD" | tr '\n' '|'); after: $AFTER_LOOP)"; fi


# ══ (e*) EVERY vessel pass that leaves before the owed path releases a carried hold ══
# The vessel loop has many early exits before the owed path's carry handling (`P_CARRY_FILE`):
# fetch failed, HEAD unresolvable, clone ahead, ff-only failed, diverged, not in this runtime, not a
# git clone, plus the probe-window and masked skips that release explicitly. A pass that leaves by
# any of them neither re-touched nor released a carried quiesce hold: the marker went stale in
# silence and the vessel only reopened admission by failing open after QUIESCE_MAX_MS (20 min).
# These run the REAL loop, from its head to the carry handling, with the REAL log() and the real
# lines after the loop's `done`, over temp clones with git stubbed per vessel. Each pass must
# release the carry (marker + carry record) with a logged reason BEFORE the next vessel's pass
# starts, and leave the owed restart owed (restart-pending, restart-owed-since, restart-deferrals).
#   (ef) fetch failed      (ed) diverged (operator-authored local commit)   (ea) clone ahead
#   (eo) ff-only failed    (eh) HEAD unresolvable (silent)   (er) not in this runtime (silent)
#   (eg) not a git clone (silent)
#   (ex) GENERIC: a synthetic early exit injected into the extracted loop, with a log line, and
#   (es) a silent one: the mechanism must cover exits that do not exist yet, not today's list
#   (eb) the loop HALTS (an outer `break`, as an unhealthy restart or fan-out does) after a vessel
#        whose carry the owed path handled: a LATER vessel's carry, never visited this tick, is
#        released after the loop; the handled one is kept
#   (el) the LAST pass leaves early: released after the loop, still naming its own reason
#   (ec) control: a pass that reaches the carry handling keeps the carry, logs no release
{
  sed -n '/^log() {/p' "$SCRIPT"
  sed -n '/^Q_HELD=""; Q_BOUND=""; Q_CARRY=""$/,/^trap /p' "$SCRIPT" | grep -v '^trap '
  echo 'run_loop() {'
  awk '/^for d in "\$CLONE_DIR"\/\*\/; do$/{on=1} on{print} on && /^  P_CARRY_FILE=/{exit}' "$SCRIPT" \
    | awk '$0 == "  # 1. Fetch + classify vs origin." {
        print "  case \"$v\" in"
        print "    *-synthetic-said) log \"$v: a synthetic early exit added after this test was written\"; skipped=$((skipped+1)); continue ;;"
        print "    *-synthetic-silent) continue ;;"
        print "  esac"
      } {print}'
  echo '  echo "PAST-CARRY $v"'
  echo '  [ "$v" = a-halt ] && break'
  echo 'done'
  awk '/^for d in "\$CLONE_DIR"\/\*\/; do$/{inloop=1} inloop && /^done$/{after=1; next} after && /^$/{exit} after{print}' "$SCRIPT"
  echo '}'
} > "$T/lfns.sh"
grep -q 'synthetic-silent' "$T/lfns.sh" && grep -q 'fetch failed' "$T/lfns.sh" && grep -q 'clone DIVERGED' "$T/lfns.sh" \
  && grep -q '^  P_CARRY_FILE=' "$T/lfns.sh" && grep -q '^log() {' "$T/lfns.sh" \
  || { echo "FAIL - could not extract the vessel loop up to the carry handling"; exit 1; }
# shellcheck disable=SC1090
source "$T/lfns.sh"
CLONE_DIR="$T/clones"; BRANCH=dev; LAST_GOOD_DIR="$T/lastgood"; GITMODE="$T/gitmode"; OUT="$T/loop.out"
content_hash() { echo h; }
git() {   # per-vessel modes in $GITMODE/<vessel>; default clean (HEAD == origin)
  local dir=""; [ "${1:-}" = -C ] && { dir="$2"; shift 2; }
  local mode; mode="$(cat "$GITMODE/$(basename "$dir")" 2>/dev/null || echo clean)"
  case "$1" in
    fetch) [ "$mode" != fetchfail ] ;;
    rev-parse) case "$mode" in nohead) return 1 ;; clean|fetchfail) echo same ;; *) [ "$2" = HEAD ] && echo local || echo remote ;; esac ;;
    merge-base) case "$mode" in ahead) [ "$3" = "origin/$BRANCH" ] ;; ffonly) [ "$3" = HEAD ] ;; *) return 1 ;; esac ;;
    pull) return 1 ;;
    log) echo "Some Operator" ;;
    config) return 1 ;;
    *) return 0 ;;
  esac
}
# lsetup <vessel>:<mode>[:carry][:noruntime][:nogit] ... — clones, runtimes, an owed restart, a carried hold each
lsetup() {
  rm -rf "$CLONE_DIR" "$GITMODE" "$RUNTIME_DIR" "$MARKER_DIR" "$QD2"; mkdir -p "$CLONE_DIR" "$GITMODE" "$RUNTIME_DIR" "$MARKER_DIR" "$QD2" "$LAST_GOOD_DIR"
  : > "$OUT"; skipped=0; failed=0; UNIT_ENABLED=enabled; Q_HELD=""; Q_CARRY=""; Q_BOUND=""
  local spec v mode
  for spec in "$@"; do
    v="${spec%%:*}"; mode="$(printf '%s' "$spec" | cut -d: -f2)"
    mkdir -p "$CLONE_DIR/$v"; echo "$mode" > "$GITMODE/$v"
    case "$spec" in *:nogit*) ;; *) mkdir -p "$CLONE_DIR/$v/.git" ;; esac
    case "$spec" in *:noruntime*) ;; *) mkdir -p "$RUNTIME_DIR/$v/src" ;; esac
    case "$spec" in *:carry*)
      : > "$QD2/$v"; echo "$QD2/$v" > "$MARKER_DIR/$v.quiesce-carry"
      echo oldhash > "$MARKER_DIR/$v.restart-pending"; echo 1700000000 > "$MARKER_DIR/$v.restart-owed-since"; echo 2 > "$MARKER_DIR/$v.restart-deferrals" ;;
    esac
  done
}
owed_kept() { [ "$(cat "$MARKER_DIR/$1.restart-pending" 2>/dev/null)" = oldhash ] && [ "$(cat "$MARKER_DIR/$1.restart-owed-since" 2>/dev/null)" = 1700000000 ] && [ "$(cat "$MARKER_DIR/$1.restart-deferrals" 2>/dev/null)" = 2 ]; }
rel_line() { grep -an "$1: releasing a carried quiesce hold" "$OUT" | head -1; }
first_at() { grep -an "$1" "$OUT" | head -1 | cut -d: -f1; }
# released <vessel> <reason-pattern|""> <label>: released, said why, before the next pass, still owed
released() {
  local v="$1" why="$2" label="$3" line; line="$(rel_line "$v")"
  if [ ! -e "$QD2/$v" ] && [ ! -e "$MARKER_DIR/$v.quiesce-carry" ] && [ -n "$line" ] \
     && { [ -z "$why" ] || printf '%s' "$line" | grep -q -- "$why"; } \
     && ! grep -q "^PAST-CARRY $v$" "$OUT" && owed_kept "$v" \
     && [ -n "$(first_at '^PAST-CARRY zz-control$')" ] && [ "${line%%:*}" -lt "$(first_at '^PAST-CARRY zz-control$')" ]; then
    ok "$label"
  else bad "$label: expected the carry released with a logged reason before the next pass, the restart still owed (marker $(held_v "$v"); carry $( [ -e "$MARKER_DIR/$v.quiesce-carry" ] && echo kept || echo gone); owed $(owed_kept "$v" && echo kept || echo CHANGED); out: $(tr '\n' '|' < "$OUT" | cut -c1-700))"; fi
}
held_v() { [ -e "$QD2/$1" ] && echo held || echo gone; }

lsetup a-target:fetchfail:carry zz-control:clean; run_loop >> "$OUT" 2>&1
released a-target "fetch failed" "(ef) fetch failed: the carried hold is released, naming the fetch failure, before the next vessel; restart still owed"
lsetup a-target:diverged:carry zz-control:clean; run_loop >> "$OUT" 2>&1
released a-target "DIVERGED" "(ed) diverged: the carried hold is released, naming the divergence, before the next vessel; restart still owed"
lsetup a-target:ahead:carry zz-control:clean; run_loop >> "$OUT" 2>&1
released a-target "ahead of origin" "(ea) clone ahead: the carried hold is released with the reason, restart still owed"
lsetup a-target:ffonly:carry zz-control:clean; run_loop >> "$OUT" 2>&1
released a-target "ff-only pull failed" "(eo) ff-only failed: the carried hold is released with the reason, restart still owed"
lsetup a-target:nohead:carry zz-control:clean; run_loop >> "$OUT" 2>&1
released a-target "" "(eh) HEAD unresolvable (a silent exit): the carried hold is released anyway, restart still owed"
lsetup a-target:clean:carry:noruntime zz-control:clean; run_loop >> "$OUT" 2>&1
released a-target "" "(er) not in this runtime (a silent exit): the carried hold is released anyway, restart still owed"
lsetup a-target:clean:carry:nogit zz-control:clean; run_loop >> "$OUT" 2>&1
released a-target "" "(eg) not a git clone (a silent exit): the carried hold is released anyway, restart still owed"
lsetup a-synthetic-said:clean:carry zz-control:clean; run_loop >> "$OUT" 2>&1
released a-synthetic-said "synthetic early exit" "(ex) GENERIC: an exit injected after the fact releases the carried hold with its own last log line as the reason"
lsetup a-synthetic-silent:clean:carry zz-control:clean; run_loop >> "$OUT" 2>&1
released a-synthetic-silent "" "(es) GENERIC: a silent injected exit releases the carried hold too"

# (el) the LAST pass of the loop leaves early: released after the loop, still naming its own reason
lsetup a-control:clean zz-last:fetchfail:carry; run_loop >> "$OUT" 2>&1
if [ ! -e "$QD2/zz-last" ] && [ ! -e "$MARKER_DIR/zz-last.quiesce-carry" ] && rel_line zz-last | grep -q "fetch failed" && owed_kept zz-last; then
  ok "(el) the last pass leaves early: its carry is released after the loop, naming its own reason, restart still owed"
else bad "(el) last pass: expected the carry released naming the fetch failure (marker $(held_v zz-last); out: $(tr '\n' '|' < "$OUT" | cut -c1-700))"; fi

lsetup a-halt:clean:carry b-after:clean:carry zz-control:clean; run_loop >> "$OUT" 2>&1
if grep -q '^PAST-CARRY a-halt$' "$OUT" && ! grep -q '^PAST-CARRY b-after$' "$OUT" \
   && [ -e "$QD2/a-halt" ] && [ -s "$MARKER_DIR/a-halt.quiesce-carry" ] && [ -z "$(rel_line a-halt)" ] \
   && [ ! -e "$QD2/b-after" ] && [ ! -e "$MARKER_DIR/b-after.quiesce-carry" ] && [ -n "$(rel_line b-after)" ] && owed_kept b-after; then
  ok "(eb) the loop halts: a later vessel's carry, never visited, is released after the loop; the handled one is kept"
else bad "(eb) loop halt: expected b-after's carry released after the loop and a-halt's kept (a-halt $(held_v a-halt), b-after $(held_v b-after); out: $(tr '\n' '|' < "$OUT" | cut -c1-700))"; fi

lsetup a-target:clean:carry zz-control:clean; run_loop >> "$OUT" 2>&1
if grep -q '^PAST-CARRY a-target$' "$OUT" && [ -e "$QD2/a-target" ] && [ -s "$MARKER_DIR/a-target.quiesce-carry" ] && [ -z "$(rel_line a-target)" ] && owed_kept a-target; then
  ok "(ec) control: a pass that reaches the carry handling keeps the carry for the owed path, no release logged"
else bad "(ec) control: expected the carry left for the owed path (marker $(held_v a-target); out: $(tr '\n' '|' < "$OUT" | cut -c1-700))"; fi

# ── (q4) structural: the unit's TimeoutStartSec is what the expiry adds ───────
_unit="$(dirname "$SCRIPT")/units/substrate-pull-sync.service"
_ts="$(sed -n 's/^TimeoutStartSec=\([0-9]*\)$/\1/p' "$_unit" 2>/dev/null)"
_df="$(grep -o 'UNIT_TIMEOUT_S:-[0-9]*' "$SCRIPT" | sort -u)"
if [ -n "$_ts" ] && [ "$_df" = "UNIT_TIMEOUT_S:-$_ts" ] && sed -n '/^quiesce_mark() {/,/^}/p' "$SCRIPT" | grep -q 'UNIT_TIMEOUT_S'; then
  ok "(q4) quiesce_mark adds UNIT_TIMEOUT_S, whose every default ($_df) is the unit's TimeoutStartSec=$_ts"
else bad "(q4) UNIT_TIMEOUT_S defaults '$(echo $_df)' vs TimeoutStartSec='$_ts', or quiesce_mark does not read UNIT_TIMEOUT_S"; fi

echo
[ "$FAILS" = 0 ] && { echo "PASS - owed restarts survive content moving on"; exit 0; }
echo "$FAILS failing"; exit 1
