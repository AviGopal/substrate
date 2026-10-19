#!/usr/bin/env bash
# A clone change to scripts/substrate/federation-relay/ restarts the federation units ONLY when they run this clone's
# tree (scripts/substrate/substrate-pull-sync.sh: fed_unit_runs_clone and the relay/transport restart block).
#
# The failure it pins: the transport and relay normally run the IMAGE BAKE (/usr/local/share/substrate/super-repo/...).
# pull-sync restarted them on every clone change under federation-relay/, which reloaded the old baked file, reported
# success, and dropped every peer's circuit. Measured on the hub 2026-10-18T02:39:35Z (the 10-13 ingress-auth.ts came
# back after the change had landed in the clone).
#
# fed_unit_runs_clone (taken from the script itself; systemctl stubbed):
#   (a) WorkingDirectory = $SUPER_DIR/scripts/substrate/federation-relay -> runs the clone (0)
#   (b) WorkingDirectory = $SUPER_DIR itself -> runs the clone (0)
#   (c) WorkingDirectory = the image bake -> not the clone (1), FED_UNIT_WD names it
#   (d) WorkingDirectory empty -> not the clone (1), FED_UNIT_WD = <unset>
#   (e) a sibling path that only shares the prefix ($SUPER_DIR-old/...) -> not the clone (1)
# structure (the block that restarts them):
#   (f) the relay restart sits inside `if fed_unit_runs_clone federation-relay.service`
#   (g) the transport restart is gated on _fed_clone, which is 0 when the transport does not run the clone
#   (h) the NOT-live branch logs, and the marker/synced path still runs (no failed++ for a baked tree)
# the pipefail race (the script runs `set -uo pipefail`):
#   (i) with CHANGED a few thousand lines long and the federation path FIRST, the script's own _fed_changed line
#       sets _fed_changed=1. With `echo "$CHANGED" | grep -q` grep exits on the first line, echo takes SIGPIPE,
#       and the pipeline returns 141, so a real match read as false; a here-string has no writer to kill.
#   (j) positive control: the old `echo | grep -q` form under pipefail does read that list as no match
#   (k) no `echo "$CHANGED" | grep -q` is left in the federation restart block
#
# usage: validation/scripts/pull-sync-fed-baked-tree.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

sed -n '/^fed_unit_runs_clone() {/,/^}/p' "$SCRIPT" > "$T/fns.sh"
grep -q '^fed_unit_runs_clone() {' "$T/fns.sh" || { echo "FAIL - could not extract fed_unit_runs_clone"; exit 1; }

run() { # <workdir value> -> prints "<rc> <FED_UNIT_WD>"
  ( SUPER_DIR=/workspace/git/super-repo; FED_UNIT_WD=""
    systemctl() { [ "$1 $2 $3" = "show -p WorkingDirectory" ] && printf '%s\n' "$WD_STUB"; }
    WD_STUB="$1"; . "$T/fns.sh"
    fed_unit_runs_clone federation-transport-vessel.service; echo "$? $FED_UNIT_WD" )
}
r="$(run /workspace/git/super-repo/scripts/substrate/federation-relay)"; [ "${r%% *}" = 0 ] && ok "(a) clone subdir -> runs the clone" || bad "(a) got '$r'"
r="$(run /workspace/git/super-repo)"; [ "${r%% *}" = 0 ] && ok "(b) the clone root -> runs the clone" || bad "(b) got '$r'"
r="$(run /usr/local/share/substrate/super-repo/scripts/substrate/federation-relay)"
[ "$r" = "1 /usr/local/share/substrate/super-repo/scripts/substrate/federation-relay" ] && ok "(c) image bake -> not the clone, named" || bad "(c) got '$r'"
r="$(run '')"; [ "$r" = "1 <unset>" ] && ok "(d) empty WorkingDirectory -> not the clone, <unset>" || bad "(d) got '$r'"
r="$(run /workspace/git/super-repo-old/scripts/substrate/federation-relay)"; [ "${r%% *}" = 1 ] && ok "(e) a prefix-sharing sibling is not the clone" || bad "(e) got '$r'"

# (f): within the relay block, the restart line must come after `if fed_unit_runs_clone federation-relay.service; then`
awk '/# The relay is restarted ONLY on a real relay.ts change/{inb=1} inb && /if fed_unit_runs_clone federation-relay.service; then/{g=1}
     inb && /systemctl restart federation-relay.service/{print (g ? "guarded" : "bare"); exit}' "$SCRIPT" > "$T/f.out"
[ "$(cat "$T/f.out")" = guarded ] && ok "(f) the relay restart is inside the clone check" || bad "(f) the relay restart is not guarded by fed_unit_runs_clone ($(cat "$T/f.out"))"
grep -qE 'if \[ "\$_fed_changed" = 1 \] && \[ "\$_fed_clone" = 1 \]' "$SCRIPT" \
  && grep -q '! fed_unit_runs_clone federation-transport-vessel.service; then' "$SCRIPT" \
  && ok "(g) the transport restart is gated on _fed_clone (0 when it runs the bake)" || bad "(g) the transport restart is not gated on the clone check"
grep -q 'changed in the clone but is NOT live: federation-transport-vessel runs' "$SCRIPT" \
  && ok "(h) the baked-tree branch says the change is NOT live" || bad "(h) no NOT-live log line"

big="scripts/substrate/federation-relay/ingress-auth.ts"; for i in $(seq 1 6000); do big="$big
repos/some-vessel/src/file-number-$i-with-a-long-enough-name.ts"; done
line="$(grep -m1 '_fed_changed=0; { \[ "\$CHANGED" = "all" \]' "$SCRIPT")"
[ -n "$line" ] || bad "(i) could not find the _fed_changed line"
r="$(set -o pipefail; CHANGED="$big"; eval "$line"; echo "$_fed_changed")"
[ "$r" = 1 ] && ok "(i) a 6000-line CHANGED with the federation path first sets _fed_changed=1" || bad "(i) _fed_changed=$r on a long CHANGED"
old="$(set -o pipefail; CHANGED="$big"; _f=0; { echo "$CHANGED" | grep -q '^scripts/substrate/federation-relay/'; } && _f=1; echo "$_f")"
[ "$old" = 0 ] && ok "(j) control: the echo|grep -q form misses it under pipefail (the race is real)" || echo "  note: (j) the echo|grep -q control did not race on this host (got $old); (i) still holds"
fedblk="$(sed -n '/# The relay is restarted ONLY on a real relay.ts change/,/healthy 8401/p' "$SCRIPT")"
printf '%s\n' "$fedblk" | grep -q 'echo "\$CHANGED" | grep -q' && bad "(k) the federation block still pipes echo into grep -q" || ok "(k) the federation block uses no echo|grep -q"

[ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
