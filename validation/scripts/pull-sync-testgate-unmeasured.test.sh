#!/usr/bin/env bash
# A GATE THAT DID NOT MEASURE NEVER PROMOTES (qa ruling). pull-sync's test gate
# (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice) had three paths that
# converged a vessel with no measurement at all. Each must now hold or defer, and be filed:
#
#   (a) BLIND: no test file loads, on a module neither the parent nor the candidate resolves ->
#       HOLD exactly like the environment-blind red: "TEST GATE BLIND — ENVIRONMENT", the same
#       deduped gap pull-sync-testgate-environment-<node>-<vessel>, baseline untouched
#   (b) NO RUNNER (bun absent) -> HOLD, gap pull-sync-testgate-no-runner-<node>
#   (c) BUDGET SPENT -> DEFER: no convergence this tick, the suite never started, a per-candidate
#       counter; the NEXT tick passes the vessel FIRST (pass_order) and, with a fresh budget,
#       gates and converges it, clearing the counter
#   (d) N consecutive budget deferrals of the SAME candidate (shaped tuning_param
#       pull_sync.testgate_budget_defer_max, default 3) -> gap pull-sync-testgate-budget-starved-<v>,
#       and still no convergence; a NEW candidate starts the count again
#   (e) structural: the vessel loop iterates pass_order's order
#   (f) NO COUNTABLE RESULT (the suite ran but printed no pass/fail totals) is the same "did not
#       measure": HOLD, gap pull-sync-testgate-blind-<v> with the output tail, baseline untouched
#       (not in the ruling's list of three; the ruling's principle covers it)
#
# usage: validation/scripts/pull-sync-testgate-unmeasured.test.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, awk, sed.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
# This harness exercises other gate behaviour: no protected judge tests (the gate reads the protected set
# from autonomy-scope.json and HOLDS when it is unreadable, so an empty set is stated, not omitted).
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  sed -n '/^pass_order() {/,/^}/p' "$SCRIPT"
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
TP_MAX=3
tuning_param() { echo "TUNING $1" >> "$CALLS"; TP_VALUE="$TP_MAX"; }   # the shaped row; default stands in

mkdir -p "$T/bin" "$T/stub"
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
case "\$1" in
  test)
    echo "SUITE" >> "$CALLS"
    f="\$S/out-\$(git rev-parse HEAD 2>/dev/null)"
    if [ -f "\$f" ]; then cat "\$f"; else cat "\$S/clone-out"; fi
    exit 1 ;;
esac
EOF
chmod +x "$T/bin/bun"
REAL_BUN="$T/bin/bun"

VESSEL=demo-vessel
GTR_NODE=pubspoke
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3; DEFERRAL_LOG="$T/deferrals.jsonl"
d="$CLONE_DIR/$VESSEL/"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
MOD='@avigopal/ias-executor-ts/adapters'
CLEAN_OUT='(pass) a > works
(fail) old > one
 5 pass
 1 fail'
NOLOAD="error: Cannot find module '$MOD' from '/x/src/config.ts'
error: Cannot find module '$MOD' from '/x/src/index.ts'
 0 pass
 2 fail"
ENV_GAP_ID="pull-sync-testgate-environment-$GTR_NODE-$VESSEL"
BD="$MARKER_DIR/$VESSEL.testgate-budget-defers"

setup() {
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/stub"/*
  mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  printf '%s\n' "$CLEAN_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am candidate
  printf '%s\n' "$CLEAN_OUT" > "$T/stub/clone-out"
  printf '(fail) old > one\n' > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""; BUN_BIN="$REAL_BUN"; unset GATE_T0 GATE_BUDGET_SECONDS
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate; }
gap_ids() { grep '^GAP ' "$CALLS" | sed 's/^GAP //' | jq -r '.impulse.pointer.gap.id // empty' 2>/dev/null || true; }
gap_field() { grep '^GAP ' "$CALLS" | sed 's/^GAP //' | jq -r "select(.impulse.pointer.gap.id? == \"$1\") | .impulse.pointer.gap | $2" 2>/dev/null || true; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
spent() { GATE_BUDGET_SECONDS=1000; GATE_T0=$(( $(date +%s) - 2000 )); }   # this tick's budget is gone

# ── (a) BLIND: nothing loads, on a module both sides cannot resolve ────────────
setup
printf '%s\n' "$NOLOAD" > "$T/stub/clone-out"; printf '%s\n' "$NOLOAD" > "$T/stub/out-$(git -C "$d" rev-parse HEAD^)"
BEFORE="$(cat "$TEST_BASELINE_DIR/$VESSEL")"
tick
converged && bad "(a) a blind gate (nothing loaded) converged ungated" || ok "(a) blind: no convergence"
grep -q 'TEST GATE BLIND — ENVIRONMENT' "$LOG" && ok "(a) logged 'TEST GATE BLIND — ENVIRONMENT'" || bad "(a) no 'TEST GATE BLIND — ENVIRONMENT' line (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(gap_ids | grep -cxF "$ENV_GAP_ID")" = 1 ] && ok "(a) the same deduped environment gap ($ENV_GAP_ID), once" || bad "(a) environment gap filed $(gap_ids | grep -cxF "$ENV_GAP_ID") time(s) (ids: $(gap_ids | tr '\n' ' '))"
gap_field "$ENV_GAP_ID" '.classification_metadata.unresolvable_modules[]?' | grep -qxF "$MOD" && ok "(a) it names the module" || bad "(a) the environment gap does not name $MOD"
gap_ids | grep -q '^pull-sync-testgate-unresolvable-modules-' && bad "(a) a second gap for the same cause" || ok "(a) one gap for one cause"
[ "$skipped" -ge 1 ] && ok "(a) counted as skipped" || bad "(a) not counted as skipped"
[ "$(cat "$TEST_BASELINE_DIR/$VESSEL")" = "$BEFORE" ] && ok "(a) baseline untouched" || bad "(a) baseline rewritten"

# ── (b) NO RUNNER ──────────────────────────────────────────────────────────────
setup
NOBUN_PATH="$(printf '%s' "$PATH" | tr ':' '\n' | while IFS= read -r p; do [ -n "$p" ] && [ ! -x "$p/bun" ] && printf '%s:' "$p"; done)"
NOBUN_PATH="${NOBUN_PATH%:}"
( PATH="$NOBUN_PATH"; BUN_BIN="$T/no-such-dir/bun"; tick; echo "skipped=$skipped" > "$T/b.out" )
converged && bad "(b) no test runner: converged ungated" || ok "(b) no runner: no convergence"
gap_ids | grep -qxF "pull-sync-testgate-no-runner-$GTR_NODE" && ok "(b) gap pull-sync-testgate-no-runner-$GTR_NODE" || bad "(b) no pull-sync-testgate-no-runner-$GTR_NODE gap (ids: $(gap_ids | tr '\n' ' '))"
grep -q 'skipped=[1-9]' "$T/b.out" && ok "(b) counted as skipped" || bad "(b) not counted as skipped ($(cat "$T/b.out" 2>/dev/null))"

# ── (c) BUDGET SPENT: defer, then gate first next tick ─────────────────────────
setup; spent
tick
converged && bad "(c) budget spent: converged ungated" || ok "(c) budget spent: no convergence this tick"
grep -q '^SUITE' "$CALLS" && bad "(c) the suite ran past the budget" || ok "(c) the suite did not start past the budget"
[ "$(cut -d' ' -f1 "$BD" 2>/dev/null)" = "$HEAD" ] && [ "$(cut -d' ' -f2 "$BD" 2>/dev/null)" = 1 ] && ok "(c) per-candidate counter: $(cat "$BD")" || bad "(c) counter '$(cat "$BD" 2>/dev/null)', expected '<HEAD> 1'"
gap_ids | grep -q 'budget-starved' && bad "(c) starved gap after one deferral" || ok "(c) no starved gap after one deferral"
grep -q 'DEFER' "$LOG" && ok "(c) the deferral is logged" || bad "(c) no deferral logged"
for o in aaa-first zzz-last; do mkdir -p "$CLONE_DIR/$o/.git"; done
FIRST="$(pass_order 2>/dev/null | head -1)"
[ "$(basename "${FIRST:-none}")" = "$VESSEL" ] && ok "(c) next tick passes the deferred candidate FIRST" || bad "(c) next tick's first vessel: '${FIRST:-none}' (pass_order: $(pass_order 2>/dev/null | xargs -r -n1 basename | tr '\n' ' '))"
[ "$(pass_order 2>/dev/null | grep -c .)" = 3 ] && ok "(c) pass_order still lists every clone once" || bad "(c) pass_order lists $(pass_order 2>/dev/null | grep -c .) entries, expected 3"
rm -rf "$CLONE_DIR/aaa-first" "$CLONE_DIR/zzz-last"
unset GATE_T0 GATE_BUDGET_SECONDS
tick
grep -q '^SUITE' "$CALLS" && converged && ok "(c) next tick, fresh budget: gated and converged" || bad "(c) next tick did not gate and converge"
[ ! -e "$BD" ] && ok "(c) the counter is cleared once the gate runs" || bad "(c) counter left behind: $(cat "$BD")"
mkdir -p "$CLONE_DIR/aaa-first/.git"
[ "$(basename "$(pass_order 2>/dev/null | head -1)")" = aaa-first ] && ok "(c) control: with nothing deferred, pass_order is the glob order" || bad "(c) control: pass_order without deferrals starts with '$(pass_order 2>/dev/null | head -1)'"
rm -rf "$CLONE_DIR/aaa-first"

# ── (d) N consecutive deferrals of the same candidate: starved gap, still held ──
setup
D_CONV=0; D_GAPS=""
for i in 1 2 3 4; do
  spent; tick; converged && D_CONV=$((D_CONV+1))
  gap_ids | grep -qxF "pull-sync-testgate-budget-starved-$VESSEL" && D_GAPS="$D_GAPS $i"
done
[ "$D_CONV" = 0 ] && ok "(d) 4 budget deferrals: never converged" || bad "(d) converged on $D_CONV of 4 deferrals"
[ "$D_GAPS" = " 3 4" ] && ok "(d) the starved gap is filed from the 3rd consecutive deferral (tuning_param default 3)" || bad "(d) starved gap on ticks:'$D_GAPS', expected ' 3 4'"
grep -qxF 'TUNING pull_sync.testgate_budget_defer_max' "$CALLS" && ok "(d) the bound is the shaped tuning_param pull_sync.testgate_budget_defer_max" || bad "(d) the bound is not read through tuning_param pull_sync.testgate_budget_defer_max"
echo 'export const x = 3;' > "$d/src/x.ts"; g commit -am newer
spent; tick
[ "$(cut -d' ' -f2 "$BD" 2>/dev/null)" = 1 ] && ok "(d) a new candidate starts the count again" || bad "(d) counter for a new candidate: '$(cat "$BD" 2>/dev/null)'"
gap_ids | grep -q 'budget-starved' && bad "(d) a new candidate inherited the starved gap" || ok "(d) no starved gap for the new candidate's first deferral"

# ── (e) structural: the loop runs in pass_order's order ───────────────────────
grep -q '^mapfile -t PASS_ORDER < <(pass_order)$' "$SCRIPT" && grep -q '^for d in "${PASS_ORDER\[@\]}"; do$' "$SCRIPT" \
  && ok "(e) the vessel loop iterates pass_order" || bad "(e) the vessel loop does not iterate pass_order"


# ── (f) the suite printed no countable result ─────────────────────────────────
setup
printf 'error: something went wrong before the totals\n' > "$T/stub/clone-out"
BEFORE="$(cat "$TEST_BASELINE_DIR/$VESSEL")"
tick
converged && bad "(f) an uncountable suite converged ungated" || ok "(f) no countable result: no convergence"
gap_ids | grep -qxF "pull-sync-testgate-blind-$VESSEL" && ok "(f) gap pull-sync-testgate-blind-$VESSEL" || bad "(f) no pull-sync-testgate-blind gap (ids: $(gap_ids | tr '\n' ' '))"
gap_field "pull-sync-testgate-blind-$VESSEL" '.summary' | grep -qi 'held' && ok "(f) the gap says the vessel is HELD" || bad "(f) the gap does not say the vessel is held: $(gap_field "pull-sync-testgate-blind-$VESSEL" '.summary' | cut -c1-200)"
[ "$skipped" -ge 1 ] && ok "(f) counted as skipped" || bad "(f) not counted as skipped"
[ "$(cat "$TEST_BASELINE_DIR/$VESSEL")" = "$BEFORE" ] && ok "(f) baseline untouched" || bad "(f) baseline rewritten"
echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
