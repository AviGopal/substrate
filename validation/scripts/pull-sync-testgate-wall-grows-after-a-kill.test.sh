#!/usr/bin/env bash
# pull-sync's derived per-run wall (scripts/substrate/substrate-pull-sync.sh, "THE PER-RUN WALL IS DERIVED PER VESSEL") was
# last-completed x 1.5 and recorded only COMPLETED runs. A suite that outgrew 1.5 x its last completed run was killed at the
# wall on every tick, nothing completed, and the wall never grew: one node logged "per-run wall 345s (last completed full run
# 230s x1.5 ...)" then "suite run KILLED at TEST_TIMEOUT_SECONDS=345" every tick for days, and the runtime stayed on old code.
# Now an UNCONTENDED kill at the derived wall grows the next wall (x1.5 of the killed wall, capped); a completed run resets it.
# Scaled: floor 3 s, a 100 s unit, a 2 s margin, a 1 s grace -> cap (100-2)/4-1 = 23 s. "230 s last completed" is 4 s (wall 6 s);
# "a suite needing 400 s" is a 7 s stub.
#   (a) MUST-FAIL: last completed 4 s, the suite needs 7 s -> within 3 ticks a run completes and the candidate converges
#       (at the parent every tick is killed at the same 6 s wall, forever); the growth is logged in the wall's why
#   (b) after that completed run, last_killed_wall_s is cleared and the next wall is completed x 1.5 again
#   (c) CONTROL: a suite that completes keeps today's wall exactly (last completed 6 s -> 9 s, the same log line)
#   (d) CONTROL: a kill on a CONTENDED host defers and does NOT grow the wall (it measured the host, not the suite)
#   (e) CONTROL: a kill at a pinned TEST_TIMEOUT_SECONDS records nothing; the pin still wins
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
# the host is contended once the stub suite has marked it (case d); never before a run starts
host_contended() { [ -f "$T/hot" ] && { HC_WHY="stub pressure"; return 0; }; HC_WHY=""; return 1; }
mkdir -p "$T/bin" "$T/stub"
# bun test: sleeps $T/stub/sleep seconds (0 when absent), marks the host hot when $T/stub/hot exists, prints $T/stub/full
cat > "$T/bin/bun" <<BUN
#!/usr/bin/env bash
[ "\$1" = test ] || exit 0
[ -f "$T/stub/hot" ] && : > "$T/hot"
[ -s "$T/stub/sleep" ] && sleep "\$(cat "$T/stub/sleep")"
cat "$T/stub/full"; exit 1
BUN
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"
GTR_NODE=node-a; CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3; PROTECTED_SCOPE_FILE="$T/scope.json"; echo '{"autonomyScope":{"excluded_paths":["repos/development-vessel/test/none.test.ts"]}}' > "$PROTECTED_SCOPE_FILE"
OLD='(fail) old > one'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
scale() { unset GATE_BUDGET_SECONDS QUIESCE_MARGIN_S PROTECTED_TEST_TIMEOUT_SECONDS TEST_TIMEOUT_SECONDS; SUITE_WALL_FLOOR_S=3; UNIT_TIMEOUT_S=100; GATE_UNIT_MARGIN_S=2; TEST_KILL_GRACE_SECONDS=1; }
setup() { # $1 suite seconds ; $2 last completed wall (s)
  VESSEL=activity-api; d="$CLONE_DIR/$VESSEL"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/hot" "$T/stub/hot"; mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base; git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g add -A; g commit -m change
  printf '(pass) a > works\n%s\n 5 pass\n 1 fail\n' "$OLD" > "$T/stub/full"
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  echo "$1" > "$T/stub/sleep"; echo "{\"last_completed_wall_s\":$2}" > "$MARKER_DIR/$VESSEL.suite-wall"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { : > "$CALLS"; : > "$LOG"; rm -f "$T/hot"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_gate 2>>"$LOG"; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
W() { jq -r ".$1 // empty" "$MARKER_DIR/$VESSEL.suite-wall" 2>/dev/null; }
logs() { tr '\n' '|' < "$LOG" | cut -c1-500; }

# (a) MUST-FAIL: a 7 s suite whose last completed run was 4 s (wall 6 s) converges within N=3 ticks
scale; setup 7 4; N=3; at=0; walls=""; grown=""
for i in $(seq 1 "$N"); do
  tick; walls="$walls $(sed -n 's/.*per-run wall \([0-9]*\)s.*/\1/p' "$LOG" | head -1)"
  grep -q 'per-run wall [0-9]*s (GROWN: the last run was killed at its 6s wall' "$LOG" && grown=1
  converged && { at=$i; break; }
done
[ "$at" -gt 0 ] && ok "(a) the suite outgrowing 1.5 x its last completed run gets a completed run and converges on tick $at of $N (walls:$walls)" || bad "(a) killed at the wall on every one of $N ticks (walls:$walls; log: $(logs))"
[ -n "$grown" ] && ok "(a) the grown wall is logged with its cause in the wall's why" || bad "(a) no GROWN wall logged (walls:$walls)"
# (b) the completed run resets the growth
[ -z "$(W last_killed_wall_s)" ] && [ "$(W last_completed_wall_s)" -ge 7 ] 2>/dev/null && ok "(b) the completed run ($(W last_completed_wall_s) s) is recorded and last_killed_wall_s is cleared" || bad "(b) suite-wall: $(cat "$MARKER_DIR/$VESSEL.suite-wall" 2>/dev/null)"
_l="$(W last_completed_wall_s)"; echo 0 > "$T/stub/sleep"; tick
grep -q "per-run wall $(( (_l * 3 + 1) / 2 ))s (last completed full run ${_l}s x1.5, floor 3s, cap 23s)" "$LOG" && ok "(b) the next wall is completed x 1.5 again" || bad "(b) (log: $(grep 'per-run wall' "$LOG"))"

# (c) CONTROL: a completing suite keeps today's wall exactly
scale; setup 0 6; tick
grep -q 'per-run wall 9s (last completed full run 6s x1.5, floor 3s, cap 23s)$' "$LOG" && converged && ok "(c) a completing suite keeps last completed x 1.5 (9 s), the same log line, and converges" || bad "(c) (log: $(logs))"
[ -z "$(W last_killed_wall_s)" ] && [ "$(W effective_wall_s)" = 9 ] && ok "(c) suite-wall: effective 9 s, no last_killed_wall_s" || bad "(c) suite-wall: $(cat "$MARKER_DIR/$VESSEL.suite-wall")"

# (d) CONTROL: a kill on a contended host defers and grows nothing
scale; setup 7 4; : > "$T/stub/hot"; tick
grep -q 'while the host was contended' "$LOG" && ! grep -q 'TEST GATE BLIND' "$LOG" && ok "(d) a kill on a contended host is the existing deferral" || bad "(d) (log: $(logs))"
[ -z "$(W last_killed_wall_s)" ] && ok "(d) the contended kill records no last_killed_wall_s" || bad "(d) suite-wall: $(cat "$MARKER_DIR/$VESSEL.suite-wall")"
rm -f "$T/stub/hot"; echo 0 > "$T/stub/sleep"; tick
grep -q 'per-run wall 6s (last completed full run 4s x1.5, floor 3s, cap 23s)$' "$LOG" && ok "(d) the next wall is unchanged (6 s)" || bad "(d) the wall grew after a contended kill (log: $(grep 'per-run wall' "$LOG"))"

# (e) CONTROL: a pinned TEST_TIMEOUT_SECONDS kill records nothing and the pin wins
scale; setup 7 4; TEST_TIMEOUT_SECONDS=5; tick
grep -q 'KILLED at TEST_TIMEOUT_SECONDS=5' "$LOG" && [ -z "$(W last_killed_wall_s)" ] && ok "(e) a kill at a pinned 5 s wall records no growth" || bad "(e) suite-wall: $(cat "$MARKER_DIR/$VESSEL.suite-wall"); log: $(logs)"
tick
grep -q 'per-run wall 5s (TEST_TIMEOUT_SECONDS set' "$LOG" && ok "(e) the pin still wins" || bad "(e) (log: $(grep 'per-run wall' "$LOG"))"
unset TEST_TIMEOUT_SECONDS
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
