#!/usr/bin/env bash
# pull-sync's test gate must end every tick BEFORE systemd's TimeoutStartSec kills it, by checking the
# time left before EVERY run it starts (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE"
# slice and unit_timeout_s). Runs the script's own code against a temp vessel clone with `bun` stubbed;
# small timeouts stand in for the real 240 s / 900 s, so the timing cases run in seconds. No network.
#
# Measured 2026-10-06 on the hub: GATE_BUDGET_SECONDS defaulted to 1000 against TimeoutStartSec=900 and
# was checked ONCE, before a vessel's gate; activity-api's gate then started up to five more suite runs,
# systemd SIGTERMed every tick at 900 s, every vessel after it never converged, and the deferral /
# starvation path never fired, so the stall was silent.
#
#   (a) MUST-FAIL: the tick has already used most of the unit's TimeoutStartSec (the hub's case) ->
#       TEST GATE DEFERRED, no suite run started, not converged
#   (b) MUST-FAIL: the first run fits, the T2 confirmation does not -> DEFERRED before T2 (one run, not two),
#       not converged, and the gate returns well inside the unit timeout (no kill)
#   (c) MUST-FAIL: a dev-vessel candidate whose protected judge tests cannot fit -> HELD (deferred), never
#       converged, no protected run started
#   (d) MUST-FAIL: N consecutive deferrals of the same candidate file the budget-starved gap (no silent
#       starvation), including deferrals that happen MID-gate (the counter resets only on a finished gate)
#   (e) MUST-FAIL: the budget follows the LIVE unit's TimeoutStartSec (systemctl), not a constant: 10min ->
#       600, 1h 30min -> 5400, an unloaded unit / infinity / garbage -> 900
#   (h) MUST-FAIL: a slow clone-dependency install eats the time left -> deferred before the first run
#   (j) MUST-FAIL: time left between 1x and 2x a suite run at the parent/candidate overlay -> deferred BEFORE
#       either overlay run (the overlay is two runs; starting the first would let the second be killed)
#   (k) MUST-FAIL: RED BEATS DEFER: protected file 1 red alone, file 2 cannot fit -> REFUSED naming file 1,
#       not deferred as "budget"
#   (l) MUST-FAIL: the real ensure_clone_deps, called from the gate with too little time for its install,
#       returns 2 (budget) without installing, and the gate defers; control: ample time installs
#   (f) a deferral leaves the vessel at its current runtime: last-good unchanged, nothing converged
#   (g) control: ample budget -> the gate runs exactly as before and converges
#
# usage: validation/scripts/pull-sync-testgate-budget.test.sh [path/to/substrate-pull-sync.sh]
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
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }
ensure_clone_deps() { sleep "${DEPS_SLEEP:-0}"; if [ -n "${DEPS_RC:-}" ]; then CD_BUDGET_SHORT="the clone dependency install (stub)"; return "$DEPS_RC"; fi; return 0; }
ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
tuning_param() { TP_VALUE="$2"; }

mkdir -p "$T/bin" "$T/stub"
# bun test         -> sleeps $S/sleep seconds, prints $S/full; each whole-suite run is recorded
# bun test <file>  -> records ALONE <file>, prints $S/alone (green)
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = test ] || exit 0
shift
if [ \$# -eq 0 ]; then echo SUITE >> "$T/runs.txt"; sleep "\$(cat "\$S/sleep" 2>/dev/null || echo 0)"; cat "\$S/full"; exit 1; fi
b="\$(basename "\$1")"; echo "ALONE \$b" >> "$T/runs.txt"
sleep "\$(cat "\$S/alone-sleep-\$b" 2>/dev/null || echo 0)"
if [ -f "\$S/alone-red-\$b" ]; then printf '(fail) j > red\n 2 pass\n 1 fail\n'; exit 1; fi
printf '(pass) p > ok\n 3 pass\n 0 fail\n'; exit 0
EOF
chmod +x "$T/bin/bun"
BUN_BIN="$T/bin/bun"

GTR_NODE=node1
CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3
PROTECTED_SCOPE_FILE="$T/autonomy-scope.json"
PF=test/resolvers/system-authored-gap-checks.test.ts
OLD='(fail) old > one'
NEWF='(fail) new > regressed'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }

setup() { # $1 vessel, $2 full-suite output ("same" = baseline names only, "new" = one newly failing name)
  VESSEL="$1"; d="$CLONE_DIR/$VESSEL/"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/runs.txt"
  mkdir -p "$d/src" "$d/test/resolvers" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"; echo 'test("p", () => {});' > "$d/$PF"
  git -C "$d" init -q -b dev; g add -A; g commit -m base
  git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g commit -am change
  if [ "$2" = new ]; then printf '(pass) a > works\n%s\n%s\n 5 pass\n 2 fail\n' "$OLD" "$NEWF" > "$T/stub/full"
  else printf '(pass) a > works\n%s\n 5 pass\n 1 fail\n' "$OLD" > "$T/stub/full"; fi
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 5 0" > "$TEST_BASELINE_DIR/$VESSEL"
  jq -n --arg p "repos/development-vessel/$PF" '{autonomyScope:{excluded_paths:[$p]}}' > "$PROTECTED_SCOPE_FILE"
  echo 0 > "$T/stub/sleep"; rm -f "$T/stub"/alone-*
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
tick() { # $1 seconds of the tick already used before the gate
  : > "$CALLS"; : > "$LOG"; : > "$T/runs.txt"; HEAD="$(git -C "$d" rev-parse HEAD)"
  unset GATE_T0; PULLSYNC_T0=$(( $(date +%s) - $1 )); _t0=$(date +%s); run_gate; WALL=$(( $(date +%s) - _t0 ))
}
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
suites() { grep -c '^SUITE' "$T/runs.txt" 2>/dev/null || true; }
deferred() { grep -q 'TEST GATE DEFERRED' "$LOG"; }

# Real-scale numbers for the "already late" cases: 240 s runs + 30 s grace on a 900 s unit, 120 s margin.
real() { unset GATE_BUDGET_SECONDS GATE_UNIT_MARGIN_S QUIESCE_MARGIN_S PROTECTED_TEST_TIMEOUT_SECONDS; TEST_TIMEOUT_SECONDS=240; TEST_KILL_GRACE_SECONDS=30; UNIT_TIMEOUT_S=900; }
# Small numbers for the timed cases: 3 s runs + 1 s grace (worst case 4 s), a 10 s unit, a 2 s margin.
small() { unset GATE_BUDGET_SECONDS QUIESCE_MARGIN_S; TEST_TIMEOUT_SECONDS=3; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=10; GATE_UNIT_MARGIN_S=2; }

# ── (a) the hub's case: 700 s of a 900 s unit already used -> deferred, no run ──
real; setup activity-api same; tick 700
deferred && ok "(a) DEFERRED when the tick has used 700 s of a 900 s unit" || bad "(a) no deferral at 700 s of 900 s (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(suites)" = 0 ] && ok "(a) no suite run started" || bad "(a) $(suites) suite run(s) started past the unit's time"
converged && bad "(a) converged without a gate" || ok "(a) not converged"
grep -q 'TimeoutStartSec 900s' "$LOG" && ok "(a) the deferral names the unit timeout" || bad "(a) deferral line does not name the unit timeout"

# ── (b) first run fits, the T2 confirmation does not -> deferred before T2, no kill ─
small; setup activity-api new; echo 2 > "$T/stub/sleep"; tick 3
deferred && grep -q 'T2 confirmation' "$LOG" && ok "(b) DEFERRED before the T2 confirmation" || bad "(b) T2 not deferred (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(suites)" = 1 ] && ok "(b) exactly one suite run" || bad "(b) $(suites) suite runs (the second could not finish inside the unit)"
converged && bad "(b) converged on a partial measurement" || ok "(b) not converged"
[ $(( 3 + WALL )) -lt 10 ] && ok "(b) the gate returned at ${WALL}s, inside the 10 s unit (no kill)" || bad "(b) the gate ran ${WALL}s past the unit's timeout"

# ── (c) protected judge tests cannot fit -> HELD, never converged, never run ─────
small; setup development-vessel same; echo 2 > "$T/stub/sleep"; tick 3
deferred && grep -q 'protected judge test' "$LOG" && ok "(c) protected alone-runs that cannot fit DEFER the candidate" || bad "(c) no protected deferral (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
grep -q '^ALONE' "$T/runs.txt" && bad "(c) a protected run was started that could not finish" || ok "(c) no protected run started"
converged && bad "(c) converged WITHOUT the protected check" || ok "(c) HELD, not converged"

# ── (d) N consecutive deferrals (mid-gate) file the starvation gap ───────────────
small; setup activity-api new; echo 2 > "$T/stub/sleep"
tick 3; tick 3; tick 3
grep -q 'pull-sync-testgate-budget-starved-activity-api' "$CALLS" && ok "(d) 3 consecutive mid-gate deferrals filed the budget-starved gap" || bad "(d) no starvation gap after 3 deferrals (defers file: $(cat "$MARKER_DIR/activity-api.testgate-budget-defers" 2>/dev/null))"
echo 0 > "$T/stub/sleep"; tick 0
[ ! -f "$MARKER_DIR/activity-api.testgate-budget-defers" ] && ok "(d) a gate that finished measuring resets the deferral count" || bad "(d) the deferral count survived a finished gate"

# ── (e) the live unit's TimeoutStartSec ───────────────────────────────────────────
mkdir -p "$T/sysbin"
ut() { # $1 LoadState, $2 TimeoutStartUSec -> unit_timeout_s with systemctl stubbed
  printf '#!/usr/bin/env bash\ncase "$*" in *LoadState*) echo "%s" ;; *TimeoutStartUSec*) echo "%s" ;; esac\n' "$1" "$2" > "$T/sysbin/systemctl"; chmod +x "$T/sysbin/systemctl"
  PATH="$T/sysbin:$PATH" unit_timeout_s
}
if declare -F unit_timeout_s >/dev/null; then
  [ "$(ut loaded 15min)" = 900 ] && ok "(e) 15min -> 900" || bad "(e) 15min -> $(ut loaded 15min)"
  [ "$(ut loaded 10min)" = 600 ] && ok "(e) 10min -> 600 (a drop-in is honoured)" || bad "(e) 10min -> $(ut loaded 10min)"
  [ "$(ut loaded '1h 30min')" = 5400 ] && ok "(e) 1h 30min -> 5400" || bad "(e) 1h 30min -> $(ut loaded '1h 30min')"
  [ "$(ut loaded '1min 30s')" = 90 ] && ok "(e) 1min 30s -> 90" || bad "(e) 1min 30s -> $(ut loaded '1min 30s')"
  [ "$(ut not-found '1min 30s')" = 900 ] && ok "(e) an unloaded unit's default is NOT trusted -> 900" || bad "(e) unloaded unit -> $(ut not-found '1min 30s')"
  [ "$(ut loaded infinity)" = 900 ] && ok "(e) infinity -> 900" || bad "(e) infinity -> $(ut loaded infinity)"
  [ "$(ut loaded 'banana')" = 900 ] && ok "(e) unparseable -> 900" || bad "(e) unparseable -> $(ut loaded banana)"
  # and the gate follows it: a 10min unit at 400 s used still gates; the same tick on a 5min unit defers
  real; setup activity-api same; UNIT_TIMEOUT_S="$(ut loaded 10min)"; tick 200
  converged && ok "(e) 10min unit, 200 s used: gates and converges" || bad "(e) 10min unit did not gate (log: $(tr '\n' '|' < "$LOG" | cut -c1-200))"
  real; setup activity-api same; UNIT_TIMEOUT_S="$(ut loaded 5min)"; tick 200
  deferred && ok "(e) 5min unit, 200 s used: defers" || bad "(e) 5min unit did not defer"
else
  bad "(e) no unit_timeout_s: the budget cannot follow the live unit's TimeoutStartSec"
fi

# ── (h) a slow dependency install eats the budget -> deferred before the first run
small; setup activity-api same; DEPS_SLEEP=2; tick 3; DEPS_SLEEP=0
deferred && [ "$(suites)" = 0 ] && ! converged && ok "(h) re-checked after the dependency install: deferred, no run started" || bad "(h) a run started after the install used the time left (runs $(suites))"

# ── (j) overlay needs two runs; only between 1x and 2x left -> deferred before either ──
small; setup activity-api new; tick 1
deferred && grep -q 'overlay' "$LOG" && ok "(j) DEFERRED before the two-run overlay" || bad "(j) overlay not deferred (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
[ "$(suites)" = 2 ] && ok "(j) no overlay run started (2 suite runs: first + T2)" || bad "(j) $(suites) suite runs: an overlay run started without its budget"
converged && bad "(j) converged" || ok "(j) not converged"

# ── (k) red beats defer in the protected loop ─────────────────────────────────────
small; setup development-vessel same
PF2=test/resolvers/scope-earn-in.test.ts; echo 'test("q", () => {});' > "$d/$PF2"; g add -A; g commit -m two
jq -n --arg a "repos/development-vessel/$PF" --arg b "repos/development-vessel/$PF2" '{autonomyScope:{excluded_paths:[$a,$b]}}' > "$PROTECTED_SCOPE_FILE"
touch "$T/stub/alone-red-$(basename "$PF")"; echo 2 > "$T/stub/alone-sleep-$(basename "$PF")"; tick 3
grep -q "^ALONE $(basename "$PF2")" "$T/runs.txt" && bad "(k) setup: file 2 ran (the case did not exhaust the budget)" || ok "(k) file 2 could not fit and was not started"
grep -q 'TEST REGRESSION' "$LOG" && grep -qF "$(basename "$PF")" "$LOG" && ok "(k) a red protected file is REFUSED (named) even when the next one cannot fit" || bad "(k) red protected file not refused (log: $(tr '\n' '|' < "$LOG" | cut -c1-400))"
deferred && bad "(k) reported as a budget deferral instead of a refusal" || ok "(k) not reported as budget"
converged && bad "(k) converged" || ok "(k) not converged"

# ── (l) the real ensure_clone_deps is pre-budgeted when called from the gate ──────
(
  sed -n '/^ensure_clone_deps() {/,/^}/p' "$SCRIPT" > "$T/cd.sh"
  grep -q 'CD_BUDGET_CHECK' "$T/cd.sh" || { echo "FAIL - (l) ensure_clone_deps has no budget pre-check"; exit 1; }
  # shellcheck disable=SC1090
  source "$T/cd.sh"
  clone_shared_packages() { :; }; clone_file_deps() { :; }; clone_dep_missing() { :; }; file_dep_identity() { echo x; }
  clone_deps_gap() { :; }; log() { :; }; clone_deps_install() { echo INSTALL >> "$T/inst.txt"; mkdir -p "$1/node_modules"; return 0; }
  CDD="$T/cdv"; rm -rf "$CDD" "$T/inst.txt"; mkdir -p "$CDD" "$T/cdm"; echo '{"name":"x"}' > "$CDD/package.json"; MARKER_DIR="$T/cdm"
  CLONE_DEPS_INSTALL_TIMEOUT_SECONDS=180; SUITE_COST_S=270
  gate_left() { echo 300; }
  CD_BUDGET_SHORT=""; CD_BUDGET_CHECK=1 ensure_clone_deps v "$CDD"; rc=$?
  [ "$rc" = 2 ] && [ ! -f "$T/inst.txt" ] && echo "ok   - (l) too little time: returns 2 and installs nothing" || echo "FAIL - (l) rc=$rc, install ran: $([ -f "$T/inst.txt" ] && echo yes || echo no)"
  gate_left() { echo 9999; }
  CD_BUDGET_SHORT=""; CD_BUDGET_CHECK=1 ensure_clone_deps v "$CDD"; rc=$?
  [ "$rc" = 0 ] && [ -f "$T/inst.txt" ] && echo "ok   - (l) control: ample time installs" || echo "FAIL - (l) control rc=$rc"
) > "$T/l.txt" 2>&1
cat "$T/l.txt"; FAILS=$((FAILS + $(grep -c '^FAIL' "$T/l.txt")))
real; setup activity-api same; DEPS_RC=2; tick 0; DEPS_RC=""
deferred && [ "$(suites)" = 0 ] && ! converged && ok "(l) the gate defers on ensure_clone_deps' budget return, no run" || bad "(l) the gate did not defer on rc 2 (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"

# ── (f) a deferral leaves the runtime where it was ─────────────────────────────────
real; setup activity-api same; before="$(cat "$LAST_GOOD_DIR/activity-api")"; tick 700
[ "$(cat "$LAST_GOOD_DIR/activity-api")" = "$before" ] && ! converged && ok "(f) deferral leaves last-good and the runtime unchanged" || bad "(f) a deferral moved the vessel"

# ── (g) control: ample budget -> converges exactly as before ─────────────────────
real; setup activity-api same; tick 0
converged && [ "$(suites)" = 1 ] && ! deferred && ok "(g) ample budget: one run, converged, no deferral" || bad "(g) control changed (runs $(suites); log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
real; setup development-vessel same; tick 0
converged && grep -q '^ALONE' "$T/runs.txt" && ok "(g) ample budget: protected tests still run alone and the candidate converges" || bad "(g) dev-vessel control changed"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
