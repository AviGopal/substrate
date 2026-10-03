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
# THE MIRROR PATH'S QUIESCE HOLDS ADMISSION UNTIL THE RESTART (l-o). Runs the script's
# own in-flight quiesce block (`if [ -z "$DEFER_MARKER" ]` .. the 3-pre test gate) and
# its restart block (`# 3. Restart` .. the restart's stagger sleep), with the test gate
# and mirror replaced by a stub, and the REAL restart_age_defer reading a /health stub.
# The vessel is modelled, not canned: in_flight is a counter, `sleep` drains it by one,
# and a request that tries to start during the gate is admitted only while the
# quiesce marker is absent (development-vessel's quiesced() check).
# Measured 2026-10-03 (node 1): drained 19:41:55, the marker was removed at once, the
# gate ran to 19:47:00, a compose was admitted ~19:45:20, and the restart logged
# "DEFERRING restart — 1 in flight" at 19:47:01: the drain bought nothing.
#   (l) 1 in flight, drains to 0, new content in the same tick, a request arrives
#       during the gate -> it is REFUSED (admission still closed), restart taken in
#       this tick, no "DEFERRING restart", marker released after the restart
#   (m) control: nothing in flight -> no quiesce, no marker, gate, mirror, restart
#   (n) the quiesce hits its bound (never drains) -> the announced "converging
#       anyway" is honoured: restart taken, not deferred; marker released
#   (o) structural: the release runs first in every vessel-loop pass (every
#       `continue` lands there), after the loop, and in the EXIT trap
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
  [ -n "$QDIR_SEEN_FILE" ] && [ -e "$QUIESCE_DIR/$VESSEL" ] && echo seen > "$QDIR_SEEN_FILE"
  printf '{"in_flight":%s}' "${first:-0}"
}
sleep() { :; }
# shellcheck disable=SC1090
source "$T/fns.sh"

VESSEL=demo-vessel
RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; STAGGER_SECONDS=0
QUIESCE_DIR="$T/quiesce"; QUIESCE_STEP_S=1; QUIESCE_WAIT_S=5; UNIT_TIMEOUT_S=900; QUIESCE_MARGIN_S=0; QDIR_SEEN_FILE=""
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

# ══ (l-o) the mirror path's quiesce holds admission through gate, mirror, restart ══
{
  sed -n '/^restart_age_defer() {/,/^}/p' "$SCRIPT"
  sed -n '/^quiesce_release() {/,/^}/p' "$SCRIPT"
  echo 'run_mirror_block() {'
  echo 'for v in "$VESSEL"; do'
  echo 'quiesce_release'
  echo 'DEFER_MARKER=""; IS_AUTHORING_HOST=""'
  awk '/^  if \[ -z "\$DEFER_MARKER" \]; then$/{on=1} on && /^  # 3-pre\. TEST GATE/{exit} on{print}' "$SCRIPT"
  echo 'gate_and_mirror_stub || continue'
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
curl() { printf '{"in_flight":%s,"drain_ms":80000}' "$(cat "$IFC" 2>/dev/null || echo 0)"; }
sleep() {                  # time passing drains one request (admission closed or not)
  [ "${NODRAIN:-0}" = 1 ] && return 0
  local n; n="$(cat "$IFC" 2>/dev/null || echo 0)"; [ "$n" -gt 0 ] && echo $((n - 1)) > "$IFC"; return 0
}
probe_window_open() { return 1; }
test_only_range() { return 1; }
emit_gap() { :; }
gate_and_mirror_stub() {   # new content in the same tick; a request tries to start mid-gate
  HEAD=head-newer; CLONE_HASH=content-newer
  echo "GATE $HEAD" >> "$CALLS"
  if [ "${ARRIVE:-0}" = 1 ]; then
    if [ -e "$QUIESCE_DIR/$VESSEL" ]; then echo "REFUSED new request (admission closed)" >> "$CALLS"
    else echo $(( $(cat "$IFC") + 1 )) > "$IFC"; echo "ADMITTED new request" >> "$CALLS"; fi
  fi
  echo "MIRROR $CLONE_HASH" >> "$CALLS"
  [ -e "$QUIESCE_DIR/$VESSEL" ] && echo "MARKER-HELD-AT-MIRROR" >> "$CALLS"
  return 0
}
# shellcheck disable=SC1090
source "$T/mfns.sh"
HEAD=head-old; DEFERRAL_LOG="$T/deferrals.jsonl"; AUTHORING_HOST_VESSEL=other-vessel
COMPOSE_CEILING_MS=900000; GATE_T0="$(date +%s)"; RUNTIME_NONTEST=old; CLONE_NONTEST=new; PREV_GOOD=""
msetup() { setup; skipped=0; deferred=0; synced=0; failed=0; rm -rf "$QUIESCE_DIR"; echo "$1" > "$IFC"; ARRIVE="${2:-0}"; NODRAIN=0; rm -f "$DEFERRAL_LOG"; HEAD=head-old; CLONE_HASH=content-old; }
order() { grep -n "$1" "$CALLS" | head -1 | cut -d: -f1; }

# ── (l) drained, new content, a request arrives during the gate ────────────────
msetup 1 1
run_mirror_block
if restarted && grep -q "drained to 0" "$LOG" && grep -q "^REFUSED" "$CALLS" && ! grep -q "^ADMITTED" "$CALLS" \
   && ! grep -q "DEFERRING restart" "$LOG" && [ ! -e "$QUIESCE_DIR/$VESSEL" ] \
   && [ "$(order '^MIRROR')" -lt "$(order '^RESTART')" ] && grep -q '^MARKER-HELD-AT-MIRROR' "$CALLS"; then
  ok "(l) drained under quiesce: the mid-gate request is refused, restart taken this tick, marker released after it"
else bad "(l) drained under quiesce: expected admission held closed through gate+mirror and a restart this tick (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'drained\|DEFERRING\|restarting' "$LOG" | tr '\n' ' '))"; fi

# ── (m) control: nothing in flight ─────────────────────────────────────────────
msetup 0 0
run_mirror_block
if restarted && ! grep -q QUIESCED "$LOG" && [ ! -e "$QUIESCE_DIR/$VESSEL" ] && ! grep -q '^MARKER-HELD' "$CALLS" \
   && grep -q '^GATE' "$CALLS" && grep -q '^MIRROR' "$CALLS" && ! grep -q "DEFERRING restart" "$LOG"; then
  ok "(m) control, nothing in flight: no quiesce, gate + mirror + restart as before"
else bad "(m) control: expected plain gate/mirror/restart (calls: $(tr '\n' ' ' < "$CALLS"); log: $(tr '\n' ' ' < "$LOG"))"; fi

# ── (n) the quiesce hits its bound: the announced converge-anyway is honoured ──
msetup 1 0; NODRAIN=1
run_mirror_block
if restarted && grep -q "converging anyway" "$LOG" && ! grep -q "DEFERRING restart" "$LOG" && [ ! -e "$QUIESCE_DIR/$VESSEL" ]; then
  ok "(n) quiesce bound hit: restart taken this tick (the run was already declared lost), marker released"
else bad "(n) quiesce bound hit: expected the restart, not a deferral (calls: $(tr '\n' ' ' < "$CALLS"); log: $(grep -a 'anyway\|DEFERRING\|restarting' "$LOG" | tr '\n' ' '))"; fi
NODRAIN=0

# ── (o) structural: where the release runs in the real script ─────────────────
LOOP_HEAD="$(awk '/^for d in "\$CLONE_DIR"\/\*\/; do$/{on=1;n=0} on{print; if (++n>=4) exit}' "$SCRIPT")"
AFTER_LOOP="$(awk '/^for d in "\$CLONE_DIR"\/\*\/; do$/{inloop=1} inloop && /^done$/{getline; print; exit}' "$SCRIPT")"
if printf '%s' "$LOOP_HEAD" | grep -q '^  quiesce_release$' && [ "$AFTER_LOOP" = quiesce_release ] \
   && grep -q '^trap .*quiesce_release.* EXIT$' "$SCRIPT"; then
  ok "(o) the quiesce hold is released first in every vessel pass, after the loop, and on EXIT"
else bad "(o) expected quiesce_release at the vessel-loop head, right after its done, and in the EXIT trap (head: $(printf '%s' "$LOOP_HEAD" | tr '\n' '|'); after: $AFTER_LOOP)"; fi

echo
[ "$FAILS" = 0 ] && { echo "PASS - owed restarts survive content moving on"; exit 0; }
echo "$FAILS failing"; exit 1
