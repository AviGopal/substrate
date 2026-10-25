#!/usr/bin/env bash
# pull-sync's test gate ran a vessel's WHOLE suite in every gate run (T1, T2, the overlay). On one node activity-api's suite
# took ~860 s against the 840 s per-run cap, so every tick killed it at the wall and the vessel never converged; ~690 s of
# it was three classes of slow files (trace-retention *.scale files, *.real* files that each boot a database, one
# bounded-list file). THE SLOW LANE (scripts/substrate/substrate-pull-sync.sh): a vessel's slow files are declared through
# the shaped row pull_sync.slow_test_globs (default: activity-api's three globs), the gate's runs name only the FAST files,
# and the slow files run ONCE after convergence, where a regression files a gap and never blocks.
# Scaled: a 60 s unit, a 2 s margin, a 1 s grace -> cap (60-2)/4-1 = 13 s, floor 3 s. The fixture's slow files cost
# 5+4+3 = 12 s and its fast files 2 s, so the whole suite (14 s) exceeds the 13 s wall and the slow set alone fits it.
#   (a) MUST-FAIL: with the slow list declared, every gate run names only the fast files, and the candidate whose whole
#       suite exceeds the wall converges in one tick (at the parent every tick is killed at the wall)
#   (b) after convergence the slow lane runs once, naming only the slow files; its first observation records a baseline
#   (c) CONTROL: a regression in a slow file still files a gap naming the vessel, the candidate sha, the file and the test,
#       re-filed while it fails (never absorbed into the slow baseline), and the candidate still converges; clean closes it
#   (d) the slow lane never runs for a candidate that did not converge, nor when the tick's budget cannot hold it
#   (e) CONTROL: a vessel with no slow list runs plain `bun test` (no file arguments), queues no slow lane, logs no split
#   (f) a shaped row replaces the default; tuning_param's string mode reads it, and its numeric path is unchanged
# Needs bash, git, jq, timeout.
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  sed -n '/^scrubbed_env() {/,/^}/p' "$SCRIPT"
  sed -n '/^unresolved_modules() {/,/^}/p' "$SCRIPT"
  sed -n '/^test_only_range() {/,/^}/p' "$SCRIPT"
  grep '^PULLSYNC_SLOW_TEST_GLOBS_DEFAULT=' "$SCRIPT"
  sed -n '/^slow_test_globs() {/,/^}/p' "$SCRIPT"
  sed -n '/^slow_split() {/,/^}/p' "$SCRIPT"
  sed -n '/^slow_lane_run() {/,/^}/p' "$SCRIPT"
  echo 'run_gate() {'; echo 'for v in "$VESSEL"; do'
  awk '/^  # 3-pre\. TEST GATE/{on=1} on{print} on && /^  rm -f "\$MARKER_DIR\/\$v\.testgate-refusals"/{exit}' "$SCRIPT"
  echo '  echo "CONVERGED $v" >> "$CALLS"'; echo 'done'; echo '}'
} > "$T/fns.sh"
sed -n '/^tuning_param() {/,/^}/p' "$SCRIPT" | sed 's/^tuning_param() {/real_tuning_param() {/' > "$T/tp.sh"
grep -q 'testgate-refusals' "$T/fns.sh" || { echo "FAIL - could not extract the test-gate slice"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"
CALLS="$T/calls.txt"; LOG="$T/log.txt"
log() { echo "$*" >> "$LOG"; }
emit_gap() { echo "GAP $1" >> "$CALLS"; }
tracked_fail_names() { :; }; ensure_clone_deps() { return 0; }; ensure_clone_nested_deps() { CD_NESTED=""; return 0; }
host_contended() { HC_WHY=""; return 1; }
TP_ROW=""   # a shaped pull_sync.slow_test_globs row, when set (case f)
tuning_param() { if [ "$1" = pull_sync.slow_test_globs ] && [ -n "$TP_ROW" ]; then TP_VALUE="$TP_ROW"; else TP_VALUE="$2"; fi; }
mkdir -p "$T/bin"
# bun test [files...]: one argv line per run; with no files, every *.test.ts bun would find. Each file sleeps its "#cost"
# seconds and prints its path header and its "(pass)"/"(fail)" lines, then the totals.
cat > "$T/bin/bun" <<BUN
#!/usr/bin/env bash
[ "\$1" = test ] || exit 0; shift
echo "ARGV \$*" >> "$T/argv"
if [ \$# -eq 0 ]; then mapfile -t fs < <(find . \( -name node_modules -o -name '.?*' \) -prune -o -type f -name '*.test.ts' -print | LC_ALL=C sort); else fs=("\$@"); fi
p=0; f=0
for x in "\${fs[@]}"; do
  c="\$(sed -n 's/^#cost //p' "\$x")"; [ -n "\$c" ] && sleep "\$c"
  echo "\${x#./}:"
  while IFS= read -r l; do echo "\$l"; case "\$l" in '(pass)'*) p=\$((p+1)) ;; '(fail)'*) f=\$((f+1)) ;; esac; done < <(grep -E '^\((pass|fail)\)' "\$x")
done
echo " \$p pass"; echo " \$f fail"; [ "\$f" -eq 0 ]
BUN
chmod +x "$T/bin/bun"; BUN_BIN="$T/bin/bun"
GTR_NODE=node-a; CLONE_DIR="$T/clones"; MARKER_DIR="$T/marker"; TEST_BASELINE_DIR="$T/baseline"; LAST_GOOD_DIR="$T/lastgood"; TMPDIR="$T/tmp"
TEST_GATE_MAX_REFUSALS=3; PROTECTED_SCOPE_FILE="$T/scope.json"; echo '{"autonomyScope":{"excluded_paths":["repos/development-vessel/test/none.test.ts"]}}' > "$PROTECTED_SCOPE_FILE"
OLD='(fail) old > one'
g() { git -C "$d" -c user.name=t -c user.email=t@t "$@" >/dev/null 2>&1; }
scale() { unset GATE_BUDGET_SECONDS QUIESCE_MARGIN_S PROTECTED_TEST_TIMEOUT_SECONDS TEST_TIMEOUT_SECONDS; SUITE_WALL_FLOOR_S=3; UNIT_TIMEOUT_S=60; GATE_UNIT_MARGIN_S=2; TEST_KILL_GRACE_SECONDS=1; }
put() { local f="$1" c="$2"; shift 2; mkdir -p "$d/$(dirname "$f")"; { printf '#cost %s\n' "$c"; printf '%s\n' "$@"; } > "$d/$f"; }
setup() { # $1 vessel ; $2 cost scale (1 = the fixture's 14 s suite, 0 = instant)
  VESSEL="$1"; d="$CLONE_DIR/$VESSEL"; local k="$2"
  rm -rf "$T/clones" "$T/marker" "$T/baseline" "$T/lastgood" "$T/tmp" "$T/argv"; mkdir -p "$d/src" "$MARKER_DIR" "$TEST_BASELINE_DIR" "$LAST_GOOD_DIR" "$TMPDIR"
  echo 'export const x = 1;' > "$d/src/x.ts"
  put test/a.test.ts $((1 * k)) '(pass) a > works' "$OLD"
  put test/b.test.ts $((1 * k)) '(pass) b > works'
  put src/x.real.test.ts $((5 * k)) '(pass) real > boots' '(fail) real > known red'
  put src/y.scale.test.ts $((4 * k)) '(pass) scale > holds'
  put test/trace-list-bounded-newest-first.test.ts $((3 * k)) '(pass) bounded > newest first'
  mkdir -p "$d/node_modules/pk"; put node_modules/pk/n.test.ts 0 '(fail) never > discovered'
  printf 'node_modules\n' > "$d/.gitignore"
  git -C "$d" init -q -b dev; g add -A; g commit -m base; git -C "$d" rev-parse HEAD > "$LAST_GOOD_DIR/$VESSEL"
  echo 'export const x = 2;' > "$d/src/x.ts"; g add -A; g commit -m change
  printf '%s\n' "$OLD" > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "1 3 0" > "$TEST_BASELINE_DIR/$VESSEL"
  synced=0; failed=0; skipped=0; GEN_QUEUE=""
}
commit() { g add -A; g commit -m "${1:-next}"; }
# One tick: the gate slice, then (as the vessel loop does on a healthy mirror) last-good = HEAD, then the tick-end drain.
tick() {
  : > "$CALLS"; : > "$LOG"; : > "$T/argv"; SLOW_QUEUE=""; HEAD="$(git -C "$d" rev-parse HEAD)"; unset GATE_T0; PULLSYNC_T0=$(date +%s)
  run_gate 2>>"$LOG"
  converged && [ -z "${NO_MIRROR:-}" ] && echo "$HEAD" > "$LAST_GOOD_DIR/$VESSEL"
  GATE_ARGV="$(cat "$T/argv")"; : > "$T/argv"
  [ -n "${STARVE_TICK:-}" ] && PULLSYNC_T0=$(( $(date +%s) - UNIT_TIMEOUT_S + 5 ))
  while IFS='|' read -r sl_v sl_h sl_d sl_g; do [ -n "$sl_v" ] && slow_lane_run "$sl_v" "$sl_h" "$sl_d" "$sl_g"; done <<< "$SLOW_QUEUE"
  SLOW_ARGV="$(cat "$T/argv")"
}
converged() { grep -q "^CONVERGED $VESSEL" "$CALLS"; }
logs() { tr '\n' '|' < "$LOG" | cut -c1-600; }
SLOWRE='x\.real\.test\.ts|y\.scale\.test\.ts|trace-list-bounded-newest-first'
gap_open() { grep '^GAP ' "$CALLS" | sed 's/^GAP //' | jq -c 'select(.impulse.pointer.gap.id == "pull-sync-slow-lane-regression-'"$VESSEL"'")' 2>/dev/null; }

# (a) MUST-FAIL: the gate runs only the fast files, and a candidate whose whole suite exceeds the wall converges
scale; setup activity-api 1; tick
_runs="$(printf '%s\n' "$GATE_ARGV" | grep -c '^ARGV' || true)"
if [ "${_runs:-0}" -gt 0 ] && ! printf '%s\n' "$GATE_ARGV" | grep -qE "$SLOWRE" && [ "$(printf '%s\n' "$GATE_ARGV" | grep -vc '^ARGV \./test/a\.test\.ts \./test/b\.test\.ts$' || true)" -eq 0 ]; then
  ok "(a) all $_runs gate run(s) name only the fast files (./test/a.test.ts ./test/b.test.ts)"
else bad "(a) the gate's runs were not the fast set: $(printf '%s' "$GATE_ARGV" | tr '\n' '|')"; fi
converged && ok "(a) the candidate whose whole suite (14 s) exceeds the 13 s wall converges in one tick" || bad "(a) not converged (log: $(logs))"
grep -q 'slow lane: the gate runs 2 fast test file(s); 3 slow file(s)' "$LOG" && ok "(a) the split is logged" || bad "(a) no split logged (log: $(logs))"
grep -q 'per-run wall 13s' "$LOG" && ok "(a) the wall is the 13 s cap (no measurement yet)" || bad "(a) wall (log: $(grep 'per-run wall' "$LOG"))"
# (b) the slow lane runs once after convergence, naming only the slow files; first observation = baseline
[ "$(printf '%s\n' "$SLOW_ARGV" | grep -c '^ARGV' || true)" = 1 ] && printf '%s\n' "$SLOW_ARGV" | grep -qx 'ARGV \./src/x\.real\.test\.ts \./src/y\.scale\.test\.ts \./test/trace-list-bounded-newest-first\.test\.ts' \
  && ok "(b) the slow lane ran once, naming only the 3 slow files" || bad "(b) slow lane argv: $(printf '%s' "$SLOW_ARGV" | tr '\n' '|') (log: $(logs))"
[ "$(cat "$TEST_BASELINE_DIR/activity-api.slow-failnames" 2>/dev/null)" = '(fail) real > known red' ] && grep -q 'slow lane baseline recorded' "$LOG" && [ -z "$(gap_open)" ] \
  && ok "(b) its first observation records the slow baseline, no verdict, no gap" || bad "(b) slow baseline: $(cat "$TEST_BASELINE_DIR/activity-api.slow-failnames" 2>/dev/null) (log: $(logs))"
[ "$(cat "$TEST_BASELINE_DIR/activity-api.failnames")" = "$OLD" ] && ok "(b) the gate's baseline holds only fast-file names" || bad "(b) failnames: $(cat "$TEST_BASELINE_DIR/activity-api.failnames")"

# (c) CONTROL: a slow-file regression files a gap naming it, never blocks, is re-filed while it fails, closes when clean
put src/x.real.test.ts 5 '(fail) real > boots' '(fail) real > known red'; commit regress; tick; C1="$(git -C "$d" rev-parse HEAD)"
converged && ok "(c) a candidate that regresses a slow file still converges (the fast gate never saw it)" || bad "(c) not converged (log: $(logs))"
G="$(gap_open)"
if [ -n "$G" ] && [ "$(jq -r '.impulse.pointer.gap.status' <<<"$G")" = open ] && [ "$(jq -r '.impulse.pointer.gap.classification_metadata.vessel' <<<"$G")" = activity-api ] \
   && [ "$(jq -r '.impulse.pointer.gap.classification_metadata.candidate_sha' <<<"$G")" = "$C1" ] \
   && [ "$(jq -c '.impulse.pointer.gap.classification_metadata.files' <<<"$G")" = '["src/x.real.test.ts"]' ] \
   && [ "$(jq -c '.impulse.pointer.gap.classification_metadata.failing_tests' <<<"$G")" = '["(fail) real > boots"]' ] \
   && jq -r '.impulse.pointer.gap.summary' <<<"$G" | grep -q 'src/x.real.test.ts: (fail) real > boots'; then
  ok "(c) the slow-lane gap names the vessel, the candidate sha, the file and the newly failing test"
else bad "(c) gap: ${G:-none} (log: $(logs))"; fi
[ "$(cat "$TEST_BASELINE_DIR/activity-api.slow-failnames")" = '(fail) real > known red' ] && ok "(c) the new failing name is not absorbed into the slow baseline" || bad "(c) slow baseline: $(cat "$TEST_BASELINE_DIR/activity-api.slow-failnames")"
echo 'export const x = 3;' > "$d/src/x.ts"; commit other; tick
[ -n "$(gap_open)" ] && [ "$(gap_open | jq -r .impulse.pointer.gap.status)" = open ] && ok "(c) the next converged candidate re-files it while it still fails" || bad "(c) not re-filed (log: $(logs))"
put src/x.real.test.ts 5 '(pass) real > boots' '(pass) real > known red'; commit repair; tick
[ "$(gap_open | jq -r .impulse.pointer.gap.status)" = closed ] && [ ! -s "$TEST_BASELINE_DIR/activity-api.slow-failnames" ] \
  && ok "(c) a clean slow lane closes the gap; the names that pass leave the slow baseline" || bad "(c) after repair: $(gap_open) baseline: $(cat "$TEST_BASELINE_DIR/activity-api.slow-failnames") (log: $(logs))"

# (d) no slow lane for a candidate that did not converge, nor without the budget
put src/y.scale.test.ts 4 '(fail) scale > breaks'; commit r2; NO_MIRROR=1 tick; unset NO_MIRROR
[ -z "$SLOW_ARGV" ] && grep -q 'slow lane not run: .* passed its gate but did not converge this tick' "$LOG" && [ -z "$(gap_open)" ] \
  && ok "(d) a candidate that passed its gate but did not converge runs no slow lane" || bad "(d) argv: $SLOW_ARGV (log: $(logs))"
STARVE_TICK=1 tick; unset STARVE_TICK
[ -z "$SLOW_ARGV" ] && grep -q 'slow lane not run for .*: its 3 slow file(s) need up to 14s' "$LOG" && [ -z "$(gap_open)" ] && converged \
  && ok "(d) with too little of the tick left the slow lane is skipped and logged; convergence is unaffected" || bad "(d) starved: argv $SLOW_ARGV (log: $(logs))"

# (e) CONTROL: a vessel with no slow list runs exactly as before: plain `bun test`, no queue, no split
scale; setup boredom-vessel 0; printf '%s\n' "$OLD" '(fail) real > known red' | LC_ALL=C sort > "$TEST_BASELINE_DIR/$VESSEL.failnames"; echo "2 5 0" > "$TEST_BASELINE_DIR/$VESSEL"; tick
if converged && [ "$(printf '%s\n' "$GATE_ARGV" | grep -c '^ARGV' || true)" -gt 0 ] && [ -z "$(printf '%s\n' "$GATE_ARGV" | grep -v '^ARGV $' || true)" ]; then
  ok "(e) a vessel with no slow list runs plain \`bun test\` (no file arguments) and converges"
else bad "(e) argv: $(printf '%s' "$GATE_ARGV" | tr '\n' '|') (log: $(logs))"; fi
[ -z "$SLOW_QUEUE$SLOW_ARGV" ] && ! grep -q 'slow lane' "$LOG" && [ ! -e "$TEST_BASELINE_DIR/boredom-vessel.slow-failnames" ] \
  && ok "(e) it queues no slow lane and logs no split" || bad "(e) queue: $SLOW_QUEUE (log: $(logs))"
# activity-api with no slow file in its tree is not split either (the existing harnesses' fixtures)
scale; setup activity-api 0; rm -f "$d"/src/*.real.test.ts "$d"/src/*.scale.test.ts "$d"/test/trace-list-*; commit noslow; tick
converged && [ -z "$(printf '%s\n' "$GATE_ARGV" | grep -v '^ARGV $' || true)" ] && [ -z "$SLOW_ARGV" ] \
  && ok "(e) a declared list matching no file runs plain \`bun test\` and no slow lane" || bad "(e) argv: $(printf '%s' "$GATE_ARGV$SLOW_ARGV" | tr '\n' '|') (log: $(logs))"

# (f) a shaped row replaces the default, read through tuning_param's string mode; the numeric path is unchanged
scale; setup boredom-vessel 0; TP_ROW='activity-api=none;boredom-vessel=*.real*.test.ts'; tick; TP_ROW=""
printf '%s\n' "$GATE_ARGV" | grep -q '^ARGV ' && [ -z "$(printf '%s\n' "$GATE_ARGV" | grep -vx 'ARGV \./src/y\.scale\.test\.ts \./test/a\.test\.ts \./test/b\.test\.ts \./test/trace-list-bounded-newest-first\.test\.ts' || true)" ] \
  && printf '%s\n' "$SLOW_ARGV" | grep -qx 'ARGV \./src/x\.real\.test\.ts' && ok "(f) the row's boredom-vessel list splits it; the default's globs no longer apply" || bad "(f) argv: $(printf '%s' "$GATE_ARGV|$SLOW_ARGV" | tr '\n' '|')"
# shellcheck disable=SC1090
source "$T/tp.sh"; TP_FALLBACK_SEEN=" "; DEFERRAL_LOG="$T/deferrals.jsonl"; : > "$DEFERRAL_LOG"; ACTIVITY_API_ENDPOINT=http://127.0.0.1:9
CURL_BODY=""; curl() { printf '%s\n200' "$CURL_BODY"; }
CURL_BODY='{"name":"pull_sync.x","value":42}'; real_tuning_param pull_sync.x 7; n1="$TP_VALUE/$TP_WHY"
CURL_BODY='{"name":"pull_sync.x","value":null}'; real_tuning_param pull_sync.y 7; n2="$TP_VALUE/$TP_WHY"
CURL_BODY='{"name":"pull_sync.slow_test_globs","value":"a=*.real*.test.ts,b.test.ts"}'; real_tuning_param pull_sync.slow_test_globs 'd=x' string; s1="$TP_VALUE/$TP_WHY"
CURL_BODY='{"name":"pull_sync.slow_test_globs","value":null}'; real_tuning_param pull_sync.z 'd=*.real*.test.ts' string; s2="$TP_VALUE/$TP_WHY"
CURL_BODY='{"name":"pull_sync.slow_test_globs","value":12}'; real_tuning_param pull_sync.w 'd=x' string; s3="$TP_VALUE/$TP_WHY"
[ "$n1" = 42/ ] && [ "$n2" = 7/null ] && ok "(f) numeric reads are unchanged (42 read; null -> the default, reason null)" || bad "(f) numeric: $n1 $n2"
[ "$s1" = 'a=*.real*.test.ts,b.test.ts/' ] && [ "$s2" = 'd=*.real*.test.ts/null' ] && [ "$s3" = 'd=x/non_string' ] && ok "(f) the string mode reads a string row; null or a number falls back to the default" || bad "(f) string: $s1 $s2 $s3"
jq -e -s 'length == 3 and all(.[]; .action == "tuning_param_fallback") and (map(.default) == [7, "d=*.real*.test.ts", "d=x"])' "$DEFERRAL_LOG" >/dev/null 2>&1 \
  && ok "(f) every fallback record is valid JSON (a string default is quoted)" || bad "(f) deferral log: $(cat "$DEFERRAL_LOG")"
unset -f curl
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
