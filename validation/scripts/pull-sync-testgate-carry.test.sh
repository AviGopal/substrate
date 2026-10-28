#!/usr/bin/env bash
# pull-sync's test gate CARRIES the candidate's result across ticks, so a deferred parent/candidate overlay
# resumes on the next tick without re-running the candidate (scripts/substrate/substrate-pull-sync.sh, the
# "CARRIED CANDIDATE RESULT" block of the 3-pre. TEST GATE slice). Same harness as pull-sync-testgate-budget.test.sh:
# the script's own gate slice against a temp vessel clone with `bun` stubbed and small timeouts. No network.
#
# Observed: a flaky suite needs T1 and the T2 confirmation, then the two-run overlay. When T1 + T2 + the overlay did
# not fit one tick, the overlay deferred "with a fresh budget next tick", and the next tick re-ran T1 and T2 from
# scratch and deferred the overlay again: consecutive deferrals of the same candidate, never a verdict.
#
#   (a) MUST-FAIL: a tick whose budget runs out after the candidate runs defers the overlay; the NEXT tick runs ONLY
#       the overlay (two runs, no T1 or T2) and reaches a verdict (converged), and the carry is consumed
#   (b) the deferral writes the carry atomically (valid JSON with the T1 and T2 output, no temp file left)
#   (c) control: a changed candidate sha discards the carry; the gate re-runs from scratch (four runs); the discard
#       NAMES the changed part (head), from the key_parts stored with the carry (diagnostic only)
#   (d) control: a changed test-environment key (the runner's version) discards the carry; four runs
#   (e) control: no carry, ample budget: the gate runs exactly as before (four runs, converged)
#   (g) a carry written before key_parts existed (no key_parts) with another id is discarded, logged as
#       "parts unknown (older carry)"
#   (f) MUST-FAIL: a per-run wall that changes between the two ticks KEEPS the carry (same HEAD, tree and environment):
#       the next tick resumes with the overlay alone. Two forms: an explicit TEST_TIMEOUT_SECONDS that differs, and
#       the derived wall, where the deferring tick's own completed T1 raises "last completed full run x1.5" for the next
#       tick (what discarded every carry on its first reuse: the wall was part of the carry's key)
#
# usage: validation/scripts/pull-sync-testgate-carry.test.sh [path/to/substrate-pull-sync.sh]
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
tuning_param() { case "$1" in pull_sync.testgate_starve_after_seconds) TP_VALUE="${STARVE_AFTER:-$2}" ;; *) TP_VALUE="$2" ;; esac; }

mkdir -p "$T/bin" "$T/stub"
# bun test         -> sleeps $S/sleep seconds, prints $S/full; each whole-suite run is recorded
# bun test <file>  -> records ALONE <file>, prints $S/alone (green)
cat > "$T/bin/bun" <<EOF
#!/usr/bin/env bash
S="$T/stub"
[ "\$1" = --version ] && { cat "\$S/version" 2>/dev/null || echo 1.0.0; exit 0; }
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

GTR_NODE=node-a
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


# 2 s runs + 1 s grace (worst case 4 s per run). An 11 s unit with a 2 s margin gives a 9 s gate budget: from 1 s
# used, T1 and T2 fit (8 s left, then 6, then 4) and the two-run overlay (8 s) does not; a fresh tick (9 s) fits
# the overlay alone, but not T1 + T2 + the overlay. That is the livelock: without a carry every tick defers.
tight() { unset GATE_BUDGET_SECONDS QUIESCE_MARGIN_S; TEST_TIMEOUT_SECONDS=3; TEST_KILL_GRACE_SECONDS=1; PROTECTED_TEST_TIMEOUT_SECONDS=3; UNIT_TIMEOUT_S=11; GATE_UNIT_MARGIN_S=2; }
ample() { UNIT_TIMEOUT_S=60; }
CARRY() { echo "$MARKER_DIR/$VESSEL.testgate-carry"; }

# ── (a) + (b): defer at the overlay, then resume with the overlay only ─────────────────────────────────────
tight; setup activity-api new; echo 2 > "$T/stub/sleep"; tick 1
deferred && grep -q 'overlay' "$LOG" && [ "$(suites)" = 2 ] && ok "(a) setup: tick 1 ran T1 + T2 and deferred the overlay" || bad "(a) setup: tick 1 did not defer at the overlay (runs $(suites); log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
if jq -e '(.t_out | length > 0) and (.t2_out | length > 0) and (.id | length > 0)' "$(CARRY)" >/dev/null 2>&1; then ok "(b) the deferral carried T1 and T2 (valid JSON)"; else bad "(b) no valid carry after the overlay deferral ($(ls "$MARKER_DIR" | tr '\n' ' '))"; fi
ls "$MARKER_DIR" | grep -q 'testgate-carry\.tmp' && bad "(b) a temp carry file was left behind" || ok "(b) no temp carry file left behind"
tick 0
[ "$(suites)" = 2 ] && ok "(a) tick 2 ran ONLY the two overlay runs (the candidate was not re-run)" || bad "(a) tick 2 ran $(suites) suite runs: the candidate was re-run (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
converged && ok "(a) tick 2 reached a verdict (converged)" || bad "(a) tick 2 reached no verdict (deferred again: $(deferred && echo yes || echo no))"
grep -q 'RESUMING from a carried candidate result (age [0-9]*s' "$LOG" && ok "(a) the resume is logged with the carry's age" || bad "(a) no resume line naming the carry's age"
[ -f "$(CARRY)" ] && bad "(a) the carry survived the verdict" || ok "(a) the carry is consumed"

# ── (c) a changed candidate sha discards the carry ────────────────────────────────────────────────────────────
tight; setup activity-api new; echo 2 > "$T/stub/sleep"; tick 1
[ -f "$(CARRY)" ] || bad "(c) setup: no carry after tick 1"
echo 'export const x = 3;' > "$d/src/x.ts"; g commit -am change2; echo 0 > "$T/stub/sleep"; ample; tick 0
grep -q 'carried candidate result DISCARDED' "$LOG" && ok "(c) a new candidate sha discards the carry" || bad "(c) the carry was not discarded for a new sha (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(suites)" = 4 ] && converged && ! grep -q RESUMING "$LOG" && ok "(c) the new candidate is gated from scratch (four runs) and converges" || bad "(c) the new candidate ran $(suites) runs (resumed: $(grep -c RESUMING "$LOG"))"
grep 'carried candidate result DISCARDED' "$LOG" | grep -q 'changed: [a-z_, ]*\bhead\b' && ok "(c) the discard names the changed part: head" || bad "(c) the discard does not name head ($(grep -o 'DISCARDED.*from scratch' "$LOG" | head -1))"

# ── (d) a changed environment key (runner version) discards the carry ─────────────────────────────────────────
tight; setup activity-api new; echo 2 > "$T/stub/sleep"; echo 1.0.0 > "$T/stub/version"; tick 1
[ -f "$(CARRY)" ] || bad "(d) setup: no carry after tick 1"
echo 1.0.1 > "$T/stub/version"; echo 0 > "$T/stub/sleep"; ample; tick 0
grep -q 'carried candidate result DISCARDED' "$LOG" && ok "(d) a changed runner version discards the carry" || bad "(d) the carry was not discarded for a changed environment (log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ "$(suites)" = 4 ] && converged && ok "(d) gated from scratch (four runs) and converged" || bad "(d) $(suites) runs after an environment change"
rm -f "$T/stub/version"

# ── (e) control: no carry, ample budget, unchanged behaviour ──────────────────────────────────────────────────
tight; ample; setup activity-api new; tick 0
[ "$(suites)" = 4 ] && converged && ! deferred && ! grep -q 'RESUMING\|DISCARDED' "$LOG" && ok "(e) no carry: four runs, converged, no deferral" || bad "(e) the uncarried gate changed (runs $(suites); log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
[ -f "$(CARRY)" ] && bad "(e) a gate that finished left a carry" || ok "(e) a finished gate leaves no carry"


# ── (g) an older carry (no key_parts) is discarded and says its parts are unknown ───────────────────────────────────────
tight; ample; setup activity-api new
printf '{"id":"an-older-id","head":"x","at":%s,"t_out":"x"}\n' "$(date +%s)" > "$(CARRY)"; tick 0
grep 'carried candidate result DISCARDED' "$LOG" | grep -q 'parts unknown (older carry)' && ok "(g) an older carry is discarded as 'parts unknown (older carry)'" || bad "(g) older carry: $(grep -o 'DISCARDED.*from scratch' "$LOG" | head -1)"
[ "$(suites)" = 4 ] && converged && ok "(g) and the gate runs from scratch (four runs)" || bad "(g) $(suites) runs after an older carry"

# ── (f) a per-run wall that changes between ticks keeps the carry ────────────────────────────────────────────────────
# Form 1: TEST_TIMEOUT_SECONDS 3 at the deferral, 4 at the resume (a 13 s unit so the 2 x (4 + 1) s overlay fits).
tight; setup activity-api new; echo 2 > "$T/stub/sleep"; tick 1
[ -f "$(CARRY)" ] || bad "(f) setup: no carry after tick 1 (TEST_TIMEOUT_SECONDS form)"
TEST_TIMEOUT_SECONDS=4; UNIT_TIMEOUT_S=13; tick 0
grep -q 'carried candidate result DISCARDED' "$LOG" && bad "(f) a changed TEST_TIMEOUT_SECONDS discarded the carry (the wall is not a result input)" || ok "(f) a changed TEST_TIMEOUT_SECONDS keeps the carry"
{ [ "$(suites)" = 2 ] && converged && grep -q RESUMING "$LOG"; } && ok "(f) the next tick resumed with the overlay alone (two runs) and converged" || bad "(f) TEST_TIMEOUT_SECONDS form: $(suites) runs, converged=$(converged && echo yes || echo no), resumed=$(grep -c RESUMING "$LOG")"
# Form 2: the derived wall (TEST_TIMEOUT_SECONDS unset). A 4 s floor and a recorded 1 s run give a 4 s wall at tick 1;
# its own 3 s T1 is recorded as the last completed full run, so tick 2 derives a 5 s wall. 1 s grace, a 40 s unit and a
# 2 s margin (38 s budget, cap 8 s): from 25 s used, T1 and T2 fit and the 2 x 5 s overlay does not; tick 2 fits it.
tight; unset TEST_TIMEOUT_SECONDS; SUITE_WALL_FLOOR_S=4; UNIT_TIMEOUT_S=40; setup activity-api new; echo 3 > "$T/stub/sleep"
echo '{"last_completed_wall_s":1}' > "$MARKER_DIR/$VESSEL.suite-wall"; tick 25
grep -q 'per-run wall 4s' "$LOG" || bad "(f) setup: tick 1's derived wall is not 4 s ($(grep -o 'per-run wall [0-9]*s' "$LOG" | head -1))"
[ -f "$(CARRY)" ] || bad "(f) setup: no carry after tick 1 (derived-wall form; log: $(tr '\n' '|' < "$LOG" | cut -c1-300))"
tick 0
grep -q 'per-run wall 5s' "$LOG" && ok "(f) setup: tick 2 derives a different wall (5 s) from tick 1's own run" || bad "(f) setup: tick 2's wall did not change ($(grep -o 'per-run wall [0-9]*s' "$LOG" | head -1))"
grep -q 'carried candidate result DISCARDED' "$LOG" && bad "(f) the derived wall's change discarded the carry" || ok "(f) the derived wall's change keeps the carry"
{ [ "$(suites)" = 2 ] && converged && grep -q RESUMING "$LOG"; } && ok "(f) derived-wall form: resumed with the overlay alone (two runs) and converged" || bad "(f) derived-wall form: $(suites) runs, converged=$(converged && echo yes || echo no), resumed=$(grep -c RESUMING "$LOG")"
unset SUITE_WALL_FLOOR_S

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
