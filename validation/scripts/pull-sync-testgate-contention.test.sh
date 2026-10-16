#!/usr/bin/env bash
# pull-sync's test gate does not START a suite or a protected-alone run on a CONTENDED host (scripts/substrate/
# substrate-pull-sync.sh host_contended + the "3-pre. TEST GATE" slice). Runs the script's own code against a temp vessel
# clone with `bun` stubbed and a fixture standing in for /proc/pressure/cpu. No network.
#
# Measured 2026-10-15/16: three nodes of one substrate share a host; after one push all three ran the whole suite at
# once (host load 35.8), a protected positive control passed its 5 s per-test timeout on one node, and that node REFUSED
# to converge a correct commit; 11 of 13 suite kills in 50 h overlapped another node's gate.
#
#   (a) MUST-FAIL: the threshold row is set and host cpu pressure is above it -> TEST GATE DEFERRED naming the contention,
#       no suite run started, not converged, the deferral counted
#   (b) MUST-FAIL: the suite ran, then the host became contended before the protected-alone run -> deferred (held),
#       naming the contention, never refused and never converged
#   (c) MUST-FAIL: consecutive contention deferrals file the starvation gap, which carries defer_cause and says so
#   (d) control: pressure below the threshold -> the gate runs and converges as before
#   (e) control: no threshold row (0) with a contended host -> admission off: the gate runs and converges
#   (f) control: the pressure file unreadable -> admission off (fail open; the budget gate still applies)
#
# usage: validation/scripts/pull-sync-testgate-contention.test.sh [path/to/substrate-pull-sync.sh]
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
tuning_param() { case "$1" in pull_sync.testgate_psi_defer_pct) TP_VALUE="${PSI_PCT:-$2}" ;; *) TP_VALUE="$2" ;; esac; }
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
tick() { : > "$CALLS"; : > "$LOG"; : > "$T/runs.txt"; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s); run_gate; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
suites() { grep -c '^SUITE' "$T/runs.txt" 2>/dev/null || true; }
alones() { grep -c '^ALONE' "$T/runs.txt" 2>/dev/null || true; }
TEST_TIMEOUT_SECONDS=20; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=20; UNIT_TIMEOUT_S=3600; GATE_UNIT_MARGIN_S=2

# ── (a) contended host, threshold set -> deferred before the suite ──
PSI_PCT=30; psi 60.00 55.00; setup activity-api; tick
grep -q 'TEST GATE DEFERRED .*host contended' "$LOG" && ok "(a) DEFERRED naming the host contention" || bad "(a) no contention deferral (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(suites)" = 0 ] && ok "(a) no suite run started" || bad "(a) $(suites) suite run(s) started on a contended host"
converged && bad "(a) converged without a gate" || ok "(a) not converged"
[ "$(awk '{print $2}' "$MARKER_DIR/activity-api.testgate-budget-defers" 2>/dev/null)" = 1 ] && ok "(a) the deferral is counted" || bad "(a) deferral not counted"

# ── (b) the host becomes contended after the suite -> the protected-alone run is deferred, not refused ──
PSI_PCT=30; psi 1.00 1.00; setup development-vessel; touch "$T/stub/hot-after-suite"; tick
grep -q 'TEST GATE DEFERRED — the protected judge test .* not started: host contended' "$LOG" && ok "(b) the protected-alone run DEFERRED naming the contention" || bad "(b) protected run not deferred for contention (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
[ "$(alones)" = 0 ] && ok "(b) no protected-alone run started" || bad "(b) $(alones) protected run(s) started on a contended host"
grep -q 'REFUSING to converge' "$LOG" && bad "(b) refused (a contended host is not a red test)" || ok "(b) not refused"
converged && bad "(b) converged without its protected runs" || ok "(b) not converged"

# ── (c) consecutive contention deferrals file the starvation gap, with the cause ──
PSI_PCT=30; psi 60.00 55.00; setup activity-api; tick; tick; tick
GAPJ="$(grep '^GAP ' "$CALLS" | sed 's/^GAP //' | tail -1)"
printf '%s' "$GAPJ" | jq -e '.impulse.pointer.gap.classification_metadata.defer_cause | test("host contended")' >/dev/null 2>&1 && ok "(c) the starvation gap carries defer_cause" || bad "(c) no defer_cause on the starvation gap (calls: $(tr '\n' '|' < "$CALLS" | cut -c1-300))"
printf '%s' "$GAPJ" | jq -e '.impulse.pointer.gap.summary | test("CAUSE OF THESE DEFERRALS")' >/dev/null 2>&1 && ok "(c) its summary names the contention" || bad "(c) the summary does not name the contention"

# ── (d) control: low pressure -> runs and converges ──
PSI_PCT=30; psi 2.00 3.00; setup activity-api; tick
[ "$(suites)" -ge 1 ] && converged && ok "(d) control: an uncontended host gates and converges" || bad "(d) control did not converge (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
# ── (e) control: no threshold row -> admission off even on a contended host ──
unset PSI_PCT; psi 90.00 90.00; setup activity-api; tick
[ "$(suites)" -ge 1 ] && converged && ok "(e) control: no threshold row, admission off" || bad "(e) control: deferred without a threshold row"
# ── (f) control: unreadable pressure file -> fail open ──
PSI_PCT=30; rm -f "$PSI_CPU_FILE"; setup activity-api; tick
[ "$(suites)" -ge 1 ] && converged && ok "(f) control: no pressure reading, admission off" || bad "(f) control: deferred without a pressure reading"

[ "$FAILS" -eq 0 ] && echo "PASS: all contention-admission checks" || { echo "FAILED: $FAILS check(s)"; exit 1; }
