#!/usr/bin/env bash
# pull-sync holds restarts (and all vessel convergence) while an open, in-cap probeWindow record names THIS
# node explicitly (scripts/substrate/substrate-pull-sync.sh probe_window_open, restart_age_defer, vessel loop).
# Runs the script's own functions with curl stubbed to return canned probeWindow / probeWindowOverride reads.
#
#   (a) open window for this node                  -> restart_age_defer defers, RA_PROBE=1
#   (b) window for node "*"                         -> NO hold (any fleet-key holder could write one)
#   (c) window for another node                     -> no hold
#   (d) window whose until is past                  -> no hold
#   (e) no records                                  -> no hold
#   (f) unreadable store                            -> no hold; the log names the last window seen open
#   (g) the vessel loop checks the window before any fetch (static)
#   (h) no until, from older than the cap           -> no hold, and the cap expiry is logged
#   (i) no until, recent from                       -> holds
#   (j) open window plus an open override for this node -> no hold, override logged
#   (k) no from: the record's injected_at bounds the cap
#
# usage: validation/scripts/pull-sync-probe-window.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  sed -n '/^probe_window_open() {/,/^}/p' "$SCRIPT"
  sed -n '/^restart_age_defer() {/,/^}/p' "$SCRIPT"
} > "$T/fns.sh"
grep -q 'probeWindow' "$T/fns.sh" || { echo "FAIL - could not extract probe_window_open"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
RESP="$T/resp.json"; OVR="$T/ovr.json"
curl() { cat > /dev/null; case "$*" in *probeWindowOverride*) cat "$OVR" 2>/dev/null || printf '{"body":{"impulses":[]}}' ;; *) cat "$RESP" ;; esac; }
hostname() { echo node-test; }
tuning_param() { TP_VALUE="$2"; }
MARKER_DIR="$T/marker"; mkdir -p "$MARKER_DIR"
export FED_SUBSTRATE_ID=node-test
# shellcheck disable=SC1090
source "$T/fns.sh"
iso() { date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ; }
future="$(iso '+1 hour')"; past="$(iso '-1 hour')"; start="$(iso '-10 min')"; old="$(iso '-3 hours')"
rec() { # node from until [shape] [injected_at]
  printf '{"success":true,"body":{"impulses":[{"id":"pw-x","shape":"%s","status":"open","injected_at":"%s","body":{"node":"%s"%s%s,"tag":"r9"}}]}}' \
    "${4:-probeWindow}" "${5:-$start}" "$1" "$( [ -n "$2" ] && printf ',"from":"%s"' "$2")" "$( [ -n "$3" ] && printf ',"until":"%s"' "$3")"
}
run() { PW_STATE=""; : > "$LOG"; restart_age_defer "" 0; }
noovr() { printf '{"body":{"impulses":[]}}' > "$OVR"; }

noovr; rec node-test "$start" "$future" > "$RESP"; run
[ "$RA_DEFER" = 1 ] && [ "$RA_PROBE" = 1 ] && ok "(a) open window for this node defers" || bad "(a) RA_DEFER=$RA_DEFER RA_PROBE=$RA_PROBE"
rec '*' "$start" "$future" > "$RESP"; run
[ "$RA_PROBE" = 0 ] && ok "(b) a wildcard window does not hold" || bad "(b) wildcard window held"
rec other-node "$start" "$future" > "$RESP"; run
[ "$RA_PROBE" = 0 ] && [ "$RA_DEFER" = 0 ] && ok "(c) another node's window does not hold" || bad "(c) another node's window held"
rec node-test "$old" "$past" > "$RESP"; run
[ "$RA_PROBE" = 0 ] && ok "(d) an expired window does not hold" || bad "(d) expired window held"
printf '{"success":true,"body":{"impulses":[]}}' > "$RESP"; run
[ "$RA_PROBE" = 0 ] && ok "(e) no records, no hold" || bad "(e) no records held"
rec node-test "$start" "$future" > "$RESP"; run   # remember pw-x as last open
printf 'not json' > "$RESP"; run
[ "$RA_PROBE" = 0 ] && grep -q "unreadable" "$LOG" && grep -q "pw-x" "$LOG" && ok "(f) unreadable: no hold, logged with the last window seen open" || bad "(f) RA_PROBE=$RA_PROBE log=$(cat "$LOG")"
loop="$(awk '/^for d in "\$CLONE_DIR"\/\*\/; do/{on=1} on{print} on && /git -C "\$d" fetch/{exit}' "$SCRIPT")"
printf '%s' "$loop" | grep -q 'probe_window_open' && ok "(g) the vessel loop checks the window before any fetch" || bad "(g) no window check before fetch"
rec node-test "$old" "" > "$RESP"; run
[ "$RA_PROBE" = 0 ] && grep -q "probe_window_max_seconds" "$LOG" && ok "(h) open-ended window older than the cap stops holding, logged" || bad "(h) RA_PROBE=$RA_PROBE log=$(cat "$LOG")"
rec node-test "$start" "" > "$RESP"; run
[ "$RA_PROBE" = 1 ] && ok "(i) open-ended recent window holds" || bad "(i) recent open-ended window did not hold"
rec node-test "$start" "$future" > "$RESP"; rec node-test "$start" "$future" probeWindowOverride > "$OVR"; run
[ "$RA_PROBE" = 0 ] && grep -q "override" "$LOG" && ok "(j) an override for this node lets convergence through, logged" || bad "(j) RA_PROBE=$RA_PROBE log=$(cat "$LOG")"
noovr; rec node-test "" "" probeWindow "$old" > "$RESP"; run
[ "$RA_PROBE" = 0 ] && ok "(k) no from: injected_at bounds the cap" || bad "(k) a window with no from and an old injected_at still held"
echo
[ "$FAILS" = 0 ] && { echo "PASS - probe windows hold pull-sync, bounded and explicit"; exit 0; }
echo "$FAILS failing"; exit 1
