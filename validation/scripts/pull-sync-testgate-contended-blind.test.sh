#!/usr/bin/env bash
# pull-sync's test gate starts its suite by RHYTHM (a per-tick start jitter from the shaped row
# pull_sync.testgate_start_jitter_s) and samples host contention DURING the suite, and a suite KILLED at its wall while
# the host was contended (at its start, mid-run or at its end) is DEFERRED through the counted path, not HELD as blind
# (scripts/substrate/substrate-pull-sync.sh, START BY RHYTHM / CONTENTION SEEN DURING THE RUN). A sibling of
# pull-sync-testgate-contention.test.sh: the same extraction and the real host_contended against a pressure fixture
# file; its own bun stub, whose whole-suite run can make the host hot mid-run and outlive the wall. No network.
#
# Measured 2026-10-19 09:55Z on one node: "suite run KILLED at TEST_TIMEOUT_SECONDS=413 … TEST GATE BLIND … HOLDING",
# while another co-hosted node's gate ran concurrently.
#
#   (a) MUST-FAIL: the host is contended only MID-RUN and the suite is killed at its wall -> DEFERRED (counted), not BLIND
#   (b) MUST-FAIL: the host is contended at the run's END and the suite is killed at its wall -> DEFERRED (counted)
#   (c) control: an uncontended suite killed at its wall -> still TEST GATE BLIND, HELD, not deferred
#   (d) MUST-FAIL: a jitter row of N > 0 is read, a start jitter in 0..N is drawn, logged and slept before the suite
#   (d2) MUST-FAIL: with no row (the store answers null) the default (180 s) applies: drawn from 0..180s (sleep stubbed)
#   (d3) control: the store unreadable (non-numeric, unreachable) -> no wait is added, the skip is logged
#   (e) control: an explicit row of 0 -> no jitter, the suite starts at once and the gate converges as before
#
# usage: validation/scripts/pull-sync-testgate-contended-blind.test.sh [path/to/substrate-pull-sync.sh]
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
  sed -n '/^testgate_start_jitter() {/,/^}/p' "$SCRIPT"
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
tuning_param() {
  echo "TP $1" >> "$T/tp-calls"
  TP_WHY=""
  case "$1" in pull_sync.testgate_psi_defer_pct) TP_VALUE="${PSI_PCT:-$2}" ;; pull_sync.testgate_start_jitter_s) TP_VALUE="${JITTER:-$2}"; [ -n "${JITTER:-}" ] || TP_WHY="${JITTER_WHY:-null}" ;; *) TP_VALUE="$2" ;; esac
}
PSI_CPU_FILE="$T/psi"
COOL='some avg10=2.00 avg60=3.00 avg300=1.00 total=1'
HOT='some avg10=70.00 avg60=60.00 avg300=1.00 total=1'
psi() { printf '%s\n' "$1" > "$PSI_CPU_FILE"; }

mkdir -p "$T/bin" "$T/stub"
# bun test (whole suite), by $S/mode:
#   green    -> prints a countable summary at once
#   hot-mid  -> host hot from the start for ~1.6 s, then cool, then outlives the wall (killed)
#   hot-end  -> host cool, then hot, then outlives the wall (killed; still hot at the end)
#   cold     -> host stays cool, outlives the wall (killed)
# bun test <file> -> a protected-alone run, green
cat > "$T/bin/bun" <<EOS
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = test ] || exit 0
shift
if [ \$# -eq 0 ]; then
  echo "SUITE \$(date +%s)" >> "$T/runs.txt"
  case "\$(cat "\$S/mode")" in
    green) cat "\$S/full"; exit 1 ;;
    hot-mid) printf '%s\n' "$HOT" > "$T/psi"; sleep 1.6; printf '%s\n' "$COOL" > "$T/psi"; exec sleep 30 ;;
    hot-end) sleep 0.5; printf '%s\n' "$HOT" > "$T/psi"; exec sleep 30 ;;
    cold) exec sleep 30 ;;
  esac
  exit 0
fi
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
setup() { # $1 suite mode
  VESSEL=development-vessel; d="$CLONE_DIR/$VESSEL/"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/runs.txt" "$T/tp-calls"
  mkdir -p "$d/src" "$d/test/resolvers" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"; echo 'test("p", () => {});' > "$d/$PF"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am change
  printf '(pass) a > works\n%s\n 5 pass\n 1 fail\n' "$OLD" > "$T/stub/full"
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  jq -n --arg p "repos/development-vessel/$PF" '{autonomyScope:{excluded_paths:[$p]}}' > "$PROTECTED_SCOPE_FILE"
  echo "$1" > "$T/stub/mode"; psi "$COOL"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { : > "$CALLS"; : > "$LOG"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0 TJ_DONE; PULLSYNC_T0=$(date +%s); T0=$(date +%s); run_gate; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
blind() { grep -q 'TEST GATE BLIND' "$LOG"; }
deferred() { grep -q 'TEST GATE DEFERRED' "$LOG"; }
counted() { [ "$(awk '{print $2}' "$MARKER_DIR/$VESSEL.testgate-budget-defers" 2>/dev/null)" = 1 ]; }
logs() { tr '\n' '|' < "$LOG" | cut -c1-500; }
TEST_TIMEOUT_SECONDS=3; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=20; UNIT_TIMEOUT_S=3600; GATE_UNIT_MARGIN_S=2
PSI_PCT=30

# ── (a) contended only MID-RUN, killed at the wall -> deferred, counted, not blind ──
JITTER=0; setup hot-mid; tick
{ deferred && counted; } && ok "(a) a suite killed at its wall while the host was contended mid-run is DEFERRED and counted" || bad "(a) not a counted deferral (log: $(logs))"
blind && bad "(a) held as TEST GATE BLIND" || ok "(a) not held as blind"
grep -q 'KILLED at its wall .*while the host was contended (mid-run' "$LOG" && ok "(a) the deferral names the mid-run contention" || bad "(a) the mid-run contention is not named (log: $(logs))"
converged && bad "(a) converged without a measurement" || ok "(a) not converged"

# ── (b) contended at the END, killed at the wall -> deferred, counted ──
JITTER=0; setup hot-end; tick
{ deferred && counted && ! blind; } && ok "(b) a suite killed at its wall on a host contended at its end is DEFERRED and counted" || bad "(b) not a counted deferral (log: $(logs))"

# ── (c) control: uncontended, killed at the wall -> still BLIND, HELD ──
JITTER=0; setup cold; tick
{ blind && ! deferred && ! converged; } && ok "(c) an uncontended suite killed at its wall is still TEST GATE BLIND, HELD" || bad "(c) the uncontended blind changed (log: $(logs))"

# ── (d) jitter row N > 0 -> drawn in 0..N, logged, slept before the suite ──
# Seed RANDOM so the draw is non-zero (the same first draw the jitter function will take), so "applied" is observable.
JITTER=2; setup green; for _seed in $(seq 1 100); do RANDOM=$_seed; [ $((RANDOM % 3)) -gt 0 ] && break; done; RANDOM=$_seed; tick
grep -qx 'TP pull_sync.testgate_start_jitter_s' "$T/tp-calls" && ok "(d) the jitter is read from pull_sync.testgate_start_jitter_s" || bad "(d) the jitter row was not read"
J="$(sed -n 's/.*suite start jitter \([0-9]*\)s (drawn from 0\.\.2s.*/\1/p' "$LOG" | head -1)"
[ -n "$J" ] && [ "$J" -ge 1 ] && [ "$J" -le 2 ] && ok "(d) a jitter of ${J}s was drawn from 0..2s and logged" || bad "(d) no jitter logged (log: $(logs))"
S0="$(awk '/^SUITE/{print $2; exit}' "$T/runs.txt" 2>/dev/null)"
[ -n "$J" ] && [ -n "$S0" ] && [ $(( S0 - T0 )) -ge $(( J - 1 )) ] && [ $(( S0 - T0 )) -ge 1 ] && ok "(d) the suite started after the jitter ($(( S0 - T0 ))s after the tick)" || bad "(d) the jitter was not applied (suite at $(( ${S0:-0} - T0 ))s, jitter ${J:-none})"
converged && ok "(d) the gate still converges" || bad "(d) did not converge (log: $(logs))"

# ── (d2) no row -> the default 180 s applies (the jitter is drawn from 0..180s; the sleep itself is stubbed) ──
unset JITTER; setup green
sleep() { case "$1" in *[!0-9]*) command sleep "$@" ;; *) [ "$1" -gt 5 ] && echo "SLEPT $1" >> "$T/slept" || command sleep "$@" ;; esac; }
rm -f "$T/slept"; tick; unset -f sleep
grep -q 'suite start jitter [0-9]*s (drawn from 0\.\.180s' "$LOG" && ok "(d2) with no row the default jitter range 0..180s applies" || bad "(d2) the default jitter did not apply (log: $(logs))"
converged && ok "(d2) the gate still converges" || bad "(d2) did not converge (log: $(logs))"

# ── (d3) control: the store unreadable -> no wait added, the skip logged ──
for W in non_numeric unreachable; do
  unset JITTER; JITTER_WHY="$W"; setup green; tick
  { grep -q "suite start jitter skipped: .*unreadable ($W)" "$LOG" && ! grep -q 'suite start jitter [0-9]' "$LOG"; } && ok "(d3) an unreadable store ($W) adds no wait, and says so" || bad "(d3) $W: jitter not skipped (log: $(logs))"
  converged && ok "(d3) $W: converges" || bad "(d3) $W: did not converge"
done
unset JITTER_WHY

# ── (e) control: an explicit row of 0 -> no jitter, the suite starts at once ──
JITTER=0; setup green; tick
grep -q 'suite start jitter' "$LOG" && bad "(e) an explicit row of 0 still jittered" || ok "(e) an explicit row of 0: no start jitter"
converged && ok "(e) an explicit row of 0: the gate converges as before" || bad "(e) did not converge (log: $(logs))"

[ "$FAILS" -eq 0 ] && echo "PASS: all contended-blind and start-jitter checks" || { echo "FAILED: $FAILS check(s)"; exit 1; }
