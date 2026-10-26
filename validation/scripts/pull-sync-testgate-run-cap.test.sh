#!/usr/bin/env bash
# pull-sync's per-run cap (scripts/substrate/substrate-pull-sync.sh, THE PER-RUN CAP / testgate_run_cap, used by the gate's
# derived wall and by slow_lane_run). It was a quarter of the tick budget less the kill grace, (3600-120)/4-30 = 840 s:
# development-vessel's suite was killed there under load, the kill spent the tick, and its two-run overlay never fit.
# The cap is now 1200 s (shaped: pull_sync.testgate_run_cap_seconds), clamped so the two-run overlay always fits a tick.
# The cap and wall lines are extracted from the script itself and evaluated at production values.
#   (a) MUST-FAIL: the gate's cap at TimeoutStartSec 3600, margin 120, grace 30 is 1200 s
#   (b) MUST-FAIL: the slow lane's wall at the same values is 1200 s
#   (c) MUST-FAIL: a shaped row is honoured (900), and a row above the ceiling is clamped to B/2 - grace (1710)
#   (d) the invariant: for every row and unit tried, two worst-case runs, 2 x (cap + grace), fit the tick budget,
#       or the cap is the floor
#   (e) CONTROL: an unreadable row (non-numeric) falls back to 1200; a tiny unit is still floored at SUITE_WALL_FLOOR_S
# usage: validation/scripts/pull-sync-testgate-run-cap.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^testgate_run_cap() {/,/^}/p' "$SCRIPT" > "$T/fn.sh"
{ echo 'gate_cap() {'
  awk '/SUITE_WALL_FILE="\$MARKER_DIR\/\$v\.suite-wall"/{on=1; next} on{print} on && /\[ "\$_sw_cap" -lt "\$_sw_floor" \]/{exit}' "$SCRIPT"
  echo 'echo "$_sw_cap"; }'
  echo 'slow_wall() {'
  awk '/_sl_grace="\$\{TEST_KILL_GRACE_SECONDS:-30\}"/{on=1} on{print} on && /\[ "\$_sl_wall" -lt/{exit}' "$SCRIPT"
  echo 'echo "$_sl_wall"; }'
} > "$T/sites.sh"
grep -q '_sw_cap=' "$T/sites.sh" && grep -q '_sl_wall=' "$T/sites.sh" || { echo "FAIL - could not extract the cap sites"; exit 1; }
# shellcheck disable=SC1090
source "$T/fn.sh"; source "$T/sites.sh"
ROW=""
tuning_param() { if [ "$1" = pull_sync.testgate_run_cap_seconds ] && [ -n "$ROW" ]; then TP_VALUE="$ROW"; else TP_VALUE="$2"; fi; }
UNIT_TIMEOUT_S=3600; GATE_UNIT_MARGIN_S=120; TEST_KILL_GRACE_SECONDS=30; unset SUITE_WALL_FLOOR_S

c="$(gate_cap)"; [ "$c" = 1200 ] && ok "(a) the gate's per-run cap is 1200 s" || bad "(a) the gate's per-run cap is ${c}s"
w="$(slow_wall)"; [ "$w" = 1200 ] && ok "(b) the slow lane's wall is 1200 s" || bad "(b) the slow lane's wall is ${w}s"
ROW=900; c="$(gate_cap)"; [ "$c" = 900 ] && ok "(c) a shaped row (900) is honoured" || bad "(c) row 900 gave ${c}s"
ROW=5000; c="$(gate_cap)"; [ "$c" = 1710 ] && ok "(c) a row above the ceiling is clamped to (3600-120)/2-30 = 1710" || bad "(c) row 5000 gave ${c}s"

inv_ok=1
for U in 3600 1800 900 600; do for ROW in "" 900 1200 5000; do
  UNIT_TIMEOUT_S=$U; c="$(gate_cap)"; B=$(( U - 120 ))
  if [ $(( 2 * (c + 30) )) -gt "$B" ] && [ "$c" != 240 ]; then inv_ok=""; echo "#   unit $U row '${ROW}': cap $c, 2x(cap+grace) $(( 2 * (c + 30) )) > $B"; fi
done; done
UNIT_TIMEOUT_S=3600; ROW=""
[ -n "$inv_ok" ] && ok "(d) two worst-case runs fit the tick budget at every row and unit tried (or the cap is the floor)" || bad "(d) the two-run overlay invariant is broken"

ROW=abc; c="$(gate_cap)"; [ "$c" = 1200 ] && ok "(e) control: a non-numeric row falls back to 1200" || bad "(e) non-numeric row gave ${c}s"
ROW=""; UNIT_TIMEOUT_S=300; c="$(gate_cap)"; w="$(slow_wall)"
[ "$c" = 240 ] && [ "$w" = 240 ] && ok "(e) control: a tiny unit is floored at 240 s at both sites" || bad "(e) tiny unit: gate ${c}s, slow lane ${w}s"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
