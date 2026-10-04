#!/usr/bin/env bash
# pull-sync's test-gate STARVATION BREAK may DEFER a convergence, never PROMOTE one past red
# (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice). Runs the script's
# own gate slice against a temp vessel clone with `bun` stubbed: `test` prints canned output
# chosen by the ref being measured (out-<sha>, else the candidate's). No network.
#
# Measured on a spoke: development-vessel was refused 4x by the load-error gate (unnamed
# failures 185 -> 196) while its test files could not resolve
# @avigopal/ias-executor-ts/adapters at the parent AND the candidate, and the 4th refusal
# took the TEST-GATE STARVATION BREAK and promoted it. The red was the ENVIRONMENT (the clone's
# node_modules), not the commit: the gate was blind, and the break deployed past it.
#
#   (a) ENVIRONMENT: 252 failures, most of them files that cannot load, with the module
#       unresolvable at the parent too, and the refusal count already at the bound ->
#       "gate blind — environment", NO convergence, ONE environment gap per (node, vessel)
#       naming the module, no test-regression gap, the refusal counter untouched, the
#       baseline untouched; a second tick files the same gap id again (deduped by id)
#   (b) NON-ENVIRONMENT load regression (unnamed rise, nothing unresolvable) past the bound
#       -> no convergence, the regression gap is ESCALATED (severity high), the baseline is
#       not degraded and no baseline-degraded gap is filed
#   (c) control: a green gate (failures unchanged) converges on the first tick
#
# usage: validation/scripts/pull-sync-testgate-environment-hold.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, awk, sed.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── the code under test, taken from the script itself ─────────────────────────
{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
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
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }
ensure_clone_deps() { return 0; }

mkdir -p "$T/bin" "$T/stub"
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
case "\$1" in
  test)
    f="\$S/out-\$(git rev-parse HEAD 2>/dev/null)"
    if [ -f "\$f" ]; then cat "\$f"; else cat "\$S/clone-out"; fi
    exit 1 ;;
esac
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

VESSEL=development-vessel
GTR_NODE=pubspoke
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
d="$CLONE_DIR/$VESSEL/"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
MOD='@avigopal/ias-executor-ts/adapters'
# The baseline: one named failure and 185 that are files failing to load (unnamed).
BASE_OUT="(pass) a > works
(fail) old > one
error: Cannot find module '$MOD' from '/clone/src/config.ts'
 5 pass
 186 fail"
# The candidate: the same module still unresolvable, and the unnamed count has risen to 250.
# Only ONE line names the module, so the exclusion (U_EXCL) cannot cancel the rise: this is
# the live shape (the module was named AND the unnamed count still rose 185 -> 196).
ENV_OUT="(pass) a > works
(fail) old > one
error: Cannot find module '$MOD' from '/clone/src/config.ts'
 5 pass
 252 fail"
# A load regression with nothing unresolvable (a file that throws at import, say).
LOAD_OUT="(pass) a > works
(fail) old > one
 5 pass
 252 fail"
BASE_NAMES='(fail) old > one'
ENV_GAP_ID="pull-sync-testgate-environment-$GTR_NODE-$VESSEL"

setup() { # base commit pinned as last-good; its measurement is BASE_OUT
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/stub"/*
  mkdir -p "$d/src" "$d/test" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  echo 'test("a", () => {});' > "$d/test/x.test.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  printf '%s\n' "$BASE_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
  printf '%s\n' "$BASE_NAMES" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "186 5 185" > "$TEST_BASELINE_DIR/$VESSEL"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate; }
gap_ids() { grep '^GAP ' "$CALLS" | sed 's/^GAP //' | jq -r '.impulse.pointer.gap.id // empty' 2>/dev/null || true; }
gap_field() { # id jq-filter
  grep '^GAP ' "$CALLS" | sed 's/^GAP //' | jq -r "select(.impulse.pointer.gap.id? == \"$1\") | .impulse.pointer.gap | $2" 2>/dev/null || true
}
baseline_state() { cat "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo; cat "$TEST_BASELINE_DIR/$VESSEL"; }

# ── (a) ENVIRONMENT red at the starvation threshold: HOLD, one environment gap ──
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am runtime
printf '%s\n' "$ENV_OUT" > "$T/stub/clone-out"
echo 3 > "$MARKER_DIR/$VESSEL.testgate-refusals"   # the bound already reached on earlier ticks
BEFORE="$(baseline_state)"
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(a) an ENVIRONMENT red at the starvation threshold was converged (promoted past red)" || ok "(a) environment red at the threshold: no convergence"
grep -qi 'gate blind — environment' "$LOG" && ok "(a) classified as 'gate blind — environment'" || bad "(a) no 'gate blind — environment' classification (log: $(grep -a 'STARVATION\|REFUSING\|BLIND\|load-error' "$LOG" | tr '\n' '|' | cut -c1-400))"
grep -q 'TEST-GATE STARVATION BREAK' "$LOG" && bad "(a) the starvation break fired on an environment red" || ok "(a) the starvation break did not fire"
[ "$(gap_ids | grep -cxF "$ENV_GAP_ID")" = 1 ] && ok "(a) exactly one environment gap for (node, vessel): $ENV_GAP_ID" || bad "(a) environment gap $ENV_GAP_ID filed $(gap_ids | grep -cxF "$ENV_GAP_ID") time(s) (ids: $(gap_ids | tr '\n' ' '))"
gap_field "$ENV_GAP_ID" '.classification_metadata.unresolvable_modules[]?' | grep -qxF "$MOD" && ok "(a) the environment gap names the unresolvable module" || bad "(a) the environment gap does not name $MOD in classification_metadata.unresolvable_modules"
gap_field "$ENV_GAP_ID" '.summary' | grep -qF "$MOD" && ok "(a) the environment gap's summary names the module" || bad "(a) the environment gap's summary does not name $MOD"
[ "$(gap_field "$ENV_GAP_ID" '.classification_metadata.node')" = "$GTR_NODE" ] && ok "(a) the environment gap names the node" || bad "(a) the environment gap does not carry classification_metadata.node=$GTR_NODE"
gap_ids | grep -q '^pull-sync-test-regression-' && bad "(a) an environment red filed a test-regression gap (it invites a lane to 'repair' a non-defect)" || ok "(a) no test-regression gap"
gap_ids | grep -q '^pull-sync-testgate-baseline-degraded-' && bad "(a) a degraded baseline was accepted" || ok "(a) no baseline-degraded gap"
gap_ids | grep -q '^pull-sync-testgate-unresolvable-modules-' && bad "(a) a second gap for the same cause (unresolvable-modules) was filed alongside the environment gap" || ok "(a) one gap for one cause"
[ "$(cat "$MARKER_DIR/$VESSEL.testgate-refusals" 2>/dev/null)" = 3 ] && ok "(a) the refusal counter is untouched (a hold is not a refusal)" || bad "(a) refusal counter now '$(cat "$MARKER_DIR/$VESSEL.testgate-refusals" 2>/dev/null)'"
[ "$(baseline_state)" = "$BEFORE" ] && ok "(a) baseline byte-identical" || bad "(a) baseline rewritten: $(baseline_state | tr '\n' '|')"
[ "$skipped" -ge 1 ] && ok "(a) counted as skipped" || bad "(a) not counted as skipped"
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(a) the second tick converged" || ok "(a) second tick: still held"
[ "$(gap_ids | grep -cxF "$ENV_GAP_ID")" = 1 ] && ok "(a) second tick: the same gap id (deduped by id), once" || bad "(a) second tick filed $ENV_GAP_ID $(gap_ids | grep -cxF "$ENV_GAP_ID") time(s)"

# ── (b) NON-ENVIRONMENT load regression past the bound: defer + escalate, never promote ──
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am runtime
printf '%s\n' "$LOAD_OUT" > "$T/stub/clone-out"
BEFORE="$(baseline_state)"
B_CONV=0
for i in 1 2 3 4 5; do tick; grep -q "^CONVERGED $VESSEL" "$CALLS" && B_CONV=$((B_CONV+1)); done
[ "$B_CONV" = 0 ] && ok "(b) a non-environment load regression is never promoted (5 ticks, bound 3)" || bad "(b) converged on $B_CONV of 5 ticks past red"
[ "$(gap_field "pull-sync-test-regression-$VESSEL" '.severity')" = high ] && ok "(b) past the bound the regression gap is escalated (severity high)" || bad "(b) regression gap severity past the bound: '$(gap_field "pull-sync-test-regression-$VESSEL" '.severity')'"
gap_ids | grep -q '^pull-sync-testgate-baseline-degraded-' && bad "(b) a degraded baseline was accepted" || ok "(b) no baseline-degraded gap"
[ "$(baseline_state)" = "$BEFORE" ] && ok "(b) baseline byte-identical" || bad "(b) baseline rewritten: $(baseline_state | tr '\n' '|')"
gap_ids | grep -qxF "$ENV_GAP_ID" && bad "(b) a commit's load regression was filed as an environment gap" || ok "(b) not classified as environment"

# ── (c) control: a green gate converges ───────────────────────────────────────
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am runtime
printf '%s\n' "$BASE_OUT" > "$T/stub/clone-out"
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(c) a green gate converges on the first tick" || bad "(c) a green gate did not converge (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
gap_ids | grep -qxF "$ENV_GAP_ID" && bad "(c) a green gate filed an environment gap" || ok "(c) no environment gap"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
