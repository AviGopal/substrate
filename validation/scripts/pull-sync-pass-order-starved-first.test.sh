#!/usr/bin/env bash
# A BUDGET-STARVED VESSEL GATES FIRST (scripts/substrate/substrate-pull-sync.sh, pass_order and testgate_budget_defer).
# The deferred set rotated by <v>.testgate-slot, so a starved vessel waited behind every other deferred candidate, each of
# which spent the tick before it: development-vessel stayed budget-starved on both nodes for over a day. A vessel carrying
# <v>.testgate-starved now leads the pass order, and the per-vessel starvation path (across candidates, which is how
# development-vessel starved) writes that marker too, as the per-candidate bound always did.
#   (a) MUST-FAIL: a starved, deferred vessel is gated before deferred vessels that are not starved, even with a later slot
#   (b) MUST-FAIL: a starved vessel whose deferral count was cleared (its last gate finished) still gates first
#   (c) MUST-FAIL: the per-vessel starvation path (deferred past pull_sync.testgate_starve_after_seconds across candidates,
#       below the per-candidate bound) writes <v>.testgate-starved
#   (d) two starved vessels rotate among themselves by slot
#   (e) CONTROL: no markers -> glob order; deferred, none starved -> the slot rotation, unchanged
#   (f) CONTROL: a deferral below both bounds writes no starved marker
# usage: validation/scripts/pull-sync-pass-order-starved-first.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{ sed -n '/^pass_order() {/,/^}/p' "$SCRIPT"; sed -n '/^  testgate_budget_defer() {/,/^  }/p' "$SCRIPT"; } > "$T/fns.sh"
grep -q '^pass_order() {' "$T/fns.sh" && grep -q 'testgate_budget_defer() {' "$T/fns.sh" || { echo "FAIL - could not extract pass_order / testgate_budget_defer"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; LAST_GOOD_DIR="$T/lastgood"
reset() { rm -rf "$CLONE_DIR" "$MARKER_DIR" "$LAST_GOOD_DIR"; mkdir -p "$MARKER_DIR" "$LAST_GOOD_DIR"; for x in aa bb cc dd; do mkdir -p "$CLONE_DIR/$x"; done; }
order() { pass_order | xargs -n1 basename | tr '\n' ' ' | sed 's/ $//'; }
deferred() { echo "h1 1" > "$MARKER_DIR/$1.testgate-budget-defers"; echo "$2" > "$MARKER_DIR/$1.testgate-slot"; }
starved() { echo "h1 3" > "$MARKER_DIR/$1.testgate-starved"; }

reset
o="$(order)"; [ "$o" = "aa bb cc dd" ] && ok "(e) control: no markers -> glob order" || bad "(e) no markers gave '$o'"
deferred bb 500; deferred dd 200; deferred cc 900
o="$(order)"; [ "$o" = "dd bb cc aa" ] && ok "(e) control: deferred, none starved -> slot rotation (dd bb cc, then aa)" || bad "(e) rotation gave '$o'"
starved cc
o="$(order)"; [ "$o" = "cc dd bb aa" ] && ok "(a) the starved vessel (slot 900) gates before the unstarved deferred ones" || bad "(a) starved cc: order '$o'"
reset; starved cc
o="$(order)"; [ "$o" = "cc aa bb dd" ] && ok "(b) a starved vessel with no deferral count still gates first" || bad "(b) starved-only cc: order '$o'"
reset; deferred aa 100; deferred bb 300; starved bb; deferred dd 200; starved dd
o="$(order)"; [ "$o" = "dd bb aa cc" ] && ok "(d) two starved vessels rotate by slot, ahead of the unstarved deferred" || bad "(d) order '$o'"

# (c)/(f): the per-vessel starvation path of testgate_budget_defer
log() { echo "$*" >> "$T/log"; }; emit_gap() { echo "GAP $1" >> "$T/gaps"; }; tg_verdict() { :; }; testgate_key() { echo k; }
gate_left() { echo 10; }
TPV_after=3600; TPV_max=3
tuning_param() { case "$1" in pull_sync.testgate_starve_after_seconds) TP_VALUE="$TPV_after" ;; pull_sync.testgate_budget_defer_max) TP_VALUE="$TPV_max" ;; *) TP_VALUE="$2" ;; esac; }
v=dd; GATE_BUDGET_SECONDS=3600; GV_T0=$(date +%s)
reset; : > "$T/gaps"; echo lg0 > "$LAST_GOOD_DIR/dd"
BD_FILE="$MARKER_DIR/dd.testgate-budget-defers"; TG_NEED_FILE="$MARKER_DIR/dd.testgate-need"
HEAD=h1; testgate_budget_defer "the suite run" 100
[ ! -s "$MARKER_DIR/dd.testgate-starved" ] && ! grep -q budget-starved "$T/gaps" && ok "(f) control: a first deferral writes no starved marker" || bad "(f) a first deferral marked dd starved"
# a new candidate each tick (BD_N stays 1) and the vessel deferred for 4000 s since its last convergence
echo "$(( $(date +%s) - 4000 )) lg0" > "$MARKER_DIR/dd.testgate-starve-since"
HEAD=h2; testgate_budget_defer "the suite run" 100
grep -q 'pull-sync-testgate-budget-starved-dd' "$T/gaps" || echo "#   setup: the per-vessel starvation gap was not filed"
[ -s "$MARKER_DIR/dd.testgate-starved" ] && ok "(c) the per-vessel starvation path writes dd.testgate-starved" || bad "(c) per-vessel starvation filed its gap but wrote no starved marker"
deferred aa 100; echo 999 > "$MARKER_DIR/dd.testgate-slot"   # aa deferred with an earlier slot: the rotation alone puts aa first
o="$(order)"; [ "${o%% *}" = dd ] && ok "(c) ...and dd then gates first" || bad "(c) order after per-vessel starvation '$o'"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
