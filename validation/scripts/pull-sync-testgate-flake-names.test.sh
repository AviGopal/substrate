#!/usr/bin/env bash
# pull-sync's test gate must NAME the tests behind a flake verdict, before it overwrites the stored
# baseline names (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice, the
# "did not reproduce on re-run" branch). Runs the script's own code against a temp vessel clone with
# `bun` stubbed so each whole-suite run prints its own output. No network.
#
# Observed: the flake line logged only the COUNT of each run's newly-failing set, then
# tg_write_failnames replaced the baseline names with the chosen run's. No reader could say which
# tests flaked, so every flake verdict was unattributable and a test flaking on every tick could
# never be told from fresh noise.
#
#   (a) MUST-FAIL: run1 and run2 fail DISJOINT new sets -> converged as a flake, and the log names
#       run1's set and run2's set (and an empty intersection) on a line written before the baseline
#       is overwritten
#   (b) the names are bounded: 25 new names in run1 -> at most 20 logged, the field cut to 400 chars
#   (c) control: a newly-failing test that reproduces in both runs and is attributable at the
#       parent/candidate overlay still REFUSES the install, as before (no flake line)
#
# usage: validation/scripts/pull-sync-testgate-flake-names.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, awk, sed, timeout.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^unit_timeout_s() {/,/^}/p' "$SCRIPT"
  echo 'run_gate() {'
  echo 'for v in "$VESSEL"; do'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"'
  echo 'done'
  echo '}'
} > "$T/fns.sh"
grep -q 'testgate-refusals' "$T/fns.sh" || { echo "FAIL - could not extract the test-gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"

CALLS="$T/calls.txt"; LOG="$T/log.txt"
# The log records the baseline names file as it stood when each line was written, so (a) can tell a
# line written before the overwrite from one written after it.
log() { echo "$* [baseline:$(tr '\n' ';' < "$TEST_BASELINE_DIR/$VESSEL.failnames" 2>/dev/null)]" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }
ensure_clone_deps() { return 0; }
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
tuning_param() { TP_VALUE="$2"; }

mkdir -p "$T/bin" "$T/stub"
# bun test -> whole-suite run N prints $S/full-N when present, else $S/full (run order: T1, T2, overlay parent,
# overlay candidate); bun test <file> -> green
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = test ] || exit 0
shift
if [ \$# -eq 0 ]; then echo SUITE >> "$T/runs.txt"; n=\$(grep -c '^SUITE' "$T/runs.txt"); if [ -f "\$S/full-\$n" ]; then cat "\$S/full-\$n"; else cat "\$S/full"; fi; exit 1; fi
printf '(pass) p > ok\n 3 pass\n 0 fail\n'; exit 0
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

GTR_NODE=n1
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"
unset GATE_BUDGET_SECONDS GATE_UNIT_MARGIN_S QUIESCE_MARGIN_S PROTECTED_TEST_TIMEOUT_SECONDS
TEST_TIMEOUT_SECONDS=240; TEST_KILL_GRACE_SECONDS=30; UNIT_TIMEOUT_S=3600
OLD='(fail) old > one'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
suite_out() { # names... -> a suite output failing OLD plus each named test
  { echo '(pass) a > works'; echo "$OLD"; for n in "$@"; do echo "(fail) $n"; done; printf ' 5 pass\n %s fail\n' "$(( $# + 1 ))"; }
}

setup() {
  VESSEL=activity-api; d="$CLONE_DIR/$VESSEL/"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/runs.txt" "$T/stub"/full*
  mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am change
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
  suite_out > "$T/stub/full"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { : > "$CALLS"; : > "$LOG"; : > "$T/runs.txt"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_gate; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
names_line() { grep 'flake names' "$LOG" | head -n 1; }

# ── (a) disjoint run1/run2 sets: flake, and both sets are named before the overwrite ──
setup
suite_out 'flaky > alpha' 'flaky > beta' > "$T/stub/full-1"
suite_out 'flaky > gamma' > "$T/stub/full-2"
tick
converged && grep -q 'did not reproduce on re-run' "$LOG" && ok "(a) disjoint new sets converge as a flake" || bad "(a) setup: not a flake verdict (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
L="$(names_line)"
{ [[ "$L" == *"run1 new: "*"flaky > alpha;"* ]] && [[ "$L" == *"flaky > beta;"*"run2 new:"* ]]; } && ok "(a) run1's newly-failing names are logged" || bad "(a) run1's names are not in the log (line: ${L:-none})"
[[ "$L" == *"run2 new: (fail) flaky > gamma;"* ]] && ok "(a) run2's newly-failing names are logged" || bad "(a) run2's names are not in the log (line: ${L:-none})"
[[ "$L" == *"both:  [baseline:"* ]] && ok "(a) the (empty) intersection is logged" || bad "(a) the intersection is not logged as empty (line: ${L:-none})"
[[ "$L" == *"[baseline:${OLD};]" ]] && ok "(a) the names are logged BEFORE the baseline is overwritten" || bad "(a) the names line was not written against the old baseline (line: ${L:-none})"
grep -qF 'flaky > gamma' "$TEST_BASELINE_DIR/$VESSEL.failnames" 2>/dev/null || grep -qF 'flaky > alpha' "$TEST_BASELINE_DIR/$VESSEL.failnames" 2>/dev/null \
  && ok "(a) the baseline is still refreshed as before" || bad "(a) the baseline was not refreshed"

# ── (b) bounded: 25 names -> at most 20, each field at most 400 chars ─────────────
setup
many=(); for i in $(seq -w 1 25); do many+=("flaky > name-$i"); done
suite_out "${many[@]}" > "$T/stub/full-1"; suite_out 'flaky > other' > "$T/stub/full-2"
tick
L="$(names_line)"; R1="${L#*run1 new: }"; R1="${R1%%; run2 new:*}"
n="$(printf '%s' "$R1" | tr ';' '\n' | grep -c 'name-' || true)"
{ [ -n "$L" ] && [ "$n" -le 20 ] && [ "$n" -gt 0 ] && [ "${#R1}" -le 401 ]; } && ok "(b) run1's field is bounded ($n names, ${#R1} chars)" || bad "(b) run1's field is unbounded or missing ($n names, ${#R1} chars; line: ${L:-none})"
[[ "$L" == *"name-21"* ]] && bad "(b) a 21st name was logged" || ok "(b) no name past the 20th"

# ── (c) control: a reproduced, attributable newly-failing test still refuses ─────
setup
suite_out 'real > regressed' > "$T/stub/full"   # T1, T2, overlay candidate
suite_out > "$T/stub/full-3"                     # overlay parent: the name passes there
tick
grep -q 'TEST REGRESSION' "$LOG" && ! converged && ok "(c) control: a reproduced newly-failing test REFUSES the install" || bad "(c) control changed (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
grep -q 'flake names' "$LOG" && bad "(c) a flake line was written for a refused regression" || ok "(c) no flake line on a refusal"
grep -q 'pull-sync-test-regression-activity-api' "$CALLS" && ok "(c) the regression gap is filed as before" || bad "(c) no regression gap"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
