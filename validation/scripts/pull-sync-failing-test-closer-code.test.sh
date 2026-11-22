#!/usr/bin/env bash
# A change to the failing-test closer judges every open generator gap again, as a new HEAD does
# (scripts/substrate/substrate-pull-sync.sh close_failing_test_gaps, close_failing_test_gaps_each). The closer runs only
# for a vessel the gate just tested, so a fix to the closer itself reached no open gap until that vessel's code moved for
# an unrelated reason. Runs the script's own functions with curl stubbed as discovery in front of an in-memory records
# store, and bun stubbed to print what each test file would.
#   (a) [MUST-FAIL] the closer changed, HEAD unmoved: the every-tick pass runs the gap's own check once, against the
#       vessel's clone, and the next tick runs nothing;
#   (b) [GUARD] the closer unchanged, HEAD unmoved: neither the closer nor the every-tick pass runs anything;
#   (c) [GUARD] HEAD moved: the closer runs the gap as before;
#   (d) [MUST-FAIL] more due gaps than the cap: the pass takes the cap, takes the rest on the next tick, then stays
#       quiet;
#   (e) [MUST-FAIL] a vessel with no clone is skipped (nothing run, written or said for it), and the others are still
#       run;
#   (f) [MUST-FAIL] a pass the tick's deadline cut short leaves its gaps due: the next tick runs them;
#   (g) [MUST-FAIL] the tick calls the pass at top level, after the gate's queue, so it runs with no gate run; its own
#       lines, run with the pass stubbed, call it under a deadline inside the unit's budget, and not once that is spent;
#   (h) [MUST-FAIL] a gap filed at a HEAD the closer already ran, with the closer unchanged, is run by the next pass
#       once, and then not again.
#   (j) [MUST-FAIL] a clone whose HEAD is ahead of origin/$BRANCH is not judged by the pass, and the tick says so; once
#       its HEAD is on origin, it is.
#   (k) [MUST-FAIL] a gap whose test file is not tracked, once judged at a HEAD by this closer, is not judged again on
#       the next pass (its record keeps the closer's code too).
# usage: validation/scripts/pull-sync-failing-test-closer-code.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "${T:?}"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
for f in shape_route gap_resolve dev_resolve emit_gap emit_gap_checked jq_ao closer_code close_failing_test_gaps \
         close_failing_test_gaps_each; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; sed -n "/^$f() { .*}$/p" "$SCRIPT"; done > "$T/fns.sh"
grep -q '^close_failing_test_gaps()' "$T/fns.sh" || { echo "FAIL - could not extract close_failing_test_gaps"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; WRITES="$T/writes.txt"; READS="$T/reads.txt"
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY=""
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    record_read) echo read >> "$READS"; jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS" ;;
    record_write)
      local n row; n="$(jq length "$ROWS")"
      row="$(printf '%s' "$d" | jq -c --argjson n "$n" '.pointer as $p | $p.row + {id: ("row-" + ($n | tostring)), seq: ($n + 1), writer: $p.writer, role: $p.role}')"
      jq -c --argjson r "$row" '. + [$r]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
      echo "$row" >> "$WRITES"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
declare -F close_failing_test_gaps_each >/dev/null || close_failing_test_gaps_each() { echo "close_failing_test_gaps_each is not defined" >> "$LOG"; return 0; }
scrubbed_env() { shift; "$@"; }
FAKE="$T/fake"; mkdir -p "$FAKE"
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
f="$(basename "$2")"; echo "$f" >> "$(dirname "$0")/ran.txt"; cat "$(dirname "$0")/$f.out" 2>/dev/null
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
CL="$T/clones"; DIR="$CL/x"; mkdir -p "$DIR/src"; git init -q "$DIR"
for i in 1 2 3 4; do touch "$DIR/src/t$i.test.ts"; printf '(fail) d > one\n 0 pass\n 1 fail\n' > "$FAKE/t$i.test.ts.out"; done
git -C "$DIR" add -A; git -C "$DIR" -c user.name=t -c user.email=t@example.invalid commit -q -m one
H1="$(git -C "$DIR" rev-parse HEAD)"
BRANCH=dev; onorigin() { git -C "$DIR" update-ref "refs/remotes/origin/$BRANCH" HEAD; }; onorigin
export TEST_BASELINE_DIR="$T/baseline"; mkdir -p "$TEST_BASELINE_DIR"
GEN="pull-sync failing-test generator"
row() { # gap_id vessel test_file
  jq -cn --arg id "$1" --arg v "$2" --arg tf "$3" --arg by "$GEN" \
    '{shape: "gap", gap_id: $id, status: "open", summary: "a test fails", writer: "pull-sync", role: "detector",
      meta: {filed_by: $by, evidence_resolve: {shape: "test_suite", input: {vessel: $v, test_file: $tf, only_tests: ["d > one"]}}}}'
}
rows() { printf '%s\n' "$@" | jq -s -c 'to_entries | map(.value + {id: ("r" + (.key | tostring)), seq: (.key + 1)})' > "$ROWS"; }
tick() { : > "$FAKE/ran.txt"; : > "$READS"; }
ran() { sort "$FAKE/ran.txt" | tr '\n' ' ' | sed 's/ $//'; }
# A closer that differs from the running one only in a line that does nothing: its code is new, its judgement is not.
change_closer() { eval "$(declare -f close_failing_test_gaps | sed "0,/closer_code)\"/s//closer_code)\"; : changed-$1/")"; }
ORIG_CODE="$(closer_code)"
ORIG="$(declare -f close_failing_test_gaps)"

# The harness changes the closer by a line that does nothing; check that the change reaches its code.
if declare -F closer_code >/dev/null; then
  change_closer probe; [ "$(closer_code)" != "$ORIG_CODE" ] || { echo "FAIL - the harness could not change the closer"; exit 1; }
  eval "$ORIG"
fi
# The gate's run at H1: the gap is judged (red) and remembered with this HEAD and this closer's code.
rows "$(row g-1 x src/t1.test.ts)"
tick; close_failing_test_gaps x "$H1" "$DIR"; close_failing_test_gaps_each "$CL"
[ "$(ran)" = "t1.test.ts" ] || bad "setup: the gate's run did not run t1 (ran: $(ran))"

# (a)
change_closer a
tick; close_failing_test_gaps_each "$CL"; first="$(ran)"
tick; close_failing_test_gaps_each "$CL"; second="$(ran)"
if [ "$first" = "t1.test.ts" ] && [ -z "$second" ]; then
  ok "(a) the closer changed at an unmoved HEAD: the pass ran the gap's check once, and the next tick ran nothing"
else bad "(a) first=[$first] second=[$second] log=$(tail -3 "$LOG")"; fi

# (b)
tick; close_failing_test_gaps x "$H1" "$DIR"; close_failing_test_gaps_each "$CL"
[ -z "$(ran)" ] && ok "(b) an unchanged closer at an unmoved HEAD runs nothing" || bad "(b) ran=[$(ran)]"
tick; close_failing_test_gaps_each "$CL"
[ -z "$(ran)" ] && ok "(b) the pass alone runs nothing while every gap was run at this HEAD by this closer" || bad "(b) the pass ran [$(ran)]"

# (c)
echo x >> "$DIR/src/t1.test.ts"; git -C "$DIR" -c user.name=t -c user.email=t@example.invalid commit -qam two
H2="$(git -C "$DIR" rev-parse HEAD)"; onorigin
tick; close_failing_test_gaps x "$H2" "$DIR"
[ "$(ran)" = "t1.test.ts" ] && ok "(c) HEAD moved: the closer runs the gap as before" || bad "(c) ran=[$(ran)]"

# (d)
rows "$(row g-1 x src/t1.test.ts)" "$(row g-2 x src/t2.test.ts)" "$(row g-3 x src/t3.test.ts)" "$(row g-4 x src/t4.test.ts)"
tick; close_failing_test_gaps x "$H2" "$DIR"; close_failing_test_gaps x "$H2" "$DIR"
change_closer d
tick; close_failing_test_gaps_each "$CL"; n1="$(wc -l < "$FAKE/ran.txt")"
tick; close_failing_test_gaps_each "$CL"; n2="$(wc -l < "$FAKE/ran.txt")"
tick; close_failing_test_gaps_each "$CL"; n3="$(wc -l < "$FAKE/ran.txt")"
if [ "$n1" = 3 ] && [ "$n2" = 1 ] && [ "$n3" = 0 ]; then
  ok "(d) four due past a cap of three: three, then the fourth, then nothing"
else bad "(d) ran per tick: $n1 $n2 $n3"; fi

# (e)
rows "$(row g-1 x src/t1.test.ts)" "$(row g-9 gone src/t1.test.ts)"
change_closer e
tick; : > "$WRITES"; : > "$LOG"; close_failing_test_gaps_each "$CL"; e1="$(ran)"; esaid="$(grep -c '^gone:' "$LOG")"
tick; close_failing_test_gaps_each "$CL"
if [ "$e1" = "t1.test.ts" ] && [ -z "$(ran)" ] && ! grep -q '"g-9"' "$WRITES" && [ "$esaid" = 0 ]; then ok "(e) a vessel with no clone is skipped, unsaid (it is not a clone off origin); the others run, then the pass is quiet"
else bad "(e) first=[$e1] then=[$(ran)] said-for-gone=$esaid writes=$(cat "$WRITES")"; fi

# (f)
change_closer f
tick; FAILTEST_GEN_DEADLINE=$(( $(date +%s) + 100 )) close_failing_test_gaps_each "$CL"; f1="$(ran)"
tick; close_failing_test_gaps_each "$CL"; f2="$(ran)"
if [ -z "$f1" ] && [ "$f2" = "t1.test.ts" ]; then ok "(f) a pass the deadline cut short leaves its gaps due; the next tick runs them"
else bad "(f) cut=[$f1] next=[$f2]"; fi

# (g)
q="$(grep -nE '^done <<< "\$GEN_QUEUE"$' "$SCRIPT" | head -1 | cut -d: -f1)"
c="$(grep -nE '^if .*close_failing_test_gaps_each "\$CLONE_DIR"' "$SCRIPT" | head -1 | cut -d: -f1)"
if [ -n "$q" ] && [ -n "$c" ] && [ "$c" -gt "$q" ]; then ok "(g) the tick calls the pass after the gate's queue, with no gate run needed"
else bad "(g) queue end line [$q], pass call line [$c]"; fi
# The tick's own lines for the pass, run as the tick runs them, with the pass stubbed: it is called, under a deadline
# inside the unit's budget; with the budget spent it is not called.
sed -n '/^# A changed closer, over every/,/close_failing_test_gaps_each "\$CLONE_DIR".*fi$/p' "$SCRIPT" > "$T/tail.sh"
tailrun() { ( close_failing_test_gaps_each() { echo "called ${FAILTEST_GEN_DEADLINE:-none}" > "$T/tail.out"; }
  CLONE_DIR="$CL" UNIT_TIMEOUT_S=3600 FAILTEST_GEN_MARGIN_S=240 PULLSYNC_T0="$1"; unset FAILTEST_GEN_DEADLINE
  # shellcheck disable=SC1091
  source "$T/tail.sh" ); }
now="$(date +%s)"; : > "$T/tail.out"; tailrun "$now"; g1="$(cat "$T/tail.out")"
: > "$T/tail.out"; tailrun $(( now - 3500 )); g2="$(cat "$T/tail.out")"
gd="${g1#called }"
if [ "$(grep -c . "$T/tail.sh")" -ge 2 ] && [[ "$gd" =~ ^[0-9]+$ ]] && [ "$gd" -gt "$now" ] && [ "$gd" -le $(( now + 3600 - 240 + 5 )) ] && [ -z "$g2" ]; then
  ok "(g) the tick's lines call the pass under a deadline inside the unit's budget, and not once the budget is spent"
else bad "(g) tick lines=$(grep -c . "$T/tail.sh") called=[$g1] spent=[$g2]"; fi

# (h)
rows "$(row g-1 x src/t1.test.ts)"
tick; close_failing_test_gaps_each "$CL"; close_failing_test_gaps_each "$CL"
rows "$(row g-1 x src/t1.test.ts)" "$(row g-5 x src/t2.test.ts)"
tick; close_failing_test_gaps_each "$CL"; h1="$(ran)"
tick; close_failing_test_gaps_each "$CL"; h2="$(ran)"
if [ "$h1" = "t2.test.ts" ] && [ -z "$h2" ]; then ok "(h) a gap filed at a HEAD already run, closer unchanged: run by the next pass once, then not again"
else bad "(h) first=[$h1] then=[$h2]"; fi

# (j)
echo y >> "$DIR/src/t1.test.ts"; git -C "$DIR" -c user.name=t -c user.email=t@example.invalid commit -qam three
change_closer j
tick; : > "$LOG"; close_failing_test_gaps_each "$CL"; j1="$(ran)"; jsaid="$(grep -c 'is not on origin' "$LOG")"
onorigin; tick; close_failing_test_gaps_each "$CL"; j2="$(ran)"
if [ -z "$j1" ] && [ "$jsaid" = 1 ] && [ -n "$j2" ]; then ok "(j) a clone ahead of origin is not judged, and says so; once on origin it is"
else bad "(j) ahead=[$j1] said=$jsaid on-origin=[$j2]"; fi

# (k)
rows "$(row g-u x src/u.test.ts)"
tick; close_failing_test_gaps_each "$CL"; k1="$(jq -c '."g-u" // empty' "$TEST_BASELINE_DIR/x.closer")"
tick; close_failing_test_gaps_each "$CL"; k2="$(jq -c '."g-u" // empty' "$TEST_BASELINE_DIR/x.closer")"
if [ -n "$k1" ] && [ "$k1" = "$k2" ]; then ok "(k) a gap whose test file is not tracked, once judged at this HEAD by this closer, is not judged again"
else bad "(k) first=[$k1] then=[$k2]"; fi

eval "$ORIG"
[ "$FAILS" = 0 ] && echo "all passed" || { echo "$FAILS failed"; exit 1; }
