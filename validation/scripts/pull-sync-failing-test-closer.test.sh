#!/usr/bin/env bash
# pull-sync closes the failing-test gaps its generator opened (scripts/substrate/substrate-pull-sync.sh
# close_failing_test_gaps): nothing else writes their closed row, and records works an open detector gap as a request,
# so without this a fixed test stayed work forever. Runs the script's own functions with curl stubbed as discovery in
# front of an in-memory records store, and bun stubbed to print what each test file would.
#   (a) every name a gap checks passes alone: one closed detector row, and the open read no longer lists it;
#   (b) one name still fails alone: nothing written, the gap stays open;
#   (c) a run that printed no bun summary (crashed, timed out): nothing written;
#   (d) another vessel's gap, and a gap the generator did not file, are not run or touched;
#   (e) a test file missing from the checkout: nothing written;
#   (f) at most the cap it is given gaps are run per call;
#   (g) a gap behind ones that stay red is still run: four open, the first three red, the fourth green closes within two
#       calls at one HEAD, and on the first call at a new HEAD when HEAD moves every call;
#   (h) a test file two gaps check runs once per call;
#   (i) a gap naming a test the file no longer has (neither passed nor failed in the run) is marked not checkable:
#       one open detector row with check_runnable false, the absent names and the HEAD, written once per set of names;
#       and once the named test is there and passes, the gap closes as before;
#   (j) a run that broke before its tests (an import that throws: an error summary and no named line; a beforeAll that
#       throws: an "(unnamed)" failure) proves nothing absent: no row; nor a name the run omits whose test title the
#       file's source still holds;
#   (k) a gap marked not checkable whose names are back but red is written checkable again, once;
#   (l) a re-armed gap whose names go absent again is marked again (the once-guard is the current names_absent, not
#       "ever marked");
#   (m) the source check reads the test file the run ran, on disk: an untracked test file (build output, not at any git
#       ref) whose title is there is not marked.
#   (n) a gap a person ruled against (claim_rejected_by, check_runnable false) is never made checkable again by the
#       closer: ruled against, then absent, then back and red, it stays not checkable (one row clears the absent names,
#       keeps the ruling, never says it is worked again; then nothing more);
#   (o) the other order: marked absent, then a person ruled against it, then back and red: it stays not checkable;
#   (p) marked absent, then a person's r 1 released it (check_runnable dropped, names_absent kept) while the names are
#       still absent: it is marked again, once; back and red, it is checkable again (the r 1 path still re-arms);
#   (r) a run whose output is longer than an argument may be (MBs of output) is judged as any other: no "Argument list too
#       long", its named test passing alone closes the gap;
#   (s) a mark is written from the gap's whole latest row (its repo and claim kept): exactly one new row, and the repo
#       carry, run after it as each tick runs it, has nothing to add;
#   (q) a row the store does not take is said not written (no "marked" line for a mark that did not happen) and is
#       run again by the next run of the closer at the same HEAD (a re-gate; the closer runs only for a gated vessel):
#       a mark, and a close.
# Run it under the node's own jq as well: jq 1.6 refuses an object merged with "+" inside an object's key without
# parentheses, so a payload that builds here can be empty there.
# usage: validation/scripts/pull-sync-failing-test-closer.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve emit_gap emit_gap_checked jq_ao close_failing_test_gaps carry_gap_repo; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^close_failing_test_gaps()' "$T/fns.sh" && grep -q '^gap_resolve()' "$T/fns.sh" \
  || { echo "FAIL - could not extract close_failing_test_gaps and gap_resolve"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; WRITES="$T/writes.txt"
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY=""
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    record_read) jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS" ;;
    record_write)
      [ -n "${WFAIL:-}" ] && { printf '{}'; return 0; }
      local n row; n="$(jq length "$ROWS")"
      row="$(printf '%s' "$d" | jq -c --argjson n "$n" '.pointer as $p | $p.row + {id: ("row-" + ($n | tostring)), seq: ($n + 1), writer: $p.writer, role: $p.role}')"
      jq -c --argjson r "$row" '. + [$r]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
      echo "$row" >> "$WRITES"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
# The candidate's code runs as the generator runs it, minus the env scrub this test does not exercise.
scrubbed_env() { shift; "$@"; }
# bun prints, for `bun test ./<file>`, what <file>.out in the fake's directory holds; it records every file it ran.
FAKE="$T/fake"; mkdir -p "$FAKE"
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
f="$(basename "$2")"; echo "$f" >> "$(dirname "$0")/ran.txt"; cat "$(dirname "$0")/$f.out" 2>/dev/null
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
DIR="$T/checkout"; mkdir -p "$DIR/src"
export TEST_BASELINE_DIR="$T/baseline"; mkdir -p "$TEST_BASELINE_DIR"

row() { # gap_id vessel test_file filed_by names-json
  jq -cn --arg id "$1" --arg v "$2" --arg tf "$3" --arg by "$4" --argjson names "$5" \
    '{shape: "gap", gap_id: $id, status: "open", summary: "a test fails", writer: "pull-sync", role: "detector",
      meta: {filed_by: $by, evidence_resolve: {shape: "test_suite", input: {vessel: $v, test_file: $tf, only_tests: $names}}}}'
}
reset() { # rows...
  printf '%s\n' "$@" | jq -s -c 'to_entries | map(.value + {id: ("r" + (.key | tostring)), seq: (.key + 1)})' > "$ROWS"
  : > "$WRITES"; : > "$FAKE/ran.txt"; : > "$LOG"; rm -f "$TEST_BASELINE_DIR"/*.closer
}
GEN="pull-sync failing-test generator"
summary() { printf '%s\n' "$@"; printf ' %s pass\n 0 fail\n' "$#"; }
open_ids() { dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","status":"open","limit":50}}}' --max-time 5 | jq -c '[.body.gaps[].id]'; }

touch "$DIR/src/a.test.ts" "$DIR/src/b.test.ts"
reset "$(row g-a x src/a.test.ts "$GEN" '["d > one","d > two"]')"
summary "(pass) d > one" "(pass) d > two" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && [ "$(jq -r '.gap_id + "/" + .status + "/" + .role' "$WRITES")" = "g-a/closed/detector" ] && [ "$(open_ids)" = "[]" ]; then
  ok "(a) every named test passes alone: one closed detector row, and the gap is no longer open"
else bad "(a) writes=$(cat "$WRITES") open=$(open_ids) log=$(cat "$LOG")"; fi

reset "$(row g-a x src/a.test.ts "$GEN" '["d > one","d > two"]')"
printf '(pass) d > one\n(fail) d > two\n 1 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && [ "$(open_ids)" = '["g-a"]' ]; then ok "(b) a name still red alone: nothing written, the gap stays open"
else bad "(b) writes=$(cat "$WRITES")"; fi

printf 'error: could not load the file\n' > "$FAKE/a.test.ts.out"
reset "$(row g-a x src/a.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ]; then ok "(c) a run with no bun summary closes nothing"; else bad "(c) writes=$(cat "$WRITES")"; fi

summary "(pass) d > one" > "$FAKE/a.test.ts.out"
reset "$(row g-other y src/a.test.ts "$GEN" '["d > one"]')" "$(row g-hand x src/a.test.ts "operator" '["d > one"]')"
close_failing_test_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && [ ! -s "$FAKE/ran.txt" ]; then ok "(d) another vessel's gap and a gap the generator did not file are not run or touched"
else bad "(d) writes=$(cat "$WRITES") ran=$(cat "$FAKE/ran.txt")"; fi

reset "$(row g-gone x src/gone.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ]; then ok "(e) a test file missing from the checkout closes nothing"; else bad "(e) writes=$(cat "$WRITES")"; fi

summary "(pass) d > one" > "$FAKE/b.test.ts.out"
reset "$(row g-a x src/a.test.ts "$GEN" '["d > one"]')" "$(row g-b x src/b.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 0123456789abcdef "$DIR" 1
if [ "$(wc -l < "$FAKE/ran.txt")" = 1 ] && [ "$(wc -l < "$WRITES")" = 1 ]; then ok "(f) the cap it is given bounds the gaps run per call"
else bad "(f) ran=$(cat "$FAKE/ran.txt") writes=$(wc -l < "$WRITES")"; fi

touch "$DIR/src/c.test.ts" "$DIR/src/d.test.ts"
for f in a b c; do printf '(fail) d > one\n 0 pass\n 1 fail\n' > "$FAKE/$f.test.ts.out"; done
summary "(pass) d > one" > "$FAKE/d.test.ts.out"
four() { reset "$(row g-a x src/a.test.ts "$GEN" '["d > one"]')" "$(row g-b x src/b.test.ts "$GEN" '["d > one"]')" \
  "$(row g-c x src/c.test.ts "$GEN" '["d > one"]')" "$(row g-d x src/d.test.ts "$GEN" '["d > one"]')"; }
four
close_failing_test_gaps x 0123456789abcdef "$DIR"; close_failing_test_gaps x 0123456789abcdef "$DIR"
if [ "$(jq -r '.gap_id + "/" + .status' "$WRITES" 2>/dev/null)" = "g-d/closed" ] && [ "$(wc -l < "$FAKE/ran.txt")" = 4 ]; then
  ok "(g) one HEAD: three stay red, the fourth runs on the second call and closes; none of the red runs twice"
else bad "(g) one HEAD: writes=$(cat "$WRITES") ran=$(tr '\n' ' ' < "$FAKE/ran.txt")"; fi
four
close_failing_test_gaps x 1111111111aaaa "$DIR"; : > "$WRITES"
close_failing_test_gaps x 2222222222bbbb "$DIR"
if [ "$(jq -r '.gap_id + "/" + .status' "$WRITES" 2>/dev/null)" = "g-d/closed" ]; then
  ok "(g) HEAD moving every call: the gap never run goes first on the next call and closes"
else bad "(g) moving HEAD: writes=$(cat "$WRITES") ran=$(tr '\n' ' ' < "$FAKE/ran.txt")"; fi

summary "(pass) d > one" "(pass) d > two" > "$FAKE/a.test.ts.out"
reset "$(row g-1 x src/a.test.ts "$GEN" '["d > one"]')" "$(row g-2 x src/a.test.ts "$GEN" '["d > two"]')"
close_failing_test_gaps x 0123456789abcdef "$DIR"
if [ "$(wc -l < "$FAKE/ran.txt")" = 1 ] && [ "$(wc -l < "$WRITES")" = 2 ]; then ok "(h) a test file two gaps check runs once, and both close"
else bad "(h) ran=$(wc -l < "$FAKE/ran.txt") writes=$(wc -l < "$WRITES")"; fi

echo; # (i) the gap names "d > old", which the file no longer has: marked not checkable, once; then the test is back and passes
reset "$(row g-a x src/a.test.ts "$GEN" '["d > old"]')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"
L="$(tail -n 1 "$WRITES")"; n1="$(wc -l < "$WRITES")"
if [ "$n1" = 1 ] && printf '%s' "$L" | jq -e '.gap_id == "g-a" and .status == "open" and .role == "detector" and .check_runnable == false
    and .meta.check_runnable == false and .meta.names_absent == ["d > old"] and .meta.absent_at_head == "0123456789"
    and (.meta.evidence_resolve.input.only_tests == ["d > old"]) and (.summary | contains("Not checkable here"))' >/dev/null; then
  ok "(i) a named test the file no longer has: one open row, not checkable, naming it"
else bad "(i) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
: > "$WRITES"; close_failing_test_gaps x fedcba9876543210 "$DIR"
if [ ! -s "$WRITES" ]; then ok "(i) said once: a later run finding the same names absent writes nothing"
else bad "(i) again: writes=$(cat "$WRITES")"; fi
summary "(pass) d > old" > "$FAKE/a.test.ts.out"
: > "$WRITES"; close_failing_test_gaps x 1111111111111111 "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && [ "$(jq -r '.status' "$WRITES")" = closed ]; then ok "(i) the named test back and passing: the gap closes"
else bad "(i) back: writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (j) a broken run is red, not absent: the import throws (no named line, an error summary), the setup throws
# ("(unnamed)"), or the run omits a name whose test title the source still holds. Each on its own gap, each checked.
J=""
reset "$(row g-a x src/a.test.ts "$GEN" '["d > gone"]')"
printf '# Unhandled error between tests\n 0 pass\n 1 fail\n 1 error\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"; [ -s "$WRITES" ] && J="$J import:$(cat "$WRITES")"
reset "$(row g-a x src/a.test.ts "$GEN" '["d > gone"]')"
printf '(fail) d > (unnamed)\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"; [ -s "$WRITES" ] && J="$J setup:$(cat "$WRITES")"
printf 'test("kept", () => {});\n' > "$DIR/src/a.test.ts"
reset "$(row g-a x src/a.test.ts "$GEN" '["d > kept"]')"
summary "(pass) d > other" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"; [ -s "$WRITES" ] && J="$J source:$(cat "$WRITES")"
: > "$DIR/src/a.test.ts"
if [ -z "$J" ]; then ok "(j) a run broken before its tests, or a name the source still holds, is never marked absent"
else bad "(j)$J"; fi

# (k) marked not checkable, then the name is back and red: one checkable row, and nothing more after it
reset "$(row g-a x src/a.test.ts "$GEN" '["d > old"]')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"
printf '(fail) d > old\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
: > "$WRITES"; close_failing_test_gaps x 3333333333333333 "$DIR"
L="$(tail -n 1 "$WRITES")"; n1="$(wc -l < "$WRITES")"
: > "$WRITES"; close_failing_test_gaps x 4444444444444444 "$DIR"
if [ "$n1" = 1 ] && [ ! -s "$WRITES" ] && printf '%s' "$L" | jq -e '.status == "open" and .check_runnable == true and .meta.check_runnable == true
    and .meta.names_absent == null and (.summary | contains("checkable, and worked, again"))' >/dev/null; then
  ok "(k) names back but red: one checkable row, then left open as any red gap"
else bad "(k) n1=$n1 L=$L again=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (l) re-armed, then the name goes absent again: marked again, once
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
: > "$WRITES"; close_failing_test_gaps x 5555555555555555 "$DIR"
L="$(tail -n 1 "$WRITES")"; n1="$(wc -l < "$WRITES")"
: > "$WRITES"; close_failing_test_gaps x 6666666666666666 "$DIR"
if [ "$n1" = 1 ] && [ ! -s "$WRITES" ] && printf '%s' "$L" | jq -e '.check_runnable == false and .meta.names_absent == ["d > old"]
    and .meta.absent_at_head == "5555555555"' >/dev/null; then
  ok "(l) re-armed, then absent again: marked again, once"
else bad "(l) n1=$n1 L=$L again=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (m) an untracked test file in a git checkout (no ref holds it) whose title is on disk: no row
U="$T/untracked"; mkdir -p "$U/dist"; git init -q "$U"
printf 'test("forwards", () => {});\n' > "$U/dist/u.test.js"
reset "$(row g-u x dist/u.test.js "$GEN" '["d > forwards"]')"
summary "(pass) d > other" > "$FAKE/u.test.js.out"
close_failing_test_gaps x 0123456789abcdef "$U"
if [ ! -s "$WRITES" ]; then ok "(m) untracked test file holding the title on disk: not marked"
else bad "(m) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (n) a person ruled against the gap's claim: marked absent, then back and red, it stays not checkable (no true row)
reset "$(row g-p x src/a.test.ts "$GEN" '["d > old"]' | jq -c '.check_runnable = false | .meta.claim_rejected_by = "person-row" | .meta.check_runnable = false')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 7777777777777777 "$DIR"
printf '(fail) d > old\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
: > "$WRITES"; close_failing_test_gaps x 8888888888888888 "$DIR"
N1="$(wc -l < "$WRITES")"; NL="$(tail -n 1 "$WRITES")"
: > "$WRITES"; close_failing_test_gaps x 8888888888888889 "$DIR"
if [ "$N1" = 1 ] && [ ! -s "$WRITES" ] && grep -q 'a person ruled against its claim' "$LOG" \
    && printf '%s' "$NL" | jq -e '.check_runnable == false and .meta.check_runnable == false and .meta.claim_rejected_by == "person-row"
      and .meta.names_absent == null and .meta.absent_at_head == null and (.summary | contains("worked") | not)' >/dev/null; then
  ok "(n) a person-rejected gap, absent then back and red, stays not checkable"
else bad "(n) N1=$N1 NL=$NL again=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (o) marked absent, then ruled against by a person (lift_held_gaps keeps names_absent), then back and red: no true row
reset "$(row g-q x src/a.test.ts "$GEN" '["d > old"]' | jq -c '.check_runnable = false | .meta += {names_absent: ["d > old"], absent_at_head: "0123456789", claim_rejected_by: "person-row", check_runnable: false}')"
printf '(fail) d > old\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 9999999999999999 "$DIR"
O1="$(wc -l < "$WRITES")"; OL="$(tail -n 1 "$WRITES")"
: > "$WRITES"; close_failing_test_gaps x 999999999999999a "$DIR"
if [ "$O1" = 1 ] && [ ! -s "$WRITES" ] && grep -q 'a person ruled against its claim' "$LOG" \
    && printf '%s' "$OL" | jq -e '.check_runnable == false and .meta.claim_rejected_by == "person-row" and .meta.names_absent == null
      and .meta.absent_at_head == null and (.summary | contains("worked") | not)' >/dev/null; then ok "(o) absent, then a person's r 0, then back and red: stays not checkable"
else bad "(o) O1=$O1 OL=$OL again=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (p) marked absent, then a person's r 1 (localized_by; check_runnable dropped; names_absent kept), names still absent:
# marked again once; then back and red: checkable again
reset "$(row g-r x src/a.test.ts "$GEN" '["d > old"]' | jq -c '.meta += {names_absent: ["d > old"], absent_at_head: "0123456789", localized_by: "person-r1"}')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x aaaaaaaaaaaaaaaa "$DIR"
P1="$(wc -l < "$WRITES")"; PL="$(tail -n 1 "$WRITES")"
: > "$WRITES"; close_failing_test_gaps x bbbbbbbbbbbbbbbb "$DIR"; P2="$(wc -l < "$WRITES")"
printf '(fail) d > old\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
: > "$WRITES"; close_failing_test_gaps x cccccccccccccccc "$DIR"; PR="$(tail -n 1 "$WRITES")"
if [ "$P1" = 1 ] && [ "$P2" = 0 ] && printf '%s' "$PL" | jq -e '.check_runnable == false and .meta.localized_by == "person-r1"' >/dev/null \
    && printf '%s' "$PR" | jq -e '.check_runnable == true and .meta.names_absent == null' >/dev/null; then
  ok "(p) absent, then a person's r 1 while still absent: marked again once; back and red: checkable again"
else bad "(p) P1=$P1 P2=$P2 PL=$PL PR=$PR log=$(cat "$LOG")"; fi

# (q) the store does not take the not-checkable row: no row, and the log says so instead of "marked"
reset "$(row g-s x src/a.test.ts "$GEN" '["d > old"]')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
WFAIL=1 close_failing_test_gaps x dddddddddddddddd "$DIR"
if [ ! -s "$WRITES" ] && grep -q 'the not-checkable row was NOT written' "$LOG" && ! grep -q 'marked not checkable' "$LOG"; then
  ok "(q) a mark the store did not take is said not written"
else bad "(q) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
# ... and is run again by the next run of the closer at the same HEAD (a re-gate), which marks it
: > "$LOG"; close_failing_test_gaps x dddddddddddddddd "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && jq -e '.check_runnable == false and .meta.names_absent == ["d > old"]' "$WRITES" >/dev/null && grep -q 'marked not checkable' "$LOG"; then
  ok "(q) the next run of the closer at the same HEAD (a re-gate) runs it again and marks it"
else bad "(q) retry: writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
# a close the store did not take is run again too
reset "$(row g-c x src/a.test.ts "$GEN" '["d > a"]')"
summary "(pass) d > a" > "$FAKE/a.test.ts.out"
WFAIL=1 close_failing_test_gaps x eeeeeeeeeeeeeeee "$DIR"
C1="$(wc -l < "$WRITES")"; grep -q 'the closed row was NOT written' "$LOG"; CL=$?
: > "$LOG"; close_failing_test_gaps x eeeeeeeeeeeeeeee "$DIR"
if [ "$C1" = 0 ] && [ "$CL" = 0 ] && [ "$(jq -r .status "$WRITES")" = closed ] && ! grep -q 'NOT written' "$LOG"; then
  ok "(q) a close the store did not take is said not written and run again at the same HEAD (a re-gate)"
else bad "(q) close: C1=$C1 CL=$CL writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (r) a run output past the kernel's argument size is read as any other: the named test passes alone, the gap closes
reset "$(row g-big x src/a.test.ts "$GEN" '["d > a"]')"
{ head -c 3000000 /dev/zero | tr '\0' 'x' | fold -w 200; printf '\n(pass) d > a\n 1 pass\n 0 fail\n'; } > "$FAKE/a.test.ts.out"
close_failing_test_gaps x ffffffffffffffff "$DIR" 2> "$T/r.err"
if [ "$(jq -r 'select(.gap_id == "g-big") | .status' "$WRITES" 2>/dev/null | tail -1)" = closed ] && ! grep -q 'Argument list too long' "$T/r.err" "$LOG"; then
  ok "(r) a run output past the argument size is judged: the gap closes"
else bad "(r) writes=$(head -c 300 "$WRITES") err=$(head -c 300 "$T/r.err") log=$(head -c 300 "$LOG")"; fi

# (s) the mark keeps every field of the gap's latest row: one row, and the repo carry after it writes nothing
reset "$(row g-repo x src/a.test.ts "$GEN" '["d > old"]' | jq -c '. + {repo: "x", claim: "The test is right: ..."}')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 1212121212121212 "$DIR"
S1="$(wc -l < "$WRITES")"; SL="$(tail -n 1 "$WRITES")"
carry_gap_repo
if [ "$S1" = 1 ] && [ "$(wc -l < "$WRITES")" = 1 ] && printf '%s' "$SL" | jq -e '.check_runnable == false and .repo == "x" and (.claim | startswith("The test is right"))' >/dev/null; then
  ok "(s) the mark keeps the gap's repo and claim: one row, and the repo carry adds none"
else bad "(s) S1=$S1 after-carry=$(wc -l < "$WRITES") SL=$SL log=$(cat "$LOG")"; fi

[ "$FAILS" = 0 ] && { echo "PASS - pull-sync closes a generator gap once its named tests pass alone, and only then"; exit 0; }
echo "$FAILS FAILED"; exit 1
