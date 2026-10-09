#!/usr/bin/env bash
# pull-sync's test gate must make PROGRESS when every candidate is budget-deferred: the deferred set
# ROTATES (pass_order), and a candidate whose measured need cannot fit is deferred WITHOUT re-running
# its suite on unchanged inputs (scripts/substrate/substrate-pull-sync.sh, pass_order and the
# "3-pre. TEST GATE" slice). Several temp vessel clones go through the script's own pass order and
# gate slice tick after tick, with `bun` stubbed per vessel; small timeouts stand in for the real ones.
#
# Measured 2026-10-06 on the hub: 23 finished ticks, 0 convergences in 4 h. The same 7 candidates were
# TEST GATE DEFERRED every tick: the deferred set came out of pass_order in glob order, so activity-api
# (alphabetically first) ran its suite first every tick, never fit its own T2, and left the others too
# little time. A fixed point, not a rotation.
#
#   (1) MUST-FAIL: four candidates, one ("aa", first in glob order) whose gate needs more than a whole
#       tick: within K+1 = 5 ticks the other three CONVERGE, and every candidate is either converged or
#       has held the first slot within K = 4 ticks
#   (1b) MUST-FAIL: rotation without the skip: "aa" gets a NEW HEAD every tick (so no measurement can be
#       reused) and its gate needs more than a tick; the others still converge within K+1 ticks
#   (2) MUST-FAIL: after a mid-gate deferral, an unchanged key (HEAD, outstanding set, dependency
#       identity, test environment) with too little time left is deferred WITHOUT a suite run; a changed
#       lockfile (same HEAD) re-runs it; a changed test runner version re-runs it
#   (3) MUST-FAIL: a skip tick moves no gate state but the deferral count: last-good, outstanding,
#       failnames, baseline and refusals unchanged, nothing converged
#   (4) MUST-FAIL: the budget-starved gap is emitted at the bound AND logged; when the starved candidate
#       later gates within the budget, the gap is CLOSED (closed_reason testgate_budget_recovered)
#   (5) the skip re-measures on a slow cadence (pull_sync.testgate_skip_recheck_ticks): a suite that
#       became faster is measured again and converges
#   (6) control: a HEAD change re-gates immediately (no skip on a new HEAD)
#
# usage: validation/scripts/pull-sync-testgate-rotation.test.sh [path/to/substrate-pull-sync.sh]
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
  sed -n '/^pass_order() {/,/^}/p' "$SCRIPT"
  echo 'run_tick() {'
  echo 'mapfile -t PASS_ORDER < <(pass_order)'
  echo 'printf "%s\n" "${PASS_ORDER[@]}" | xargs -n1 basename > "$T/order.txt"'
  echo 'for d in "${PASS_ORDER[@]}"; do'
  echo '  v="$(basename "$d")"; HEAD="$(git -C "$d" rev-parse HEAD)"'
  echo '  [ "$(cat "$LAST_GOOD_DIR/$v" 2>/dev/null)" = "$HEAD" ] && continue'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  # The owed quiesce/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"; echo "$HEAD" > "$LAST_GOOD_DIR/$v"'
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
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
clone_file_deps() { :; }
file_dep_identity() { echo x; }
tuning_param() { local _k="TP_$(printf '%s' "$1" | tr '.-' '__')"; TP_VALUE="${!_k:-$2}"; }

mkdir -p "$T/bin" "$T/stub"
# bun --version -> $S/bunver ; bun test (whole suite, run in the clone) -> per vessel: sleeps $S/<v>.sleep,
# prints a newly failing name on odd runs and only the baseline on even runs (so T2 never confirms: a
# gate that completes its two runs passes and converges). Every run is recorded as "SUITE <v>".
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = --version ] && { cat "\$S/bunver" 2>/dev/null || echo 1.0.0; exit 0; }
[ "\$1" = test ] || exit 0
v="\$(basename "\$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
echo "SUITE \$v" >> "$T/runs.txt"
n="\$(cat "\$S/\$v.n" 2>/dev/null || echo 0)"; n=\$((n + 1)); echo "\$n" > "\$S/\$v.n"
sleep "\$(cat "\$S/\$v.sleep" 2>/dev/null || echo 0)"
if [ -f "\$S/\$v.always-new" ] || [ \$((n % 2)) = 1 ]; then printf '(pass) a > works\n(fail) old > one\n(fail) new > flaky\n 5 pass\n 2 fail\n'
else printf '(pass) a > works\n(fail) old > one\n 5 pass\n 1 fail\n'; fi
exit 1
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

GTR_NODE=node1
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"; echo '{"autonomyScope":{"excluded_paths":[]}}' > "$PROTECTED_SCOPE_FILE"
# 8 s runs + 1 s grace = 9 s worst case; a 16 s unit less a 2 s margin = 14 s per tick.
TEST_TIMEOUT_SECONDS=8; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=16; GATE_UNIT_MARGIN_S=2

reset_all() { rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/stub"/*; mkdir -p "$CLONE_DIR" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"; : > "$CALLS"; }
mkvessel() { # <name> <sleep per run>
  local vd="$CLONE_DIR/$1"
  mkdir -p "$vd/src"; echo 'export const x = 1;' > "$vd/src/x.ts"; echo '{"name":"'"$1"'"}' > "$vd/package.json"; echo 'lock 1' > "$vd/bun.lock"
  git -C "$vd" init -q -b dev; git -C "$vd" -c user.name=t -c user.email=t@t add -A >/dev/null; git -C "$vd" -c user.name=t -c user.email=t@t commit -qm base
  git -C "$vd" rev-parse HEAD > "$LAST_GOOD_DIR/$1"
  echo 'export const x = 2;' > "$vd/src/x.ts"; git -C "$vd" -c user.name=t -c user.email=t@t commit -qam change
  printf '%s\n' '(fail) old > one' > "$TEST_BASELINE_DIR/$1.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$1"
  echo "$2" > "$T/stub/$1.sleep"
}
tick() { : > "$LOG"; : > "$T/runs.txt"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_tick; }
conv() { grep -q "^CONVERGED $1\$" "$CALLS"; }
ran() { grep -c "^SUITE $1\$" "$T/runs.txt" 2>/dev/null || true; }

# ── (1) four candidates, "aa" needs more than a whole tick ──────────────────────────
reset_all
mkvessel aa 7; mkvessel bb 1; mkvessel cc 1; mkvessel dd 1
touch "$T/stub/aa.always-new"   # aa's newly failing name shows in every run: its gate always needs T2
FIRSTS=""
for t in 1 2 3 4 5; do tick; FIRSTS="$FIRSTS $(head -1 "$T/order.txt")"; [ "$t" = 4 ] && FIRSTS4="$FIRSTS"; done
for v in bb cc dd; do conv "$v" && ok "(1) $v converged within 5 ticks" || bad "(1) $v never converged in 5 ticks (fixed point; firsts:$FIRSTS)"; done
for v in aa bb cc dd; do
  { conv "$v" || printf '%s' "$FIRSTS4" | grep -qw "$v"; } && ok "(1) $v converged or held the first slot within 4 ticks" || bad "(1) $v neither converged nor held the first slot within 4 ticks (firsts:$FIRSTS4)"
done
conv aa && bad "(1) aa converged although its gate cannot fit a tick" || ok "(1) aa (needs more than a tick) not converged, gated, not skipped through"

# ── (1b) aa's HEAD moves every tick: only rotation can let the others through ──────
reset_all
mkvessel aa 7; mkvessel bb 1; mkvessel cc 1; mkvessel dd 1; touch "$T/stub/aa.always-new"
for t in 1 2 3 4 5; do
  echo "export const x = $((t + 10));" > "$CLONE_DIR/aa/src/x.ts"; git -C "$CLONE_DIR/aa" -c user.name=t -c user.email=t@t commit -qam "t$t"
  tick
done
for v in bb cc dd; do conv "$v" && ok "(1b) $v converged within 5 ticks behind a moving aa" || bad "(1b) $v starved behind aa (aa first every tick: no rotation)"; done

# ── (2)+(3) skip on an unchanged key; re-run on a changed lockfile or runner ────────
reset_all; mkvessel ee 4; touch "$T/stub/ee.always-new"
TP_pull_sync_testgate_skip_recheck_ticks=6
# A measured mid-gate deferral: 9 s of the 14 s already gone before ee's gate (run 1 fits, T2 does not).
PULLSYNC_PRE=5
tick_late() { : > "$LOG"; : > "$T/runs.txt"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(( $(date +%s) - $1 )); run_tick; }
tick_late 2
grep -q 'T2 confirmation' "$LOG" && [ "$(ran ee)" = 1 ] && ok "(2) setup: ee measured one run and deferred before T2" || bad "(2) setup did not produce a mid-gate deferral (runs $(ran ee); log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
snap() { for f in "$LAST_GOOD_DIR/ee" "$TEST_BASELINE_DIR/ee" "$TEST_BASELINE_DIR/ee.failnames" "$TEST_BASELINE_DIR/ee.outstanding" "$MARKER_DIR/ee.testgate-refusals"; do printf '%s:' "$f"; cat "$f" 2>/dev/null | md5sum; done; }
before="$(snap)"; : > "$CALLS"
tick_late 2
[ "$(ran ee)" = 0 ] && grep -q 'skipped WITHOUT a run' "$LOG" && ok "(2) unchanged key, too little time: deferred WITHOUT a suite run" || bad "(2) the suite ran again on unchanged inputs (runs $(ran ee); log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(snap)" = "$before" ] && ! conv ee && ok "(3) the skip tick moved no gate state (last-good, baseline, failnames, outstanding, refusals) and converged nothing" || bad "(3) a skip tick changed gate state or converged"
echo 'lock 2' > "$CLONE_DIR/ee/bun.lock"   # same HEAD, changed lockfile in the clone
tick_late 2
[ "$(ran ee)" -ge 1 ] && ok "(2) same HEAD + changed lockfile: re-measured" || bad "(2) a changed dependency identity was skipped"
tick_late 2   # re-records the need at the new key
echo 9.9.9 > "$T/stub/bunver"
tick_late 2
[ "$(ran ee)" -ge 1 ] && ok "(2) changed test runner version: re-measured" || bad "(2) a changed test environment was skipped"

# ── (2b) a cheaper deferral never lowers a measured need ───────────────────────────
reset_all; mkvessel ii 4; touch "$T/stub/ii.always-new"
tick_late 2      # measured: need ~13
tick_late 7      # too late even for one run: deferred at the first check (must not record a smaller need)
tick_late 2      # 12 left < 13: skip, no run
[ "$(ran ii)" = 0 ] && ok "(2b) a first-check deferral did not lower the measured need" || bad "(2b) the measured need was lowered and the suite ran again on unchanged inputs"

# ── (4) starved gap logged at the bound, closed on recovery ─────────────────────────
reset_all; mkvessel ff 4; TP_pull_sync_testgate_budget_defer_max=3
tick_late 2; tick_late 2; tick_late 2
grep -q 'pull-sync-testgate-budget-starved-ff' "$CALLS" && ok "(4) the budget-starved gap was emitted at the bound" || bad "(4) no budget-starved gap after 3 deferrals"
grep -q 'BUDGET-STARVED' "$LOG" && ok "(4) the emit is logged" || bad "(4) the starvation emit is not logged"
: > "$CALLS"; tick
conv ff && grep -q '"status":"closed".*testgate_budget_recovered' "$CALLS" && ok "(4) the starved candidate gated within the budget and its gap was CLOSED" || bad "(4) recovery did not close the gap (calls: $(tr '\n' '|' < "$CALLS" | cut -c1-300))"

# ── (5) slow re-measure cadence ─────────────────────────────────────────────────────
reset_all; mkvessel gg 4; TP_pull_sync_testgate_skip_recheck_ticks=2
tick_late 2                       # measured: need recorded
tick_late 2; tick_late 2          # two skips
echo 0 > "$T/stub/gg.sleep"       # the suite became fast (same key)
tick_late 2                       # cadence reached: measured again
[ "$(ran gg)" -ge 1 ] && ok "(5) after the cadence of skips the unchanged key is measured again" || bad "(5) skipped past the re-measure cadence"
conv gg && ok "(5) the now-fast suite converges" || bad "(5) the now-fast suite did not converge (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
TP_pull_sync_testgate_skip_recheck_ticks=6

# ── (6) control: a HEAD change re-gates immediately ─────────────────────────────────
reset_all; mkvessel hh 4
tick_late 2                       # need recorded at the old HEAD
echo 'export const x = 3;' > "$CLONE_DIR/hh/src/x.ts"; git -C "$CLONE_DIR/hh" -c user.name=t -c user.email=t@t commit -qam head2
echo 1 > "$T/stub/hh.sleep"; tick
[ "$(ran hh)" -ge 1 ] && conv hh && ok "(6) a new HEAD is measured at once and converges" || bad "(6) a new HEAD was skipped on the old measurement"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
