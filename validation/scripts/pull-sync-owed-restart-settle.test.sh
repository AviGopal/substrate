#!/usr/bin/env bash
# An owed restart ends like a same-tick one, and a stale last-good pin is never a revert target
# (scripts/substrate/substrate-pull-sync.sh: owed_restart_settle, pin_running_baseline, and their call sites).
#
# The failure it pins: a restart deferred for in-flight work and taken on a later tick ("taking OWED restart") fell
# straight into the content short-circuit, so it neither health-checked the restarted unit nor wrote
# /workspace/.last-good/<v>. Measured 2026-10-13: development-vessel's pin stayed on a commit four loaded landings old,
# on both nodes. Every pin reader (the same-tick revert, self-recovery's revert) would then roll back all of them at once.
#
# owed_restart_settle (taken from the script itself; systemctl, /health, the mirror, the revert hash and the gap
# writer stubbed and recorded):
#   (a) healthy, runtime == clone -> last-good = HEAD, no halt
#   (b) healthy, runtime != clone (the clone moved) -> pin untouched: the same-tick path records it
#   (c) no health port -> pinned without a health call (the same-tick path's rule)
#   (d) unhealthy, the pin predates the replaced process -> NO mirror, NO restart, gap "not reverted", halt, pin kept
#   (e) unhealthy, the replaced process's start unreadable -> the same as (d)
#   (f) unhealthy, the pin was recorded for the replaced process -> mirror to the pin, restart, gap "reverted", halt
#   (g) unhealthy, fresh pin, the revert lands the wrong content -> revert-failed gap, halt
# pin_running_baseline:
#   (h) stale pin, active, running 10 min, no src file newer than the start, healthy -> pinned
#   (i) running 1 min -> not pinned            (j) a src file newer than the start -> not pinned
#   (k) unhealthy -> not pinned                (l) inactive -> not pinned
#   (m) pin already HEAD -> not rewritten (one read, nothing else)
# structure:
#   (n) the owed block reads the replaced process's start BEFORE its restart and settles AFTER it, then halts on OWED_HALT
#   (o) the content short-circuit re-pins (pin_running_baseline) before its `continue`
#
# usage: validation/scripts/pull-sync-owed-restart-settle.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, awk, sed, find, GNU date/touch/stat. No root: every path is a temp dir.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{
  sed -n '/^owed_restart_settle() {/,/^}/p' "$SCRIPT"
  sed -n '/^pin_running_baseline() {/,/^}/p' "$SCRIPT"
} > "$T/fns.sh"
grep -q '^owed_restart_settle() {' "$T/fns.sh" && grep -q '^pin_running_baseline() {' "$T/fns.sh" \
  || { echo "FAIL - could not extract owed_restart_settle / pin_running_baseline"; exit 1; }

CALLS="$T/calls.txt"; LOG="$T/log.txt"; GAPS="$T/gaps.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "$1" >> "$GAPS"; }
HEALTHY=1; UNIT_ACTIVE=1; UNIT_STARTED_EPOCH=0
healthy() { echo "HEALTH $1" >> "$CALLS"; [ "$HEALTHY" = 1 ]; }
systemctl() {
  case "$1" in
    is-active) [ "$UNIT_ACTIVE" = 1 ] ;;
    restart) echo "RESTART $2" >> "$CALLS" ;;
    show) [ "$2" = "-p" ] && [ "$3" = "ActiveEnterTimestamp" ] && date -u -d "@$UNIT_STARTED_EPOCH" '+%a %Y-%m-%d %H:%M:%S UTC' ;;
    *) : ;;
  esac
}
sleep() { :; }
RT_MATCH=1
revert_target_hashes() { echo "REVERT-HASH $2" >> "$CALLS"; RT_WHY=""; RT_WANT=want; if [ "$RT_MATCH" = 1 ]; then RT_LIVE=want; else RT_LIVE=other; fi; return 0; }
content_hash() { echo hash; }
# shellcheck disable=SC1090
source "$T/fns.sh"

V=demo-vessel; U=demo-vessel.service
LAST_GOOD_DIR="$T/last-good"; MARKER_DIR="$T/marker"; RUNTIME_DIR="$T/runtime"; CLONE_DIR="$T/clones"
PULLSYNC_ACCEPTED_DIR="$T/accepted"; MIRROR_BIN="$T/mirror.sh"
printf '#!/usr/bin/env bash\necho "MIRROR $*" >> "%s"\n' "$CALLS" > "$MIRROR_BIN"
OLD=1111111111111111111111111111111111111111; NEW=2222222222222222222222222222222222222222
NOW="$(date +%s)"

reset() {
  rm -rf "$LAST_GOOD_DIR" "$MARKER_DIR" "$RUNTIME_DIR" "$CALLS" "$LOG" "$GAPS"
  mkdir -p "$LAST_GOOD_DIR" "$MARKER_DIR" "$RUNTIME_DIR/$V/src"; : > "$CALLS"; : > "$LOG"; : > "$GAPS"
  HEALTHY=1; UNIT_ACTIVE=1; RT_MATCH=1; CLONE_HASH=c1; RUNTIME_HASH=c1; OWED_HALT=""
}
pin() { cat "$LAST_GOOD_DIR/$V" 2>/dev/null || echo "<none>"; }
set_pin() { echo "$1" > "$LAST_GOOD_DIR/$V"; touch -d "@$2" "$LAST_GOOD_DIR/$V"; }
has() { grep -q -- "$2" "$1"; }

# ── owed_restart_settle ───────────────────────────────────────────────────────
reset; set_pin "$OLD" $((NOW - 3600))
owed_restart_settle "$V" "$T/clone" "$U" 9999 "$NEW" $((NOW - 600))
[ "$(pin)" = "$NEW" ] && [ "$OWED_HALT" = 0 ] && has "$CALLS" "HEALTH 9999" && ! has "$CALLS" MIRROR \
  && ok "(a) healthy owed restart, runtime == clone: last-good = HEAD, no halt" || bad "(a) pin $(pin) halt $OWED_HALT"

reset; set_pin "$OLD" $((NOW - 3600)); RUNTIME_HASH=c0
owed_restart_settle "$V" "$T/clone" "$U" 9999 "$NEW" $((NOW - 600))
[ "$(pin)" = "$OLD" ] && [ "$OWED_HALT" = 0 ] && ok "(b) healthy, the clone moved past the runtime: pin untouched (the same-tick path records it)" || bad "(b) pin $(pin)"

reset; set_pin "$OLD" $((NOW - 3600))
owed_restart_settle "$V" "$T/clone" "$U" "" "$NEW" $((NOW - 600))
[ "$(pin)" = "$NEW" ] && ! has "$CALLS" HEALTH && ok "(c) no health port: pinned without a health call" || bad "(c) pin $(pin)"

reset; set_pin "$OLD" $((NOW - 3600)); HEALTHY=0
owed_restart_settle "$V" "$T/clone" "$U" 9999 "$NEW" $((NOW - 600))
[ "$OWED_HALT" = 1 ] && [ "$(pin)" = "$OLD" ] && ! has "$CALLS" MIRROR && ! has "$CALLS" RESTART \
  && has "$GAPS" "pull-sync-unhealthy-$V" && has "$GAPS" "not reverted" && has "$LOG" "NOT reverting" \
  && ok "(d) unhealthy, pin older than the replaced process: no mirror, no restart, gap, halt, pin kept" || bad "(d) halt $OWED_HALT calls: $(tr '\n' ' ' < "$CALLS")"

reset; set_pin "$OLD" $((NOW - 60)); HEALTHY=0
owed_restart_settle "$V" "$T/clone" "$U" 9999 "$NEW" ""
[ "$OWED_HALT" = 1 ] && ! has "$CALLS" MIRROR && has "$GAPS" "start time was unreadable" \
  && ok "(e) unhealthy, the replaced process's start unreadable: not reverted, halt" || bad "(e) calls: $(tr '\n' ' ' < "$CALLS")"

reset; set_pin "$OLD" $((NOW - 300)); HEALTHY=0
owed_restart_settle "$V" "$T/clone" "$U" 9999 "$NEW" $((NOW - 600))
[ "$OWED_HALT" = 1 ] && has "$CALLS" "MIRROR $V $CLONE_DIR $OLD $OLD" && has "$CALLS" "REVERT-HASH $OLD" && has "$CALLS" "RESTART $U" \
  && has "$GAPS" "reverted to ${OLD:0:10}" && ! has "$GAPS" "revert-failed" \
  && ok "(f) unhealthy, pin recorded for the replaced process: mirrored to it, verified, restarted, gap, halt" || bad "(f) calls: $(tr '\n' ' ' < "$CALLS")"

reset; set_pin "$OLD" $((NOW - 300)); HEALTHY=0; RT_MATCH=0
owed_restart_settle "$V" "$T/clone" "$U" 9999 "$NEW" $((NOW - 600))
[ "$OWED_HALT" = 1 ] && has "$GAPS" "pull-sync-revert-failed-$V" && has "$LOG" "revert FAILED" \
  && ok "(g) unhealthy, the revert lands the wrong content: revert-failed gap, halt" || bad "(g) gaps: $(cat "$GAPS")"

# ── pin_running_baseline ──────────────────────────────────────────────────────
base() { touch -d "@$((NOW - $2))" "$RUNTIME_DIR/$V/src/a.ts"; UNIT_STARTED_EPOCH=$((NOW - $1)); }
reset; set_pin "$OLD" $((NOW - 7200)); base 600 900
pin_running_baseline "$V" "$U" 9999 "$NEW"
[ "$(pin)" = "$NEW" ] && has "$LOG" "last-good baseline" && ok "(h) stale pin, running healthy 10 min on the mirrored content: pinned" || bad "(h) pin $(pin)"

reset; set_pin "$OLD" $((NOW - 7200)); base 60 900
pin_running_baseline "$V" "$U" 9999 "$NEW"
[ "$(pin)" = "$OLD" ] && ok "(i) running 1 min: not pinned" || bad "(i) pin $(pin)"

reset; set_pin "$OLD" $((NOW - 7200)); base 600 30
pin_running_baseline "$V" "$U" 9999 "$NEW"
[ "$(pin)" = "$OLD" ] && ok "(j) a src file newer than the unit's start: not pinned (it may not be what is loaded)" || bad "(j) pin $(pin)"

reset; set_pin "$OLD" $((NOW - 7200)); base 600 900; HEALTHY=0
pin_running_baseline "$V" "$U" 9999 "$NEW"
[ "$(pin)" = "$OLD" ] && ok "(k) unhealthy now: not pinned" || bad "(k) pin $(pin)"

reset; set_pin "$OLD" $((NOW - 7200)); base 600 900; UNIT_ACTIVE=0
pin_running_baseline "$V" "$U" 9999 "$NEW"
[ "$(pin)" = "$OLD" ] && ok "(l) inactive unit: not pinned" || bad "(l) pin $(pin)"

reset; set_pin "$NEW" $((NOW - 7200)); base 600 900
M0="$(stat -c %Y "$LAST_GOOD_DIR/$V")"
pin_running_baseline "$V" "$U" 9999 "$NEW"
[ "$(stat -c %Y "$LAST_GOOD_DIR/$V")" = "$M0" ] && ! has "$CALLS" HEALTH && ok "(m) pin already HEAD: not rewritten, nothing probed" || bad "(m) rewritten or probed"

# ── structure ─────────────────────────────────────────────────────────────────
OWED="$(awk '/^  # AN OWED RESTART OUTRANKS THE CONTENT SHORT-CIRCUIT/{on=1} on && /^  if \[ "\$CLONE_HASH" = "\$RUNTIME_HASH" \]; then$/{exit} on{print}' "$SCRIPT")"
ln_of() { printf '%s\n' "$OWED" | grep -n -F -- "$1" | head -1 | cut -d: -f1; }
a=$(ln_of 'P_PREV_START="$(date -d "$(systemctl show -p ActiveEnterTimestamp'); b=$(ln_of 'systemctl restart "$P_UNIT"')
c=$(ln_of 'owed_restart_settle "$v"'); e=$(ln_of '[ "${OWED_HALT:-0}" = 1 ] && { failed=')
[ -n "$a" ] && [ -n "$b" ] && [ -n "$c" ] && [ -n "$e" ] && [ "$a" -lt "$b" ] && [ "$b" -lt "$c" ] && [ "$c" -lt "$e" ] \
  && ok "(n) owed block: replaced process's start read before the restart, settled after it, halt on OWED_HALT" || bad "(n) order a=$a b=$b c=$c e=$e"

SC="$(awk '/^  if \[ "\$CLONE_HASH" = "\$RUNTIME_HASH" \]; then$/{on=1} on{print} on && /^      continue$/{exit}' "$SCRIPT")"
printf '%s\n' "$SC" | tail -2 | head -1 | grep -q 'pin_running_baseline "$v" "$(vessel_unit "$v")" "$(health_port "$v")" "$HEAD"' \
  && ok "(o) the content short-circuit re-pins a stale last-good before its continue" || bad "(o) short-circuit tail: $(printf '%s\n' "$SC" | tail -2 | tr '\n' '|')"

echo "---"; [ "$FAILS" = 0 ] && { echo "PASS: owed restart settle + last-good baseline"; exit 0; } || { echo "FAILED: $FAILS"; exit 1; }
