#!/usr/bin/env bash
# the-protected-alone-gate-run-counts-a-bun-per-test-timeout-u.check.sh: the row's own check for gap
# the-protected-alone-gate-run-counts-a-bun-per-test-timeout-under-host-contention-as-a-regression-so-a-loaded-tick-refuses-a-green-candidate.
#
# pull-sync's protected-alone run (bun's 5000 ms per-test default) refused a candidate when a protected test only
# TIMED OUT under host contention, and passed the same sha unchanged at a later, quieter tick. The fix retries a
# protected file ONCE when its red is only bun per-test timeouts on a contended host, and only on a quiet host.
#
#   MUST-FAIL (k): a timeout-only red, host contended at the run's end and quiet at retry time -> retried once, its
#                  green counts, the candidate converges, and both runs are logged
#   CONTROL  (k'): an assertion red (alone, or mixed with a timeout) is still refused and not retried
#   CONTROL (k''): a timeout-only red on an uncontended host is still refused and not retried
#
# The gate slice is taken from the script with sed/awk and sourced with every collaborator stubbed (bun, the
# contention probe, the tuning read); the script itself is never run, and no real host pressure is read. Cases
# reused from pull-sync-testgate-protected-timeout-retry.test.sh.
#
#   the-protected-alone-gate-run-counts-a-bun-per-test-timeout-u.check.sh [path/to/substrate-pull-sync.sh]
# Needs bash, git, jq, awk, sed.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/ps-protretry.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── the code under test, taken from the script itself (the protected-alone fixture's extraction) ──
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

CALLS="$T/calls.txt"; LOG="$T/log.txt"; DEFERRAL_LOG="$T/deferrals.jsonl"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }
ensure_clone_deps() { return 0; }
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
tuning_param() { TP_VALUE="$2"; }
# Host contention: quiet until a protected-alone run started this tick, then from a queue (y = contended; empty = quiet).
host_contended() {
  HC_WHY=""
  [ -f "$T/prot-started" ] || return 1
  local a; a="$(head -1 "$T/hc" 2>/dev/null)"; sed -i '1d' "$T/hc" 2>/dev/null || true
  echo "HC ${a:-n}" >> "$T/hc-calls"
  [ "$a" = y ] || return 1
  HC_WHY="host contended: cpu pressure some avg10=40% avg60=35% >= 30% (pull_sync.testgate_psi_defer_pct)"
}
PSI_CPU_FILE="$T/psi"; echo "some avg10=40.00 avg60=35.00 avg300=20.00 total=1" > "$PSI_CPU_FILE"

mkdir -p "$T/bin" "$T/stub"
# bun test         -> $S/full; bun test <file> -> run N of the file answers $S/alone-<b>.<N> (exit $S/alone-<b>.<N>.rc)
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = test ] || exit 0
shift
if [ \$# -eq 0 ]; then cat "\$S/full"; exit 1; fi
b="\$(basename "\$1")"
echo "ALONE \$b" >> "$T/alone-calls.txt"; : > "$T/prot-started"
n="\$(grep -c "^ALONE \$b\$" "$T/alone-calls.txt")"
if [ -f "\$S/alone-\$b.\$n" ]; then cat "\$S/alone-\$b.\$n"; exit "\$(cat "\$S/alone-\$b.\$n.rc" 2>/dev/null || echo 0)"; fi
exit 1
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

VESSEL=development-vessel
GTR_NODE=test-node
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"
d="$CLONE_DIR/$VESSEL/"
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
PF=test/resolvers/test-suite-mutate-shell-gate.test.ts
B="$(basename "$PF")"
FULL="(pass) a > works
 1 pass
 0 fail"
GREEN="(pass) mutate > the applier refuses a mismatch
(pass) mutate > MUST-FAIL: a mutant applies
 7 pass
 0 fail"
TIMEOUT="(pass) mutate > the applier refuses a mismatch
(fail) mutate > MUST-FAIL: a mutant applies [5001.00ms]
  ^ this test timed out after 5000ms.
 6 pass
 1 fail"
ASSERT="(pass) mutate > the applier refuses a mismatch
error: expect(received).toBeGreaterThan(expected)
(fail) mutate > MUST-FAIL: a mutant applies [12.00ms]
 6 pass
 1 fail"
# Two cases timing out (a file whose child-env class-check cases each parse src: both outlive 5 s on a loaded host).
TIMEOUT2="(pass) child-env > parses one file
(fail) child-env > CLASS CHECK: every child env is scrubbed [5002.00ms]
  ^ this test timed out after 5000ms.
(fail) child-env > CLASS CHECK: no child inherits the parent env [5001.00ms]
  ^ this test timed out after 5000ms.
 12 pass
 2 fail"
MIXED="(fail) mutate > MUST-FAIL: a mutant applies [5001.00ms]
  ^ this test timed out after 5000ms.
error: expect(received).toBe(expected)
(fail) mutate > the applier refuses a mismatch [3.00ms]
 5 pass
 2 fail"

setup() {
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/stub"/* "$T/alone-calls.txt" "$T/hc" "$T/hc-calls" "$DEFERRAL_LOG"
  mkdir -p "$d/src" "$d/test/resolvers" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  echo 'test("p", () => {});' > "$d/$PF"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  printf '%s\n' "$FULL" > "$T/stub/full"
  : > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "0 1 0" > "$TEST_BASELINE_DIR/$VESSEL"
  jq -n --arg p "repos/$VESSEL/$PF" '{autonomyScope:{excluded_paths:[$p]}}' > "$PROTECTED_SCOPE_FILE"
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am candidate
  synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0
}
run_n() { printf '%s\n' "$2" > "$T/stub/alone-$B.$1"; echo "$3" > "$T/stub/alone-$B.$1.rc"; }
hc() { printf '%s\n' "$@" > "$T/hc"; }
tick() { : > "$CALLS"; : > "$LOG"; rm -f "$T/prot-started"; HEAD="$(git -C "$d" rev-parse HEAD)"; run_gate; }
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
refused() { grep -q "protected judge tests at" "$LOG"; }
deferred() { grep -q "TEST GATE DEFERRED" "$LOG"; }
runs() { grep -c "^ALONE $B\$" "$T/alone-calls.txt" 2>/dev/null || echo 0; }
logs() { tr '\n' '|' < "$LOG" | cut -c1-600; }

# ── (k) MUST-FAIL: timeout-only red under contention, quiet at retry -> one retry, green -> converges ──
setup
run_n 1 "$TIMEOUT" 1; run_n 2 "$GREEN" 0
hc y n     # end of run 1: contended; retry time: quiet
tick
converged && ok "(k) a timeout-only red on a contended host is retried once on a quiet host and its green counts" || bad "(k) not converged after a quiet retry (runs $(runs); log: $(logs))"
[ "$(runs)" = 2 ] && ok "(k) exactly two runs" || bad "(k) $(runs) runs, expected 2"
grep -q "protected retry after timeout under contention" "$LOG" && grep -q "run 2, quiet host) is GREEN" "$LOG" && grep -q "psi some" "$LOG" \
  && ok "(k) both runs are logged with load and PSI" || bad "(k) the runs are not logged with load/PSI (log: $(logs))"
grep -q '"action":"protected_retry_after_timeout_under_contention"' "$DEFERRAL_LOG" 2>/dev/null && ok "(k) the deferral log records protected_retry_after_timeout_under_contention" || bad "(k) no deferral-log record"

# ── (k') control: an assertion red, and a red mixing an assertion with a timeout -> refused, not retried ──
for c in ASSERT MIXED; do
  setup
  run_n 1 "${!c}" 1; run_n 2 "$GREEN" 0
  hc y n
  tick
  { refused && ! converged; } && ok "(k') $c: an assertion red is refused" || bad "(k') $c: not refused (log: $(logs))"
  [ "$(runs)" = 1 ] && ok "(k') $c: not retried" || bad "(k') $c: retried ($(runs) runs)"
done

# ── (k'') control: timeout-only red on an UNCONTENDED host -> refused, not retried ──
setup
run_n 1 "$TIMEOUT" 1; run_n 2 "$GREEN" 0
hc n
tick
{ refused && ! converged; } && ok "(k'') a timeout on a quiet host is refused" || bad "(k'') not refused (log: $(logs))"
[ "$(runs)" = 1 ] && ok "(k'') not retried" || bad "(k'') retried ($(runs) runs)"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
