#!/usr/bin/env bash
# pull-sync's test gate SAMPLES a contended host until it settles before it defers a suite or protected-alone START
# (scripts/substrate/substrate-pull-sync.sh host_contention_settle, called after host_contended at each start). Runs the
# script's own code against a temp vessel clone with `bun` stubbed, a fixture standing in for /proc/pressure/cpu, and
# `sleep` stubbed in the gate's own shell by a fake clock (each sleep advances it; the pressure fixture cools once the
# clock passes CLEAR_AT). No network, no real wait.
#
# Measured: periodic store bursts (~8-9 cores every ~65 s) put avg10 over the threshold whatever the gate does, so a
# start admitted on one instantaneous reading deferred at random and starved the gate.
#
#   (a) MUST-FAIL: contended at the suite start, clears within the settle bound -> the suite runs and converges, and the
#       wait is logged (seconds, samples)
#   (b) MUST-FAIL: contended after the suite, clears within the bound before the protected-alone run -> it runs, converges
#   (c) control: contended for the whole bound -> still DEFERRED (counted, not converged), no suite run;
#       MUST-FAIL: the deferral names the wait (75 s default bound, 15 samples) and it waited exactly the bound
#   (d) control: the threshold row is read as before (pull_sync.testgate_psi_defer_pct, default 0); no threshold row on
#       a contended host -> admission off: no wait, no settle row read, the gate runs and converges
#   (e) control: settle row 0 -> no wait, deferred on the first reading as before
#   (f) MUST-FAIL: the bound is capped by the gate budget left after the run it admits (gate_left - cost)
#
# usage: validation/scripts/pull-sync-testgate-contention-settle.test.sh [path/to/substrate-pull-sync.sh]
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
  sed -n '/^host_contended() {/,/^}/p' "$SCRIPT"
  sed -n '/^host_contention_settle() {/,/^}/p' "$SCRIPT"
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
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
TP_READS="$T/tp-reads.txt"
tuning_param() { echo "$1 $2" >> "$TP_READS"; case "$1" in pull_sync.testgate_psi_defer_pct) TP_VALUE="${PSI_PCT:-$2}" ;; pull_sync.testgate_psi_settle_s) TP_VALUE="${SETTLE:-$2}" ;; *) TP_VALUE="$2" ;; esac; }
PSI_CPU_FILE="$T/psi"
psi() { printf 'some avg10=%s avg60=%s avg300=1.00 total=1\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n' "$1" "$2" > "$PSI_CPU_FILE"; }

mkdir -p "$T/bin" "$T/stub"
# bun test -> a whole-suite run (recorded; if $S/hot-after-suite exists it makes the host contended afterwards);
# bun test <file> -> a protected-alone run (recorded, green)
cat > "$T/bin/bun" <<EOS
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = test ] || exit 0
shift
if [ \$# -eq 0 ]; then echo SUITE >> "$T/runs.txt"; cat "\$S/full"; [ -f "\$S/hot-after-suite" ] && printf 'some avg10=70.00 avg60=60.00 avg300=1.00 total=1\n' > "$T/psi"; exit 1; fi
echo "ALONE \$(basename "\$1")" >> "$T/runs.txt"; printf '(pass) p > ok\n 3 pass\n 0 fail\n'; exit 0
EOS
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"
GTR_NODE=test-node
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"
PF=test/resolvers/system-authored-gap-checks.test.ts
OLD='(fail) old > one'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
setup() { # $1 vessel
  VESSEL="$1"; d="$CLONE_DIR/$VESSEL/"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/runs.txt" "$T/stub/hot-after-suite"
  mkdir -p "$d/src" "$d/test/resolvers" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"; echo 'test("p", () => {});' > "$d/$PF"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am change
  printf '(pass) a > works\n%s\n 5 pass\n 1 fail\n' "$OLD" > "$T/stub/full"
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  jq -n --arg p "repos/development-vessel/$PF" '{autonomyScope:{excluded_paths:[$p]}}' > "$PROTECTED_SCOPE_FILE"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { : > "$CALLS"; : > "$LOG"; : > "$T/runs.txt"; : > "$TP_READS"; echo 0 > "$CLOCK"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_gate; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
suites() { grep -c '^SUITE' "$T/runs.txt" 2>/dev/null || true; }
alones() { grep -c '^ALONE' "$T/runs.txt" 2>/dev/null || true; }
TEST_TIMEOUT_SECONDS=20; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=20; UNIT_TIMEOUT_S=3600; GATE_UNIT_MARGIN_S=2

CLOCK="$T/clock"; echo 0 > "$CLOCK"
# The gate's own shell sleeps on the fake clock; a subshell (the mid-run contention sampler) keeps the real sleep, and
# is killed when the stubbed suite returns, as in the contention test.
sleep() {
  if [ "$BASH_SUBSHELL" -gt 0 ]; then command sleep "$@"; return; fi
  local _c; _c=$(( $(cat "$CLOCK") + ${1%%.*} )); echo "$_c" > "$CLOCK"
  [ -n "${CLEAR_AT:-}" ] && [ "$_c" -ge "$CLEAR_AT" ] && psi 4.00 6.00
  return 0
}
clock() { cat "$CLOCK"; }

# ── (a) contended at the suite start, clears at 20 s of a 75 s bound -> runs and converges ──
PSI_PCT=30; unset SETTLE; CLEAR_AT=20; psi 60.00 55.00; setup activity-api; tick
grep -q 'TEST GATE DEFERRED' "$LOG" && bad "(a) deferred although the host settled within the bound (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))" || ok "(a) not deferred"
[ "$(suites)" -ge 1 ] && converged && ok "(a) the suite ran and the candidate converged" || bad "(a) no suite run / not converged"
grep -q 'the suite run: host contention settled after 20s (4 samples, bound 75s, pull_sync.testgate_psi_settle_s' "$LOG" && ok "(a) the wait is logged with seconds and samples" || bad "(a) no settle line (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(clock)" = 20 ] && ok "(a) it waited 20 s, no longer" || bad "(a) waited $(clock) s"

# ── (b) contended after the suite, clears at 15 s before the protected-alone run -> it runs ──
PSI_PCT=30; unset SETTLE; CLEAR_AT=15; psi 1.00 1.00; setup development-vessel; touch "$T/stub/hot-after-suite"; tick
[ "$(alones)" -ge 1 ] && ok "(b) the protected-alone run started after the host settled" || bad "(b) no protected run (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
grep -q 'TEST GATE DEFERRED' "$LOG" && bad "(b) deferred" || ok "(b) not deferred"
converged && ok "(b) converged" || bad "(b) not converged"
grep -q 'protected run of .*host contention settled after 15s (3 samples' "$LOG" && ok "(b) the protected wait is logged" || bad "(b) no protected settle line"

# ── (c) contended for the whole bound -> still deferred, naming the wait ──
PSI_PCT=30; unset SETTLE CLEAR_AT; psi 60.00 55.00; setup activity-api; tick
grep -q 'TEST GATE DEFERRED .*host contended' "$LOG" && ok "(c) control: still DEFERRED naming the contention" || bad "(c) not deferred (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(suites)" = 0 ] && ok "(c) control: no suite run started" || bad "(c) $(suites) suite run(s) on a contended host"
converged && bad "(c) converged on a contended host" || ok "(c) control: not converged"
[ "$(awk '{print $2}' "$MARKER_DIR/activity-api.testgate-budget-defers" 2>/dev/null)" = 1 ] && ok "(c) control: the deferral is counted" || bad "(c) deferral not counted"
grep -q 'TEST GATE DEFERRED .*still contended after a 75s settle wait (15 samples, bound 75s, pull_sync.testgate_psi_settle_s)' "$LOG" && ok "(c) the deferral names the 75 s settle wait" || bad "(c) the deferral does not name the wait"
[ "$(clock)" = 75 ] && ok "(c) it waited exactly the bound" || bad "(c) waited $(clock) s, bound 75"

# ── (d) control: threshold read path unchanged; no threshold row -> admission off, no wait ──
PSI_PCT=30; unset SETTLE CLEAR_AT; psi 2.00 3.00; setup activity-api; tick
grep -qx 'pull_sync.testgate_psi_defer_pct 0' "$TP_READS" && ok "(d) control: the threshold row is read as pull_sync.testgate_psi_defer_pct, default 0" || bad "(d) threshold read changed ($(tr '\n' '|' < "$TP_READS"))"
grep -q '^pull_sync.testgate_psi_settle_s' "$TP_READS" && bad "(d) the settle row was read on an uncontended host" || ok "(d) control: an uncontended host reads no settle row"
unset PSI_PCT; psi 90.00 90.00; setup activity-api; tick
[ "$(suites)" -ge 1 ] && converged && [ "$(clock)" = 0 ] && ok "(d) control: no threshold row, admission off, no wait" || bad "(d) control: waited $(clock) s or deferred without a threshold row"

# ── (e) control: settle row 0 -> deferred on the first reading, no wait ──
PSI_PCT=30; SETTLE=0; unset CLEAR_AT; psi 60.00 55.00; setup activity-api; tick
grep -q 'TEST GATE DEFERRED .*host contended' "$LOG" && [ "$(clock)" = 0 ] && ! grep -q 'settle wait' "$LOG" && ok "(e) control: settle row 0 defers at once, as before" || bad "(e) settle 0: clock $(clock) (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
unset SETTLE

# ── (f) the bound is capped by the budget left after the run it admits ──
PSI_PCT=30; unset CLEAR_AT; psi 60.00 55.00; echo 0 > "$CLOCK"; : > "$LOG"
gate_left() { echo 40; }
if declare -F host_contention_settle >/dev/null 2>&1 && host_contended && host_contention_settle "cap" 30 && [ "$(clock)" = 10 ] \
   && printf '%s' "$HC_WHY" | grep -q 'still contended after a 10s settle wait (2 samples, bound 10s'; then
  ok "(f) the wait is capped at gate_left - cost (10 s)"
else bad "(f) not capped: waited $(clock) s (HC_WHY: ${HC_WHY:-})"; fi
unset -f gate_left

[ "$FAILS" -eq 0 ] && echo "PASS: all contention-settle checks" || { echo "FAILED: $FAILS check(s)"; exit 1; }
