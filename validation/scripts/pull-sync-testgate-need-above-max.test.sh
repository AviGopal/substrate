#!/usr/bin/env bash
# pull-sync's test gate must never skip a candidate forever on a measured need no tick can meet
# (scripts/substrate/substrate-pull-sync.sh, the "3-pre. TEST GATE" slice: the skip on an unchanged key).
#
# Observed: one slow attempt under load recorded a gate need (3492 s) above the most any tick can give
# (the gate budget, capped by TimeoutStartSec less the margin). Every tick then logged "skipped WITHOUT a
# run ... needs up to 3492s but 3443s remain", never re-measured (a deferral never lowers a need), and the
# candidate could never install: a fixed point.
#
#   (1) MUST-FAIL: a stored need above the maximum budget: the next tick RUNS the suite (not skipped), logs
#       TEST GATE RE-MEASURE, and records a fresh need that replaces the stale one; nothing converges
#   (2) a re-measure whose run is killed at its wall holds the candidate: never converged ungated
#   (3) CONTROL: a need within the time left: the gate runs and converges as before, no re-measure
#   (4) CONTROL: a need above the time left but within the maximum (merely late in a tick): still deferred
#       WITHOUT a run to the next tick, as before
#
# The harness is the one in pull-sync-testgate-rotation.test.sh: temp vessel clones through the script's
# own pass order and gate slice, `bun` stubbed per vessel, small timeouts standing in for the real ones.
#
# usage: validation/scripts/pull-sync-testgate-need-above-max.test.sh [path/to/substrate-pull-sync.sh]
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

GTR_NODE=node-a
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
tick_late() { : > "$LOG"; : > "$T/runs.txt"; synced=0; failed=0; skipped=0; GEN_QUEUE=""; unset GATE_T0; PULLSYNC_T0=$(( $(date +%s) - $1 )); run_tick; }
need_of() { awk '{print $2}' "$MARKER_DIR/$1.testgate-need" 2>/dev/null; }
set_need() { awk -v n="$2" '{$2 = n; print}' "$MARKER_DIR/$1.testgate-need" > "$T/need.tmp" && mv "$T/need.tmp" "$MARKER_DIR/$1.testgate-need"; }
logtail() { tr '\n' '|' < "$LOG" | cut -c1-400; }
# The maximum any tick can give here: UNIT_TIMEOUT_S 16 less the 2 s margin = 14 s.

# ── (1) a stale need above the maximum budget is re-measured, not skipped ──────────
reset_all; mkvessel kk 7; touch "$T/stub/kk.always-new"
tick                                  # measured: run 1 (7 s), T2 (9 s) does not fit the 7 s left: need 16
[ -s "$MARKER_DIR/kk.testgate-need" ] && ok "(1) setup: a need was recorded ($(need_of kk)s)" || bad "(1) setup recorded no need (log: $(logtail))"
set_need kk 3492                      # the observed stale estimate, at the same key
: > "$CALLS"; tick
[ "$(ran kk)" -ge 1 ] && ok "(1) a need above the maximum budget: the suite RAN" || bad "(1) skipped without a run on a need no tick can meet (log: $(logtail))"
grep -q 'TEST GATE RE-MEASURE' "$LOG" && ok "(1) the re-measure decision is logged" || bad "(1) no TEST GATE RE-MEASURE line (log: $(logtail))"
n="$(need_of kk)"; case "$n" in ''|*[!0-9]*) n=99999 ;; esac
[ "$n" -lt 3492 ] && ok "(1) the fresh measurement (${n}s) replaced the stale need" || bad "(1) the stale need was kept (need ${n}s)"
conv kk && bad "(1) a gate that did not finish converged" || ok "(1) the re-measured candidate holds (its gate still cannot fit)"
tick
[ "$(ran kk)" -ge 1 ] && ok "(1) the next tick runs again (never a permanent skip)" || bad "(1) a later tick skipped it again (log: $(logtail))"

# ── (2) a re-measure killed at its wall never converges ungated ──────────────────────
reset_all; mkvessel ll 7; touch "$T/stub/ll.always-new"
tick; set_need ll 3492
echo 12 > "$T/stub/ll.sleep"          # past the 8 s per-run wall: killed (timeout signals the whole group)
: > "$CALLS"; tick
[ "$(ran ll)" -ge 1 ] && grep -q 'TEST GATE RE-MEASURE' "$LOG" && ok "(2) setup: the slow suite was re-measured" || bad "(2) the slow suite was not re-measured (log: $(logtail))"
conv ll && bad "(2) a run killed at its wall converged the candidate ungated" || ok "(2) killed at its wall: held, not converged"

# ── (3) CONTROL: a need within the time left runs as before ─────────────────────────
reset_all; mkvessel mm 4; touch "$T/stub/mm.always-new"
tick_late 2; set_need mm 5
rm -f "$T/stub/mm.always-new"; echo 1 > "$T/stub/mm.sleep"
: > "$CALLS"; tick
[ "$(ran mm)" -ge 1 ] && conv mm && ok "(3) control: a need within the time left gates and converges" || bad "(3) control: a fitting need did not gate and converge (log: $(logtail))"
grep -q 'TEST GATE RE-MEASURE' "$LOG" && bad "(3) control: a fitting need was logged as a re-measure" || ok "(3) control: no re-measure line"

# ── (4) CONTROL: above the time left, within the maximum: deferred without a run ────
reset_all; mkvessel nn 4; touch "$T/stub/nn.always-new"
tick_late 2; set_need nn 13
: > "$CALLS"; tick_late 4              # 10 s left < 13 s need <= 14 s maximum
[ "$(ran nn)" = 0 ] && grep -q 'skipped WITHOUT a run' "$LOG" && ok "(4) control: a late tick still defers WITHOUT a run" || bad "(4) control: a need that a fresh tick can meet was not deferred (runs $(ran nn); log: $(logtail))"
grep -q 'TEST GATE RE-MEASURE' "$LOG" && bad "(4) control: logged a re-measure for a need within the maximum" || ok "(4) control: no re-measure line"
conv nn && bad "(4) control: converged on a skip" || ok "(4) control: nothing converged"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
