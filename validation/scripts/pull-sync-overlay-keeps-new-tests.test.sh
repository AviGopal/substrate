#!/usr/bin/env bash
# pull-sync's test gate (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice) narrows the tests newly
# failing in both candidate runs with an overlay: parent and candidate each run once in a worktree under identical
# conditions, and a name failing at the parent too, or not failing at the candidate there, is cleared. A test the
# commit adds cannot fail at a parent that lacks it, so a worktree pass alone would clear it, by the path-dependence
# the overlay guards against. Driven with a bun stub that fails the new test in the clone and passes it in a worktree.
#   (a) MUST-FAIL: a test the parent does not have, failing in both candidate runs and passing in the candidate's
#       worktree, is kept: the candidate is refused, and the log says the overlay kept it, naming it
#   (b) control: the same name failing at the parent's worktree too is cleared: converges, and the log names what the
#       overlay cleared and does not say the failures "did not reproduce"
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
# bun test: in the clone the new test fails; in a worktree, the candidate's tree (x = 2) passes it, and the parent's tree
# prints $T/stub/parent (without the new test, or failing it, per case)
cat > "$T/bin/bun" <<BUN
#!/usr/bin/env bash
[ "\$1" = test ] || exit 0
if [ "\$(pwd -P)" = "\$(cd "$T/clones/activity-api" && pwd -P)" ]; then cat "$T/stub/clone"; exit 1; fi
if grep -q 'x = 2' src/x.ts 2>/dev/null; then cat "$T/stub/cand"; exit 1; fi
cat "$T/stub/parent"; exit 1
BUN
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"
GTR_NODE=node-a; CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3; PROTECTED_SCOPE_FILE="$T/scope.json"; echo '{"autonomyScope":{"excluded_paths":["repos/development-vessel/test/none.test.ts"]}}' > "$PROTECTED_SCOPE_FILE"
OLD='(fail) old > one'; NEWT='new > added'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
setup() { # $1: parent's run of the new test: absent | fails
  unset GATE_BUDGET_SECONDS QUIESCE_MARGIN_S PROTECTED_TEST_TIMEOUT_SECONDS TEST_TIMEOUT_SECONDS
  SUITE_WALL_FLOOR_S=3; UNIT_TIMEOUT_S=100; GATE_UNIT_MARGIN_S=2; TEST_KILL_GRACE_SECONDS=1
  VESSEL=activity-api; d="$CLONE_DIR/$VESSEL"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp"; mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base; git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g add -A; g commit -m change
  printf '(pass) a > works\n%s\n(fail) %s\n 5 pass\n 2 fail\n' "$OLD" "$NEWT" > "$T/stub/clone"
  printf '(pass) a > works\n%s\n(pass) %s\n 6 pass\n 1 fail\n' "$OLD" "$NEWT" > "$T/stub/cand"
  if [ "$1" = absent ]; then printf '(pass) a > works\n%s\n 5 pass\n 1 fail\n' "$OLD" > "$T/stub/parent"
  else printf '(pass) a > works\n%s\n(fail) %s\n 5 pass\n 2 fail\n' "$OLD" "$NEWT" > "$T/stub/parent"; fi
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  echo '{"last_completed_wall_s":2}' > "$MARKER_DIR/$VESSEL.suite-wall"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_gate 2>>"$LOG"; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }

# (a) the parent does not have the test: kept, refused
setup absent; tick
grep -q 'overlay comparison' "$LOG" || bad "(a) the overlay did not run (log: $(tr '\n' '|' < "$LOG" | cut -c1-600))"
! converged && grep -q "overlay kept 1 test(s) the parent does not have, failing in both candidate runs: (fail) $NEWT" "$LOG" \
  && ok "(a) a new test failing in both runs is kept by the overlay, named, and the candidate is refused" \
  || bad "(a) (converged=$(converged && echo yes || echo no); log: $(tr '\n' '|' < "$LOG" | cut -c1-700))"
# (b) the parent fails it too: cleared, converges, said as cleared
setup fails; tick
converged && grep -q "cleared by overlay (failing in both candidate runs.*(fail) $NEWT" "$LOG" && grep -q 'reproduced in both runs but the overlay cleared them' "$LOG" \
  && ! grep -q 'did not reproduce' "$LOG" \
  && ok "(b) a name failing at the parent too is cleared, named as cleared by the overlay, never as not reproducing" \
  || bad "(b) (converged=$(converged && echo yes || echo no); log: $(tr '\n' '|' < "$LOG" | cut -c1-700))"
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
