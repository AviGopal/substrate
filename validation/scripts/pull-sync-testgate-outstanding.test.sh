#!/usr/bin/env bash
# pull-sync's test-gate STARVATION BREAK never absorbs a named regression into the
# baseline (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice).
# Runs the script's own gate slice against a temp vessel clone with `bun` stubbed:
# `test` prints canned output chosen by the ref being measured (out-<sha>, else the
# candidate's). The range is the last-good pin (LAST_GOOD_DIR/<v>) .. HEAD. No network.
#
#   (a) a TEST-ONLY range with a newly failing name is refused on every tick, past
#       TEST_GATE_MAX_REFUSALS: no break, no convergence, baseline byte-identical
#   (b) a RUNTIME range that hits the break converges, but the regressed name is NOT
#       written into <v>.failnames; it is held outstanding, and a gap carries it
#       (classification_metadata.outstanding_tests)
#   (b2) the NEXT commit (tests unchanged, the name still failing) converges, the name
#       is still absent from failnames, still reported outstanding, the gap re-emitted
#   (b3) the name passing again clears it; failing again later is a fresh regression
#   (b3) ... and that pass is the ONLY thing that closes the gap (status closed, closed_reason
#       outstanding_tests_passed)
#   (d) AGED: a name first outstanding longer ago than the window (3 days) escalates the gap to
#       severity high with a distinct OUTSTANDING REGRESSION AGED line; the gap stays open, the
#       name stays outstanding, its first-outstanding stamp is kept
#   (e) aging never clears: ticks after the window keep it outstanding and the gap open; only
#       the name passing closes it
#   (c) control: a runtime range whose failures are unchanged converges on the first
#       tick with no refusal and an unchanged baseline
#
# usage: validation/scripts/pull-sync-testgate-outstanding.test.sh [path/to/substrate-pull-sync.sh]
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
grep -q 'STARVATION BREAK' "$T/fns.sh" || { echo "FAIL - could not extract the test-gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"

CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }
ensure_clone_deps() { return 0; }

# bun stub: run_suite runs under `env -i`, so its knobs are files. Output is chosen by
# the ref being measured: $S/out-<sha> when present, otherwise the candidate's.
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

VESSEL=demo-vessel
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
d="$CLONE_DIR/$VESSEL/"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
X='(fail) new > broke'
OLD_OUT='(pass) a > works
(fail) old > one
 5 pass
 1 fail'
NEW_OUT='(pass) a > works
(fail) old > one
(fail) new > broke
 5 pass
 2 fail'
BASE_NAMES='(fail) old > one'

setup() { # base commit pinned as last-good, measured with only `old > one` failing
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/stub"/*
  mkdir -p "$d/src" "$d/test" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  echo 'test("a", () => {});' > "$d/test/x.test.ts"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  printf '%s\n' "$OLD_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
  printf '%s\n' "$BASE_NAMES" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate; }
pin()  { git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"; }   # what the post-mirror step writes
in_failnames() { grep -qxF "$1" "$TEST_BASELINE_DIR/$VESSEL.failnames"; }
og() { # jq filter over the outstanding-regression gap(s) emitted this tick
  grep '^GAP ' "$CALLS" | sed 's/^GAP //' \
    | jq -r "select(.impulse.pointer.gap.id? == \"pull-sync-testgate-outstanding-regression-$VESSEL\") | .impulse.pointer.gap | $1" 2>/dev/null || true
}
outstanding_gap_names() { # names in the outstanding-regression gap emitted this tick
  grep '^GAP ' "$CALLS" | sed 's/^GAP //' \
    | jq -r 'select(.impulse.pointer.gap.classification_metadata.outstanding_tests? != null) | .impulse.pointer.gap.classification_metadata.outstanding_tests[]' 2>/dev/null || true
}

# ── (a) test-only range with a newly failing name: refused indefinitely ────────
setup
echo 'test("b", () => { throw 1; });' >> "$d/test/x.test.ts"; g commit -am test-only
printf '%s\n' "$NEW_OUT" > "$T/stub/clone-out"
BEFORE="$(cat "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo; cat "$TEST_BASELINE_DIR/$VESSEL")"
A_CONV=0; A_REF=0; A_BREAK=0
for i in 1 2 3 4 5 6; do
  tick
  grep -q "^CONVERGED $VESSEL" "$CALLS" && A_CONV=$((A_CONV+1))
  grep -q 'GAP .*pull-sync-test-regression-demo-vessel' "$CALLS" && A_REF=$((A_REF+1))
  grep -q 'STARVATION BREAK' "$LOG" && A_BREAK=$((A_BREAK+1))
done
[ "$A_REF" = 6 ] && ok "(a) test-only regression refused on all 6 ticks (bound is 3)" || bad "(a) refused on $A_REF of 6 ticks"
[ "$A_CONV" = 0 ] && ok "(a) never converged" || bad "(a) converged on $A_CONV tick(s)"
[ "$A_BREAK" = 0 ] && ok "(a) the starvation break never fired on a test-only range" || bad "(a) starvation break fired $A_BREAK time(s) on a test-only range"
[ "$(cat "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo; cat "$TEST_BASELINE_DIR/$VESSEL")" = "$BEFORE" ] && ok "(a) baseline (names + counts) byte-identical" || bad "(a) baseline rewritten: $(tr '\n' '|' < "$TEST_BASELINE_DIR/$VESSEL.failnames")"
in_failnames "$X" && bad "(a) the regressed name was absorbed into failnames" || ok "(a) the regressed name is not in failnames"

# ── (b) runtime range hits the break: converges, name held outstanding ────────
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am runtime
printf '%s\n' "$NEW_OUT" > "$T/stub/clone-out"
for i in 1 2 3; do tick; done
grep -q "^CONVERGED $VESSEL" "$CALLS" && bad "(b) converged before the refusal bound" || ok "(b) refused up to the bound"
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(b) the break converges a runtime range" || bad "(b) the break did not converge a runtime range"
in_failnames "$X" && bad "(b) the regressed name was written into failnames at the break" || ok "(b) the regressed name is NOT in failnames after the break"
in_failnames "$BASE_NAMES" && ok "(b) the pre-regression baseline names are kept" || bad "(b) the pre-regression baseline lost '$BASE_NAMES'"
outstanding_gap_names | grep -qxF "$X" && ok "(b) a gap carries the name in outstanding_tests" || bad "(b) no gap carries '$X' in classification_metadata.outstanding_tests"

# ── (b2) next commit, tests unchanged, name still failing ─────────────────────
BREAK_SHA="$(git -C "$d" rev-parse HEAD)"; pin
printf '%s\n' "$NEW_OUT" > "$T/stub/out-$BREAK_SHA"
echo 'export const x = 3;' > "$d/src/x.ts"; g commit -am runtime-2
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(b2) the next commit converges (the name is not its regression)" || bad "(b2) the next commit was refused"
in_failnames "$X" && bad "(b2) the outstanding name was absorbed into failnames on the next commit" || ok "(b2) the outstanding name is still absent from failnames"
grep -qF "$X" "$LOG" && grep -qi 'outstanding' "$LOG" && ok "(b2) the tick reports the name as outstanding" || bad "(b2) the tick does not report '$X' as outstanding"
outstanding_gap_names | grep -qxF "$X" && ok "(b2) the outstanding gap is re-emitted with the name" || bad "(b2) the outstanding gap was not re-emitted"
[ "$(og .severity)" = medium ] && ok "(b2) inside the window the gap is severity medium" || bad "(b2) severity inside the window: '$(og .severity)'"
grep -q 'OUTSTANDING REGRESSION AGED' "$LOG" && bad "(b2) escalated inside the window" || ok "(b2) no AGED escalation inside the window"
[ -n "$(og '.classification_metadata.outstanding_since["'"$X"'"] // empty')" ] && ok "(b2) the gap records when the name first went outstanding" || bad "(b2) no outstanding_since for the name"

# ── (b3) the name passes again: cleared; failing later is a fresh regression ──
pin; printf '%s\n' "$NEW_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
echo 'export const x = 4;' > "$d/src/x.ts"; g commit -am repair
printf '%s\n' "$OLD_OUT" > "$T/stub/clone-out"
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(b3) the repair converges" || bad "(b3) the repair did not converge"
grep -qi 'cleared' "$LOG" && grep -qF "$X" "$LOG" && ok "(b3) the outstanding name is logged as cleared" || bad "(b3) no 'cleared' line naming '$X'"
[ -z "$(outstanding_gap_names)" ] && ok "(b3) no outstanding gap once the name passes" || bad "(b3) outstanding gap still emitted: $(outstanding_gap_names | tr '\n' '|')"
[ "$(og '.status + " " + (.closed_reason // "")')" = "closed outstanding_tests_passed" ] && ok "(b3) the name passing closes the gap (closed_reason outstanding_tests_passed)" || bad "(b3) the gap was not closed by the pass: '$(og '.status + " " + (.closed_reason // "")')'"
pin; printf '%s\n' "$OLD_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
echo 'export const x = 5;' > "$d/src/x.ts"; g commit -am rebreak
printf '%s\n' "$NEW_OUT" > "$T/stub/clone-out"
tick
grep -q 'GAP .*pull-sync-test-regression-demo-vessel' "$CALLS" && ok "(b3) failing again after clearing is a fresh regression (refused)" || bad "(b3) a re-break after clearing was not refused"

# ── (d) aged outstanding: escalates, stays open ───────────────────────────────
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am runtime
printf '%s\n' "$NEW_OUT" > "$T/stub/clone-out"
for i in 1 2 3 4; do tick; done
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(d) setup: the break converged" || bad "(d) setup: the break did not converge"
SINCE="$TEST_BASELINE_DIR/$VESSEL.outstanding-since"
[ -s "$SINCE" ] && ok "(d) the first-outstanding time is recorded" || bad "(d) no first-outstanding stamp ($SINCE)"
OLD=$(( $(date +%s) - 4 * 86400 ))   # fake clock: first outstanding 4 days ago (window 3 days)
printf '%s\t%s\n' "$OLD" "$X" > "$SINCE"
pin; printf '%s\n' "$NEW_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
echo 'export const x = 3;' > "$d/src/x.ts"; g commit -am runtime-2
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(d) the next commit still converges" || bad "(d) the next commit was refused"
grep -q 'OUTSTANDING REGRESSION AGED' "$LOG" && grep 'OUTSTANDING REGRESSION AGED' "$LOG" | grep -qF "$X" && ok "(d) a distinct AGED notice names the name" || bad "(d) no 'OUTSTANDING REGRESSION AGED' line naming '$X'"
[ "$(og .severity)" = high ] && ok "(d) the aged gap is escalated to severity high" || bad "(d) severity after the window: '$(og .severity)'"
og '.classification_metadata.aged_tests[]' | grep -qxF "$X" && ok "(d) aged_tests names it" || bad "(d) aged_tests does not name it"
[ "$(og .status)" = open ] && ok "(d) the aged gap stays OPEN" || bad "(d) aged gap status: '$(og .status)'"
grep '^GAP ' "$CALLS" | grep -q '"status":"closed"' && bad "(d) aging emitted a closed gap" || ok "(d) aging closed nothing"
outstanding_gap_names | grep -qxF "$X" && ok "(d) the name is still outstanding" || bad "(d) the name left the outstanding set by aging"
in_failnames "$X" && bad "(d) aging absorbed the name into failnames" || ok "(d) aging did not absorb it into failnames"
[ "$(cut -f1 "$SINCE")" = "$OLD" ] && ok "(d) the first-outstanding stamp is kept, not reset" || bad "(d) stamp reset to $(cut -f1 "$SINCE")"

# ── (e) aging does not clear: still failing after the window = still outstanding ──
E_OPEN=0; E_CLOSED=0
for i in 1 2 3; do
  pin; printf '%s\n' "$NEW_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
  echo "export const x = 1$i;" > "$d/src/x.ts"; g commit -am "aging-$i"
  tick
  [ "$(og .status)" = open ] && outstanding_gap_names | grep -qxF "$X" && E_OPEN=$((E_OPEN+1))
  grep '^GAP ' "$CALLS" | grep -q '"status":"closed"' && E_CLOSED=$((E_CLOSED+1))
done
[ "$E_OPEN" = 3 ] && ok "(e) 3 more ticks past the window: outstanding and open every time" || bad "(e) open+outstanding on $E_OPEN of 3 ticks"
[ "$E_CLOSED" = 0 ] && ok "(e) never closed while still failing" || bad "(e) closed on $E_CLOSED tick(s) while still failing"
grep -qxF "$X" "$TEST_BASELINE_DIR/$VESSEL.outstanding" && ok "(e) still in the outstanding set" || bad "(e) dropped from the outstanding set"
pin; printf '%s\n' "$NEW_OUT" > "$T/stub/out-$(git -C "$d" rev-parse HEAD)"
echo 'export const x = 99;' > "$d/src/x.ts"; g commit -am repair
printf '%s\n' "$OLD_OUT" > "$T/stub/clone-out"
tick
[ "$(og '.status + " " + (.closed_reason // "")')" = "closed outstanding_tests_passed" ] && ok "(e) only the name passing closes the aged gap" || bad "(e) aged gap not closed by the pass: '$(og '.status + " " + (.closed_reason // "")')'"
[ ! -e "$SINCE" ] && ok "(e) the stamp is dropped once cleared" || bad "(e) stamp left behind after clearing"

# ── (c) control: unchanged failures converge normally ─────────────────────────
setup
echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am runtime
printf '%s\n' "$OLD_OUT" > "$T/stub/clone-out"
BEFORE="$(cat "$TEST_BASELINE_DIR/$VESSEL.failnames")"
tick
grep -q "^CONVERGED $VESSEL" "$CALLS" && ok "(c) unchanged failures converge on the first tick" || bad "(c) unchanged failures did not converge"
grep -q 'pull-sync-test-regression' "$CALLS" && bad "(c) unchanged failures were refused" || ok "(c) no refusal"
[ "$(cat "$TEST_BASELINE_DIR/$VESSEL.failnames")" = "$BEFORE" ] && ok "(c) baseline names unchanged" || bad "(c) baseline names changed"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
