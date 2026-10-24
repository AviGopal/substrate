#!/usr/bin/env bash
# pull-sync's per-run suite wall is DERIVED per vessel (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice):
# the last completed full-run wall x 1.5, floored (SUITE_WALL_FLOOR_S, 240 s in production) and capped so the two-run overlay
# fits the tick; the cap when nothing was measured yet. On a slower host, development-vessel's suite runs at or
# past a fixed 240 s, so T1 goes BLIND (RC=124) and the overlay parent is killed (pass=none); the candidate
# is then judged on a stale stored baseline and refused for failures that are not its own.
# Scaled: floor 3 s, a 100 s unit, a 2 s margin, a 1 s grace -> cap (100-2)/4-1 = 23 s; the "300 s suite" is a 6 s stub.
#   (a) MUST-FAIL: under a fixed 4 s wall the 6 s suite is killed -> TEST GATE BLIND naming killed_at_wall, not converged
#   (b) MUST-FAIL: cold start (no measurement, no TEST_TIMEOUT_SECONDS) -> the wall is the CAP (a quarter of the budget, so
#       T1, T2 and the two-run overlay fit one tick; not the floor): the 6 s suite
#       completes and the candidate converges; the completed wall (6 s) is recorded in <v>.suite-wall
#   (c) the next gate derives 6 x 1.5 = 9 s and logs it with its inputs
#   (d) MUST-FAIL: the overlay PARENT killed at a fixed 4 s wall -> UNUSABLE naming killed_at_wall, the candidate is HELD and
#       the refusal count does NOT advance (a non-measurement is not a red)
#   (e) control: the same case under the derived wall (steady state, a recorded 6 s run) -> the parent completes, the
#       overlay attributes nothing, converges
#   (f) MUST-FAIL: cold start with the overlay -> T1, T2 and the two-run overlay fit ONE tick at the cap, converges
#   (g) MUST-FAIL: the no-count hold is BOUNDED: the same candidate held 3 ticks without a measurement files
#       pull-sync-testgate-unmeasurable-<v> exactly once (on the 3rd), naming the wall and the cap; a gate that then
#       measures closes it
#   (h) the gaps the gate files carry the effective wall (classification_metadata.effective_wall_s)
# Needs bash, git, jq, timeout.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  echo 'run_gate() {'; echo 'for v in "$VESSEL"; do'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"'; echo 'done'; echo '}'
} > "$T/fns.sh"
grep -q 'testgate-refusals' "$T/fns.sh" || { echo "FAIL - could not extract the test-gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"
CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }; ensure_clone_deps() { return 0; }; ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
tuning_param() { TP_VALUE="$2"; }
mkdir -p "$T/bin" "$T/stub"
# bun test: sleeps 6 s when ./slow exists in the working tree, else 0; prints $S/full; exits 1 (a normal red)
cat > "$T/bin/bun" <<BUN
#!/usr/bin/env bash
[ "\$1" = test ] || exit 0
[ -f ./slow ] && sleep 6
cat "$T/stub/full"; exit 1
BUN
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"
GTR_NODE=node1; CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3; PROTECTED_SCOPE_FILE="$T/scope.json"; echo '{"autonomyScope":{"excluded_paths":["repos/development-vessel/test/none.test.ts"]}}' > "$PROTECTED_SCOPE_FILE"
OLD='(fail) old > one'; NEWF='(fail) new > regressed'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
scale() { unset GATE_BUDGET_SECONDS QUIESCE_MARGIN_S PROTECTED_TEST_TIMEOUT_SECONDS; SUITE_WALL_FLOOR_S=3; UNIT_TIMEOUT_S=100; GATE_UNIT_MARGIN_S=2; TEST_KILL_GRACE_SECONDS=1; }
setup() { # $1 out: same|new ; $2 slow where: none|both|parent
  VESSEL=activity-api; d="$CLONE_DIR/$VESSEL"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp"; mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"; [ "$2" != none ] && echo s > "$d/slow"
  git -C "$d" init -q -b dev; g add -A; g commit -m base; git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; [ "$2" = parent ] && rm -f "$d/slow"; g add -A; g commit -m change
  if [ "$1" = new ]; then printf '(pass) a > works\n%s\n%s\n 5 pass\n 2 fail\n' "$OLD" "$NEWF" > "$T/stub/full"; else printf '(pass) a > works\n%s\n 5 pass\n 1 fail\n' "$OLD" > "$T/stub/full"; fi
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_gate 2>>"$LOG"; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
W() { jq -r ".$1 // empty" "$MARKER_DIR/$VESSEL.suite-wall" 2>/dev/null; }

# (a) fixed 4 s wall, 6 s suite -> killed, BLIND naming the wall
scale; TEST_TIMEOUT_SECONDS=4; setup same both; tick
grep -q 'TEST GATE BLIND' "$LOG" && grep -q 'killed_at_wall' "$LOG" && ! converged && ok "(a) a 6 s suite under a fixed 4 s wall is BLIND, named killed_at_wall, held" || bad "(a) (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
grep -q 'KILLED at TEST_TIMEOUT_SECONDS=4' "$LOG" && ok "(a) the loud kill line names the wall" || bad "(a) no loud kill line"
# (b) cold start, derived: the cap
scale; unset TEST_TIMEOUT_SECONDS; setup same both; tick
grep -q 'per-run wall 23s (no completed full run measured yet: the cap 23s' "$LOG" && ok "(b) cold start: the derived wall is the CAP (23 s, a quarter of the budget), not the floor" || bad "(b) cold-start wall (log: $(grep 'per-run wall' "$LOG"))"
converged && ok "(b) the 6 s suite completes under the derived wall and converges" || bad "(b) not converged (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(W last_completed_wall_s)" -ge 6 ] 2>/dev/null && ok "(b) the completed wall ($(W last_completed_wall_s) s) is recorded in suite-wall" || bad "(b) no recorded wall ($(cat "$MARKER_DIR/$VESSEL.suite-wall" 2>/dev/null))"
# (c) the next gate derives x1.5 from it
cp "$MARKER_DIR/$VESSEL.suite-wall" "$T/sw"; setup same both; cp "$T/sw" "$MARKER_DIR/$VESSEL.suite-wall"; tick
_l="$(jq -r .last_completed_wall_s "$T/sw")"; _want=$(( (_l * 3 + 1) / 2 ))
grep -q "per-run wall ${_want}s (last completed full run ${_l}s x1.5, floor 3s, cap 23s)" "$LOG" && ok "(c) derived ${_l} x 1.5 = ${_want} s, logged with its inputs" || bad "(c) (log: $(grep 'per-run wall' "$LOG"))"
[ "$(W effective_wall_s)" = "$_want" ] && ok "(c) suite-wall publishes effective_wall_s=$_want" || bad "(c) effective_wall_s=$(W effective_wall_s)"
# (d) overlay parent killed at a fixed 4 s wall -> held, refusal not counted
scale; TEST_TIMEOUT_SECONDS=4; setup new parent; tick
grep -q 'UNUSABLE (parent pass=killed_at_wall' "$LOG" && ok "(d) the overlay names killed_at_wall instead of pass=none" || bad "(d) (log: $(tr '\n' '|' < "$LOG" | cut -c1-500))"
grep -q 'without counting a refusal' "$LOG" && [ ! -s "$MARKER_DIR/$VESSEL.testgate-refusals" ] && ! converged && ok "(d) HELD, and the refusal count did not advance" || bad "(d) refusal counted or converged (refusals: $(cat "$MARKER_DIR/$VESSEL.testgate-refusals" 2>/dev/null))"
# (e) control: the derived wall measures the parent. Steady state: a recorded 6 s run -> a 9 s wall. (A COLD start's wall is
#     the cap, a quarter of the budget, so the overlay fits after T1 and T2 there too; (f) checks that.)
scale; unset TEST_TIMEOUT_SECONDS; setup new parent; echo '{"last_completed_wall_s":6}' > "$MARKER_DIR/$VESSEL.suite-wall"; tick
grep -q 'overlay comparison' "$LOG" && ! grep -q UNUSABLE "$LOG" && ok "(e) under the derived wall the parent completes and the overlay measures" || bad "(e) (log: $(tr '\n' '|' < "$LOG" | cut -c1-500))"
converged && ok "(e) nothing attributable to the commit: converges (no false refusal)" || bad "(e) not converged"
# (f) cold start with the overlay: the cap leaves room for T1, T2 and the two-run overlay in ONE tick
scale; unset TEST_TIMEOUT_SECONDS; setup new parent; tick
grep -q 'overlay comparison' "$LOG" && ! grep -q 'DEFERRED' "$LOG" && converged && ok "(f) cold start: T1, T2 and the overlay fit one tick at the cap, converges" || bad "(f) cold start deferred or did not measure (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
# (g) the no-count hold is bounded: 3 holds of the same candidate -> the unmeasurable gap, once; a measurement closes it
scale; TEST_TIMEOUT_SECONDS=4; setup new parent; um=0
for i in 1 2 3; do tick; grep -q 'pull-sync-testgate-unmeasurable-activity-api' "$CALLS" && um=$((um+1)); grep -q 'without counting a refusal' "$LOG" || bad "(g) tick $i did not hold"; done
[ "$um" = 1 ] && ok "(g) three no-count holds file pull-sync-testgate-unmeasurable once (on the 3rd tick)" || bad "(g) the unmeasurable gap was filed $um time(s) in 3 holds"
grep -q '"effective_wall_s":4' "$CALLS" && grep -q '"consecutive_holds":3' "$CALLS" && grep -q 'must grow or the suite must shrink' "$CALLS" && ok "(g) it names the wall, the hold count and the remedy" || bad "(g) gap content ($(grep unmeasurable "$CALLS" | cut -c1-300))"
[ ! -s "$MARKER_DIR/$VESSEL.testgate-refusals" ] && ok "(g) still no refusal counted" || bad "(g) refusals counted: $(cat "$MARKER_DIR/$VESSEL.testgate-refusals")"
unset TEST_TIMEOUT_SECONDS; echo '{"last_completed_wall_s":6}' > "$MARKER_DIR/$VESSEL.suite-wall"; tick
grep -q '"status":"closed"' "$CALLS" && grep -q 'pull-sync-testgate-unmeasurable-activity-api' "$CALLS" && [ ! -f "$MARKER_DIR/$VESSEL.testgate-unmeasured" ] && ok "(g) a gate that measures closes the unmeasurable gap and ends the streak" || bad "(g) not closed (calls: $(cut -c1-200 "$CALLS"))"
# (h) a starvation gap carries the effective wall
scale; TEST_TIMEOUT_SECONDS=20; setup same both; UNIT_TIMEOUT_S=12; tick; tick; tick; UNIT_TIMEOUT_S=100; unset TEST_TIMEOUT_SECONDS
grep -q 'pull-sync-testgate-budget-starved-activity-api' "$CALLS" && grep -q '"effective_wall_s":20' "$CALLS" && ok "(h) the budget-starved gap carries effective_wall_s" || bad "(h) (calls: $(cut -c1-300 "$CALLS"))"
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
