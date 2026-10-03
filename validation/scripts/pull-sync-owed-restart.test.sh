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
restart_age_defer() { RA_INFLIGHT=0; RA_OLDEST=""; RA_DEFER="$DEFER"; RA_WHY=""; [ "$DEFER" = 1 ] && { RA_INFLIGHT=2; RA_WHY="2 in flight"; }; return 0; }
restart_breadcrumb() { :; }
# shellcheck disable=SC1090
source "$T/fns.sh"

VESSEL=demo-vessel
RUNTIME_DIR="$T/runtime"; MARKER_DIR="$T/marker"; STAGGER_SECONDS=0
P="$MARKER_DIR/$VESSEL.restart-pending"; DF="$MARKER_DIR/$VESSEL.restart-deferrals"

setup() { # a running unit and its runtime src
  rm -rf "$RUNTIME_DIR" "$MARKER_DIR"; mkdir -p "$RUNTIME_DIR/$VESSEL/src" "$MARKER_DIR"
  echo 'export const x = 1;' > "$RUNTIME_DIR/$VESSEL/src/x.ts"
  echo 'test("x", () => {});' > "$RUNTIME_DIR/$VESSEL/src/x.test.ts"
  UNIT_STARTED="Sat 2026-10-03 10:26:55 UTC"
  UNIT_ACTIVE=1; DEFER=0; CLONE_HASH=newhash; : > "$CALLS"; : > "$LOG"
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

echo
[ "$FAILS" = 0 ] && { echo "PASS - owed restarts survive content moving on"; exit 0; }
echo "$FAILS failing"; exit 1
