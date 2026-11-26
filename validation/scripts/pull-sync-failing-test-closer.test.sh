#!/usr/bin/env bash
# pull-sync closes the failing-test gaps its generator opened (scripts/substrate/substrate-pull-sync.sh
# close_failing_test_gaps): nothing else writes their closed row, and records works an open detector gap as a request,
# so without this a fixed test stayed work forever. Runs the script's own functions with curl stubbed as discovery in
# front of an in-memory records store, and bun stubbed to print what each test file would.
#   (a) every name a gap checks passes alone: one closed detector row, and the open read no longer lists it;
#   (b) one name still fails alone: the gap stays open, and its one new row says what the run found;
#   (c) a run that printed no bun summary (crashed, timed out): nothing written;
#   (d) another vessel's gap, and a gap the generator did not file, are not run or touched;
#   (e) a test file missing from the checkout and not tracked (removed): marked not checkable, never closed;
#   (f) at most the cap it is given gaps are run per call;
#   (g) a gap behind ones that stay red is still run: four open, the first three red, the fourth green closes within two
#       calls at one HEAD, and on the first call at a new HEAD when HEAD moves every call;
#   (h) a test file two gaps check runs once per call;
#   (i) a gap naming a test the file no longer has (neither passed nor failed in the run) is marked not checkable:
#       one open detector row with check_runnable false, the absent names and the HEAD, written once per set of names;
#       and once the named test is there and passes, the gap closes as before;
#   (j) a run that broke before its tests (an import that throws: an error summary and no named line; a beforeAll that
#       throws: an "(unnamed)" failure) proves nothing absent: no mark; nor a name the run omits whose test title the
#       file's source still holds;
#   (k) a gap marked not checkable whose names are back but red is written checkable again, once;
#   (l) a re-armed gap whose names go absent again is marked again (the once-guard is the current names_absent, not
#       "ever marked");
#   (m) an untracked test file (build output, not at any git ref) is marked not checkable whatever its source holds: it
#       checks nothing the repository holds (pull-sync-failing-test-untracked.test.sh).
#   (n) a gap a person ruled against (claim_rejected_by, check_runnable false) is never made checkable again by the
#       closer: ruled against, then absent, then back and red, it stays not checkable (one row clears the absent names,
#       keeps the ruling, never says it is worked again; then nothing more);
#   (o) the other order: marked absent, then a person ruled against it, then back and red: it stays not checkable;
#   (p) marked absent, then a person's r 1 released it (check_runnable dropped, names_absent kept) while the names are
#       still absent: it is marked again, once; back and red, it is checkable again (the r 1 path still re-arms);
#   (r) a run whose output is longer than an argument may be (MBs of output) is judged as any other: no "Argument list too
#       long", its named test passing alone closes the gap;
#   (s) a mark is written from the gap's whole latest row (its repo kept): exactly one new row, and the repo carry, run
#       after it as each tick runs it, has nothing to add; but not its claim: a gap whose check cannot run is not held for a
#       person's word (a release would set the walk on a gap whose tests are absent);
#   (t) the person-ruled keep (absent, ruled against, back and red) writes no claim either: one row, no claim;
#   (u) a gap with a claim, marked absent, then back and red: the re-arm starts from the mark's row, so the claim the mark
#       ended does not come back;
#   (v) a held gap (operator_hold) is marked with its hold kept: the mark ends a claim, never a hold;
#   (w) every verdict line carries what it was judged on: the checkout and its sha, the alone run's exit code (124 when
#       the bound cut it), the count lines, and each named test, by its whole line, as pass, fail (with its matcher
#       line and what the assertion got, each bounded) or absent, and whether the checkout has node_modules; an
#       untracked file's line says nothing was run;
#   (x) the evidence goes on the gap's row: a red verdict writes one row with it (a failing expect's matcher line and
#       its expected and received, never its source line; holds kept, claim dropped), the same found again at the same
#       sha writes nothing, the same found at a new sha writes a row with that sha (a landing that left it red is followed
#       by a red verdict, which records' fold reads as the gap's last red), a new received writes again, and a refused
#       row is written on the next call; the close, the absent mark
#       and the re-arms carry it; the row's metadata stays within gap_resolve's 4096 with evidence_resolve whole (at
#       most 8 names, matcher lines cut at 160, past the bound the matcher lines dropped before what the assertions
#       got), and metadata already at the bound takes none; the evidence on a row is its own run's, never an earlier
#       one's: [MUST-FAIL] a row near the bound that held an earlier run's evidence is marked absent without it,
#       [MUST-FAIL] where only the run's sha, exit and counts fit the row carries those (names_dropped), and
#       [MUST-FAIL] records' closerRed reads that row as red;
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
  for f in shape_route gap_resolve dev_resolve emit_gap emit_gap_checked jq_ao test_tracked closer_evidence closer_fit closer_code close_failing_test_gaps carry_gap_repo; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^close_failing_test_gaps()' "$T/fns.sh" && grep -q '^gap_resolve()' "$T/fns.sh" \
  || { echo "FAIL - could not extract close_failing_test_gaps and gap_resolve"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; WRITES="$T/writes.txt"; ALLW="$T/all-writes.txt"
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
      echo "$row" >> "$WRITES"; echo "$row" >> "$ALLW"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
# The checkout tracks every file a leg puts in it (git add before each call), as a gated vessel's checkout tracks its
# tests; a leg that wants a file untracked uses another directory.
eval "orig_$(declare -f close_failing_test_gaps)"
close_failing_test_gaps() { [ "${3:-}" = "$DIR" ] && git -C "$DIR" add -A; orig_close_failing_test_gaps "$@"; }
# The candidate's code runs as the generator runs it, minus the env scrub this test does not exercise.
scrubbed_env() { shift; "$@"; }
# bun prints, for `bun test ./<file>`, what <file>.out in the fake's directory holds; it records every file it ran.
FAKE="$T/fake"; mkdir -p "$FAKE"
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
f="$(basename "$2")"; echo "$f" >> "$(dirname "$0")/ran.txt"; cat "$(dirname "$0")/$f.out" 2>/dev/null
exit "$(cat "$(dirname "$0")/$f.rc" 2>/dev/null || echo 0)"
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
DIR="$T/checkout"; mkdir -p "$DIR/src"; git init -q "$DIR"
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
if [ "$(wc -l < "$WRITES")" = 1 ] && [ "$(jq -r '.status + "/" + (.meta.closer_evidence.names | map(.result) | join(","))' "$WRITES")" = "open/pass,fail" ] \
  && [ "$(open_ids)" = '["g-a"]' ]; then ok "(b) a name still red alone: the gap stays open, its one new row says what the run found"
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
if [ "$(wc -l < "$WRITES")" = 1 ] && jq -e '.status == "open" and .check_runnable == false' "$WRITES" >/dev/null; then ok "(e) a test file removed from the checkout closes nothing: marked not checkable"
else bad "(e) writes=$(cat "$WRITES")"; fi

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
if [ "$(jq -r 'select(.status == "closed") | .gap_id' "$WRITES" 2>/dev/null)" = "g-d" ] && [ "$(jq -r 'select(.status == "open") | .gap_id' "$WRITES" | sort | tr '\n' ' ')" = "g-a g-b g-c " ] \
  && [ "$(wc -l < "$FAKE/ran.txt")" = 4 ]; then
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
    and (.meta.evidence_resolve.input.only_tests == ["d > old"]) and (.summary | contains("Not checkable here"))
    and .waits_for == null' >/dev/null; then
  ok "[MUST-FAIL] (i) a named test the file no longer has: one open row, not checkable, naming it, waiting for no one"
else bad "(i) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
: > "$WRITES"; close_failing_test_gaps x fedcba9876543210 "$DIR"
if [ ! -s "$WRITES" ]; then ok "(i) said once: a later run finding the same names absent writes nothing"
else bad "(i) again: writes=$(cat "$WRITES")"; fi
summary "(pass) d > old" > "$FAKE/a.test.ts.out"
: > "$WRITES"; close_failing_test_gaps x 1111111111111111 "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && [ "$(jq -r '.status' "$WRITES")" = closed ]; then ok "(i) the named test back and passing: the gap closes"
else bad "(i) back: writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (i2) a not-checkable mark that still says it waits for a person is written once more without it, then never again
reset "$(row g-a x src/a.test.ts "$GEN" '["d > old"]')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"
jq -c 'map(if .shape == "gap" then . + {waits_for: "person"} else . end)' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
: > "$WRITES"; close_failing_test_gaps x fedcba9876543210 "$DIR"; m1="$(wc -l < "$WRITES")"; mwf="$(tail -n 1 "$WRITES" | jq -r '.waits_for // "none"')"
: > "$WRITES"; close_failing_test_gaps x fedcba9876543211 "$DIR"; m2="$(wc -l < "$WRITES")"
if [ "$m1" = 1 ] && [ "$mwf" = none ] && [ "$m2" = 0 ]; then ok "[MUST-FAIL] (i2) a mark that says it waits for a person is written once without it, then not again"
else bad "(i2) m1=$m1 wf=$mwf m2=$m2 log=$(cat "$LOG")"; fi

# (j) a broken run is red, not absent: the import throws (no named line, an error summary), the setup throws
# ("(unnamed)"), or the run omits a name whose test title the source still holds. Each on its own gap, each checked.
J=""
marked() { jq -e -s 'any(.[]; .meta.check_runnable == false or .meta.names_absent != null)' "$WRITES" >/dev/null; }
reset "$(row g-a x src/a.test.ts "$GEN" '["d > gone"]')"
printf '# Unhandled error between tests\n 0 pass\n 1 fail\n 1 error\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"; marked && J="$J import:$(cat "$WRITES")"
reset "$(row g-a x src/a.test.ts "$GEN" '["d > gone"]')"
printf '(fail) d > (unnamed)\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"; marked && J="$J setup:$(cat "$WRITES")"
printf 'test("kept", () => {});\n' > "$DIR/src/a.test.ts"
reset "$(row g-a x src/a.test.ts "$GEN" '["d > kept"]')"
summary "(pass) d > other" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 0123456789abcdef "$DIR"; marked && J="$J source:$(cat "$WRITES")"
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
    and .meta.names_absent == null and (.summary | contains("checkable, and worked, again")) and (has("waits_for") | not)' >/dev/null; then
  ok "(k) names back but red: one checkable row, no longer waiting for a person, then left open as any red gap"
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
if [ "$(wc -l < "$WRITES")" = 1 ] && jq -e '.check_runnable == false and (.summary | contains("not tracked"))' "$WRITES" >/dev/null && [ ! -s "$FAKE/ran.txt" ]; then
  ok "(m) untracked test file holding the title on disk: marked not checkable as not tracked, and not run"
else bad "(m) writes=$(cat "$WRITES") ran=$(cat "$FAKE/ran.txt") log=$(cat "$LOG")"; fi

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
# (a row from before no gap waited on a person: it says waits_for person, and the row this branch writes says null)
reset "$(row g-q x src/a.test.ts "$GEN" '["d > old"]' | jq -c '.check_runnable = false | .waits_for = "person" | .meta += {names_absent: ["d > old"], absent_at_head: "0123456789", claim_rejected_by: "person-row", check_runnable: false}')"
printf '(fail) d > old\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 9999999999999999 "$DIR"
O1="$(wc -l < "$WRITES")"; OL="$(tail -n 1 "$WRITES")"
: > "$WRITES"; close_failing_test_gaps x 999999999999999a "$DIR"
if [ "$O1" = 1 ] && [ ! -s "$WRITES" ] && grep -q 'a person ruled against its claim' "$LOG" \
    && printf '%s' "$OL" | jq -e '.check_runnable == false and .meta.claim_rejected_by == "person-row" and .meta.names_absent == null
      and .meta.absent_at_head == null and (.summary | contains("worked") | not) and has("waits_for") and .waits_for == null' >/dev/null; then
  ok "[MUST-FAIL] (o) absent, then a person's r 0, then back and red: stays not checkable, and its row waits on no one"
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
if [ "$S1" = 1 ] && [ "$(wc -l < "$WRITES")" = 1 ] && printf '%s' "$SL" | jq -e '.check_runnable == false and .repo == "x" and (has("claim") | not)' >/dev/null; then
  ok "(s) the mark keeps the gap's repo, not its claim: one row, and the repo carry adds none"
else bad "(s) S1=$S1 after-carry=$(wc -l < "$WRITES") SL=$SL log=$(cat "$LOG")"; fi

# (t) the person-ruled keep branch writes no claim
reset "$(row g-t x src/a.test.ts "$GEN" '["d > old"]' | jq -c '. + {repo: "x", claim: "The test is right: ..."} | .check_runnable = false | .meta += {names_absent: ["d > old"], absent_at_head: "0123456789", claim_rejected_by: "person-row", check_runnable: false}')"
printf '(fail) d > old\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 1313131313131313 "$DIR"
T1="$(wc -l < "$WRITES")"; TL="$(tail -n 1 "$WRITES")"; carry_gap_repo
if [ "$T1" = 1 ] && [ "$(wc -l < "$WRITES")" = 1 ] && printf '%s' "$TL" | jq -e '.check_runnable == false and .repo == "x" and (has("claim") | not)
    and .meta.claim_rejected_by == "person-row"' >/dev/null; then ok "(t) the person-ruled keep writes no claim: one row"
else bad "(t) T1=$T1 after-carry=$(wc -l < "$WRITES") TL=$TL log=$(cat "$LOG")"; fi

# (u) claim, marked absent (claim ended), back and red: the re-arm row has no claim
reset "$(row g-u2 x src/a.test.ts "$GEN" '["d > old"]' | jq -c '. + {repo: "x", claim: "The test is right: ..."}')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 1414141414141414 "$DIR"
printf '(fail) d > old\n 0 pass\n 1 fail\n' > "$FAKE/a.test.ts.out"
: > "$WRITES"; close_failing_test_gaps x 1515151515151515 "$DIR"
U1="$(wc -l < "$WRITES")"; UL="$(tail -n 1 "$WRITES")"
if [ "$U1" = 1 ] && printf '%s' "$UL" | jq -e '.check_runnable == true and .repo == "x" and (has("claim") | not)' >/dev/null; then
  ok "(u) the re-arm after a mark does not bring the ended claim back"
else bad "(u) U1=$U1 UL=$UL log=$(cat "$LOG")"; fi

# (v) a held gap is marked with its hold kept
reset "$(row g-v x src/a.test.ts "$GEN" '["d > old"]' | jq -c '. + {claim: "The test is right: ..."} | .meta += {operator_hold: true, operator_hold_reason: "needs_localization"}')"
summary "(pass) d > new" > "$FAKE/a.test.ts.out"
close_failing_test_gaps x 1616161616161616 "$DIR"
VL="$(tail -n 1 "$WRITES")"
if [ "$(wc -l < "$WRITES")" = 1 ] && printf '%s' "$VL" | jq -e '.check_runnable == false and (has("claim") | not) and .meta.operator_hold == true
    and .meta.operator_hold_reason == "needs_localization"' >/dev/null; then ok "(v) a held gap's mark keeps its hold and ends its claim"
else bad "(v) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (w) the evidence on each verdict line: a red run with one name passing, one failing and one the run does not name
ev() { sed -n "s/^.*$1.* | evidence //p" "$LOG" | tail -n 1; }
git -C "$DIR" add -A; git -C "$DIR" -c user.name=t -c user.email=t@t commit -qm w
WSHA="$(git -C "$DIR" rev-parse HEAD)"
printf 'test("three")\n' > "$DIR/src/w.test.ts"
reset "$(row g-w x src/w.test.ts "$GEN" '["d > one","d > two","d > three"]')"
{ echo "warn: an error before the first test"; echo "(pass) d > zero"; echo "warn: an error after zero"; echo "(pass) d > one"; echo "log: setup ran"; echo "error: expect(received).toBe(expected)"; printf 'Expected: %0400d\n' 1; echo "  at w.test.ts:3"; echo "(fail) d > two"; printf ' 1 pass\n 1 fail\n'; } > "$FAKE/w.test.ts.out"
echo 1 > "$FAKE/w.test.ts.rc"
close_failing_test_gaps x 1717171717171717 "$DIR"
W1="$(ev g-w)"
if printf '%s' "$W1" | jq -e --arg dir "$DIR" --arg sha "$WSHA" '.dir == $dir and .sha == $sha and .node_modules == false and .rc == "1" and .count == "1 pass, 1 fail"
    and .names == [{name: "d > one", result: "pass"}, {name: "d > two", result: "fail", error: "error: expect(received).toBe(expected)", got: ("Expected: " + ("0" * 399) + "1")[0:300]},
                   {name: "d > three", result: "absent"}]' >/dev/null \
  && grep -q 'g-w still red alone (1/3 named tests pass); left open | evidence ' "$LOG"; then
  ok "(w) a red verdict says where it ran, its exit code, its counts, and each name: pass, fail with its error line, absent"
else bad "(w) ev=$W1 log=$(cat "$LOG")"; fi
# the first error line before a failure is bounded: no "error" line, so the first line is given, cut at 300
{ printf 'Expected: %0400d\n' 1; echo "(fail) d > two"; printf ' 0 pass\n 1 fail\n'; } > "$FAKE/w.test.ts.out"
reset "$(row g-w2 x src/w.test.ts "$GEN" '["d > two"]')"
close_failing_test_gaps x 1818181818181818 "$DIR"
W2="$(ev g-w2)"
if printf '%s' "$W2" | jq -e '.names[0].result == "fail" and (.names[0].error | length) == 300 and (.names[0].error | startswith("Expected: 0"))' >/dev/null; then
  ok "(w) a failing name's error line is bounded at 300 characters"
else bad "(w) bounded: ev=$W2"; fi
# a checkout with node_modules says so; an import that failed is told by its count line (an error, no test)
mkdir -p "$DIR/node_modules"; printf 'error: Cannot find module "x"\n 0 pass\n 0 fail\n 1 error\n' > "$FAKE/w.test.ts.out"
reset "$(row g-w6 x src/w.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 2121212121212121 "$DIR"; rmdir "$DIR/node_modules"
W6="$(ev g-w6)"
if printf '%s' "$W6" | jq -e '.node_modules == true and .count == "0 pass, 0 fail, 1 error" and .names == [{name: "d > one", result: "absent"}]' >/dev/null; then
  ok "(w) the evidence says whether the checkout has node_modules, and an import failure's count line"
else bad "(w) modules: ev=$W6 log=$(cat "$LOG")"; fi
# a run the bound cut (timeout's 124, no summary): the no-result line says rc 124
printf '(pass) d > one\n' > "$FAKE/w.test.ts.out"; echo 124 > "$FAKE/w.test.ts.rc"
reset "$(row g-w3 x src/w.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 1919191919191919 "$DIR"
W3="$(ev 'produced no result; g-w3')"
if printf '%s' "$W3" | jq -e '.rc == "124" and .count == "" and .names == [{name: "d > one", result: "pass"}]' >/dev/null; then
  ok "(w) a run cut at its bound says rc 124 on its no-result line"
else bad "(w) 124: ev=$W3 log=$(cat "$LOG")"; fi
# a close carries it too; an untracked file says nothing was run
summary "(pass) d > one" > "$FAKE/w.test.ts.out"; rm -f "$FAKE/w.test.ts.rc"
reset "$(row g-w4 x src/w.test.ts "$GEN" '["d > one"]')" "$(row g-w5 x src/none.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 2020202020202020 "$DIR"
W4="$(ev 'closed g-w4')"; W5="$(ev 'g-w5 names')"
if printf '%s' "$W4" | jq -e '.rc == "0" and .count == "1 pass, 0 fail" and .names == [{name: "d > one", result: "pass"}]' >/dev/null \
  && printf '%s' "$W5" | jq -e --arg sha "$WSHA" '.ran == false and .node_modules == false and .sha == $sha and (has("rc") | not)' >/dev/null; then
  ok "(w) a close carries its evidence; an untracked file's line says it was not run"
else bad "(w) close/untracked: W4=$W4 W5=$W5 log=$(cat "$LOG")"; fi

# a name that is the start of another test's name is that name only: "d > one" is absent from a run that names only
# "d > one two", passing or failing, as the closer's own exact-line rule reads it
summary "(pass) d > one two" > "$FAKE/w.test.ts.out"; echo 0 > "$FAKE/w.test.ts.rc"
reset "$(row g-w7 x src/w.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 2222222222222222 "$DIR"
W7="$(ev g-w7)"
{ echo "error: expect(received).toBe(expected)"; echo "(fail) d > one two"; printf ' 0 pass\n 1 fail\n'; } > "$FAKE/w.test.ts.out"; echo 1 > "$FAKE/w.test.ts.rc"
reset "$(row g-w8 x src/w.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 2323232323232323 "$DIR"; rm -f "$FAKE/w.test.ts.rc"
W8="$(ev g-w8)"
if printf '%s' "$W7" | jq -e '.names == [{name: "d > one", result: "absent"}]' >/dev/null \
  && printf '%s' "$W8" | jq -e '.names == [{name: "d > one", result: "absent"}]' >/dev/null; then
  ok "(w) a name another test's name starts with is absent from a run that names only the longer one, passing or failing"
else bad "(w) prefix: W7=$W7 W8=$W8 log=$(cat "$LOG")"; fi
# (x) the evidence goes on the gap's row. bun prints a failing expect's source line first (here it names "error"), then
# the matcher line, then what the assertion got; the row carries the matcher line and what it got, never the source.
xout() { # received
  printf 'src/x.test.ts:\n3 |   expect(r.error).toContain("wrote no report");\n                      ^\nerror: expect(received).toContain(expected)\n\n'
  printf 'Expected to contain: "wrote no report"\nReceived: "%s"\n\n      at <anonymous> (src/x.test.ts:3:19)\n(fail) d > one\n 0 pass\n 1 fail\n' "$1"
}
xrow() { row g-x x src/x.test.ts "$GEN" '["d > one"]' | jq -c '. + {claim: {by: "walk"}, waits_for: "w"} | .meta.operator_hold = "h"'; }
touch "$DIR/src/x.test.ts"; echo 1 > "$FAKE/x.test.ts.rc"
xout "spawn ENOENT" > "$FAKE/x.test.ts.out"
reset "$(xrow)"; XR="$(jq -c '.[0].meta.evidence_resolve' "$ROWS")"
close_failing_test_gaps x 3131313131313131 "$DIR"; X1="$(cat "$WRITES")"
# run again at the same sha (a re-gate): the same found writes nothing
close_failing_test_gaps x 3434343434343434 "$DIR"; XS="$(wc -l < "$WRITES")"
touch "$DIR/src/x2.txt"; git -C "$DIR" add -A; git -C "$DIR" -c user.name=t -c user.email=t@t commit -qm x2
close_failing_test_gaps x 3232323232323232 "$DIR"; X2="$(wc -l < "$WRITES")"; X2R="$(sed -n 2p "$WRITES")"
[ "$(printf '%s' "$X1" | jq -r .meta.closer_evidence.sha)" != "$(git -C "$DIR" rev-parse HEAD)" ] || X2="sha unchanged"
[ "$(printf '%s' "$X2R" | jq -r .meta.closer_evidence.sha)" = "$(git -C "$DIR" rev-parse HEAD)" ] || X2="row not at the new sha"
xout "spawn EACCES" > "$FAKE/x.test.ts.out"
close_failing_test_gaps x 3333333333333333 "$DIR"; X3="$(sed -n 3p "$WRITES")"
if [ "$(printf '%s\n' "$X1" | wc -l)" = 1 ] && printf '%s' "$X1" | jq -e --argjson er "$XR" '.status == "open" and .claim == null and .waits_for == "w"
      and .meta.operator_hold == "h" and .meta.evidence_resolve == $er and .meta.closer_evidence.rc == "1"
      and .meta.closer_evidence.names == [{name: "d > one", result: "fail", error: "error: expect(received).toContain(expected)",
        got: "Expected to contain: \"wrote no report\"\nReceived: \"spawn ENOENT\""}]' >/dev/null \
  && [ "$XS" = 1 ] && [ "$X2" = 2 ] && [ "$(wc -l < "$WRITES")" = 3 ] && printf '%s' "$X3" | jq -e '.meta.closer_evidence.names[0].got | endswith("Received: \"spawn EACCES\"")' >/dev/null; then
  ok "(x) a red verdict's row carries the matcher line and what the assertion got, keeps its holds, drops its claim; the same at the same HEAD writes nothing, the same at a new HEAD writes a row at that sha, a new received writes again"
else bad "(x) X1=$X1 XS=$XS X2=$X2 X3=$X3 log=$(cat "$LOG")"; fi
# (x) across repos: the rows this closer wrote, read by records' fold. Red at one HEAD, then a landing, then the same red
# at the landed HEAD, then a closing (as a change to the closer's own run could cause): the closing credits nobody,
# because the red row at the landed HEAD is the gap's last red. Reads the fold from RECORDS_DIR, by default this tree's
# records-vessel submodule, so every run that guards a landing runs it; it is skipped only when no checkout holds the fold.
RECORDS_DIR="${RECORDS_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/repos/records-vessel}"
if [ -f "$RECORDS_DIR/src/fold.ts" ]; then
  XROWS="$(jq -cn --argjson x1 "$X1" --arg x2 "$X2R" '
    [{shape: "credits", role: "owner", target: "gap", by_call: "git_land"}, ($x1 + {role: "detector"}),
     {shape: "selection", role: "walk", arm: "treated", cell: "land", pool_refs: ["r1"]},
     {shape: "hop", role: "walk", phase: "started", call_id: "c1", pointer_type: "git_land", selection_ref: "r2"},
     {shape: "hop", role: "walk", phase: "ended", call_id: "c1"}]
    + (if $x2 == "" then [] else [($x2 | fromjson) + {role: "detector"}] end)
    + [{shape: "gap", role: "detector", gap_id: "g-x", status: "closed"}]
    | to_entries | map(.value + {id: ("r" + (.key | tostring)), seq: (.key + 1), t: "", writer: .value.role, input_refs: []})')"
  XF="$(cd "$RECORDS_DIR" && printf '%s' "$XROWS" | bun -e '
    const { gapClosures, gapClosuresScan } = await import(process.cwd() + "/src/fold.ts")
    const rows = JSON.parse(await Bun.stdin.text())
    const read = (gs) => gs.map((g) => ({ cells: [...g.cells], refused: g.refused ?? null }))
    console.log(JSON.stringify([read(gapClosures(rows, 1e9, 1e9)), read(gapClosuresScan(rows, 1e9, 1e9))]))' 2>&1)"
  if [ "$XF" = '[[{"cells":[],"refused":"no_change"}],[{"cells":[],"refused":"no_change"}]]' ]; then
    ok "(x) across repos: red, a landing, the same red at the landed HEAD, then a closing: records' fold credits nobody"
  else bad "(x) across repos: fold=$XF rows=$XROWS"; fi
else printf 'SKIP - (x) across repos: no records-vessel checkout at %s\n' "$RECORDS_DIR"; fi
# twelve names, each failing with a long received: the row's metadata stays within gap_resolve's 4096, evidence_resolve
# whole, at most 8 names, with how many there were
XN="$(jq -cn '[range(12) | "d > n\(.)"]')"
{ for i in $(seq 0 11); do printf 'error: expect(received).toBe(expected)\nExpected: 1\nReceived: %0400d\n(fail) d > n%s\n' "$i" "$i"; done; printf ' 0 pass\n 12 fail\n'; } > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" "$XN")"; XR="$(jq -c '.[0].meta.evidence_resolve' "$ROWS")"
close_failing_test_gaps x 3434343434343434 "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && jq -e --argjson er "$XR" '(.meta | tostring | length) <= 4096 and (.meta | has("cut") | not) and .meta.evidence_resolve == $er
      and (.meta.closer_evidence.names | length) <= 8 and .meta.closer_evidence.names_cut == 12' "$WRITES" >/dev/null; then
  ok "(x) twelve long failures: the row's metadata stays within 4096 with evidence_resolve whole, at most 8 names and names_cut 12"
else bad "(x) long: $(jq -c '{n: (.meta | tostring | length), c: .meta.closer_evidence}' "$WRITES" | cut -c1-600)"; fi
# metadata already at the bound takes no evidence, and a red verdict then writes nothing
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]' | jq -c --arg f "$(printf '%04000d' 0)" '.meta.note = $f')"
xout "spawn ENOENT" > "$FAKE/x.test.ts.out"
close_failing_test_gaps x 3535353535353535 "$DIR"
if [ ! -s "$WRITES" ]; then ok "(x) metadata already at the bound takes no evidence, and its red verdict writes no row"
else bad "(x) full meta: $(cut -c1-300 "$WRITES")"; fi
# the close and the absent mark carry it as well
summary "(pass) d > one" > "$FAKE/x.test.ts.out"; rm -f "$FAKE/x.test.ts.rc"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]')" "$(row g-y x src/x.test.ts "$GEN" '["d > nowhere"]')"
close_failing_test_gaps x 3636363636363636 "$DIR"
if jq -e -s 'map({(.gap_id): .}) | add | .["g-x"].status == "closed" and .["g-x"].meta.closer_evidence.names == [{name: "d > one", result: "pass"}]
      and .["g-y"].meta.check_runnable == false and .["g-y"].meta.closer_evidence.names == [{name: "d > nowhere", result: "absent"}]' "$WRITES" >/dev/null; then
  ok "(x) a close and an absent mark carry the run's evidence on their rows"
else bad "(x) close/mark: $(cat "$WRITES")"; fi

# eight names whose matcher lines and received are long: past the bound the matcher lines go first and what each
# assertion got stays; a matcher line is cut at 160 on the row
{ for i in $(seq 0 7); do printf 'error: %0300d\nExpected: 1\nReceived: %0400d\n(fail) d > n%s\n' "$i" "$i" "$i"; done; printf ' 0 pass\n 8 fail\n'; } > "$FAKE/x.test.ts.out"
echo 1 > "$FAKE/x.test.ts.rc"
reset "$(row g-x x src/x.test.ts "$GEN" "$(jq -cn '[range(8) | "d > n\(.)"]')")"
close_failing_test_gaps x 3737373737373737 "$DIR"
X8="$(jq -c '.meta.closer_evidence' "$WRITES")"
{ printf 'error: %0250d\n(fail) d > one\n 0 pass\n 1 fail\n' 0; } > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]')"
close_failing_test_gaps x 3838383838383838 "$DIR"
X9="$(jq -c '.meta.closer_evidence' "$WRITES")"
if printf '%s' "$X8" | jq -e '.evidence_cut == true and (.names | length) == 8 and all(.names[]; has("error") | not) and all(.names[]; .got | startswith("Expected: 1\nReceived: 0"))' >/dev/null \
  && printf '%s' "$X9" | jq -e '(.names[0].error | length) == 160 and (.evidence_cut | not)' >/dev/null; then
  ok "(x) past the bound the matcher lines go before what the assertions got; a matcher line on the row is cut at 160"
else bad "(x) order: X8=$(printf '%s' "$X8" | cut -c1-300) X9=$(printf '%s' "$X9" | cut -c1-300)"; fi
# a re-arm carries it too: names back and red, the closer's own mark ends; a person's ruling stays
xout "spawn ENOENT" > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]' | jq -c '.check_runnable = false | .meta.check_runnable = false | .meta.names_absent = ["d > one"]')" \
  "$(row g-z x src/x.test.ts "$GEN" '["d > one"]' | jq -c '.check_runnable = false | .meta.check_runnable = false | .meta.names_absent = ["d > one"] | .meta.claim_rejected_by = "p"')"
close_failing_test_gaps x 3939393939393939 "$DIR"
if jq -e -s 'length == 2 and all(.[]; .meta.closer_evidence.names[0].got == "Expected to contain: \"wrote no report\"\nReceived: \"spawn ENOENT\"")' "$WRITES" >/dev/null; then
  ok "(x) a re-arm row, and a ruled gap's row, carry the run's evidence"
else bad "(x) re-arm: $(cat "$WRITES")"; fi
# an evidence row the store did not take is not seen: the gap runs again at the same HEAD
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]')"
WFAIL=1 close_failing_test_gaps x 4040404040404040 "$DIR"; : > "$FAKE/ran.txt"
close_failing_test_gaps x 4040404040404040 "$DIR"
if grep -q "g-x's evidence row was NOT written" "$LOG" && [ "$(wc -l < "$FAKE/ran.txt")" = 1 ] && [ "$(wc -l < "$WRITES")" = 1 ]; then
  ok "(x) an evidence row the store refused is written on the next call at the same HEAD"
else bad "(x) refused: ran=$(cat "$FAKE/ran.txt") writes=$(wc -l < "$WRITES") log=$(cat "$LOG")"; fi
rm -f "$FAKE/x.test.ts.rc"

# (y) the edges of what the row takes from a failure's block, and of the bound. xe: the one name's evidence on the row.
xe() { jq -c '.meta.closer_evidence.names[0]' "$WRITES"; }
echo 1 > "$FAKE/x.test.ts.rc"
# the matcher line is the one that starts "error:": a source line holding "error:" further in is not it
printf '3 |   expect(x).toBe("error: y");\n                ^\nerror: expect(received).toBe(expected)\nExpected: "error: y"\n(fail) d > one\n 0 pass\n 1 fail\n' > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]')"; close_failing_test_gaps x 4141414141414141 "$DIR"; Y1="$(xe)"
# a matcher line followed at once by the stack: nothing got, so no got
printf 'error: boom\n      at <anonymous> (src/x.test.ts:1:1)\n(fail) d > one\n 0 pass\n 1 fail\n' > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]')"; close_failing_test_gaps x 4242424242424242 "$DIR"; Y2="$(xe)"
# no line starts "error:": the first line naming an error is preferred over the block's first line
printf 'boom\nTypeError: x is not a function\n(fail) d > one\n 0 pass\n 1 fail\n' > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]')"; close_failing_test_gaps x 4343434343434343 "$DIR"; Y3="$(xe)"
if printf '%s' "$Y1" | jq -e '.error == "error: expect(received).toBe(expected)" and .got == "Expected: \"error: y\""' >/dev/null \
  && printf '%s' "$Y2" | jq -e '.error == "error: boom" and (has("got") | not)' >/dev/null \
  && printf '%s' "$Y3" | jq -e '.error == "TypeError: x is not a function" and (has("got") | not)' >/dev/null; then
  ok "(y) the matcher line is the one starting error:, a stack straight after it gives no got, and with none the first error line is taken"
else bad "(y) block: Y1=$Y1 Y2=$Y2 Y3=$Y3"; fi
# nine names: eight on the row, names_cut 9
{ for i in $(seq 0 8); do printf 'error: e%s\n(fail) d > n%s\n' "$i" "$i"; done; printf ' 0 pass\n 9 fail\n'; } > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" "$(jq -cn '[range(9) | "d > n\(.)"]')")"; close_failing_test_gaps x 4444444444444444 "$DIR"
if jq -e '(.meta.closer_evidence.names | length) == 8 and .meta.closer_evidence.names_cut == 9' "$WRITES" >/dev/null; then
  ok "(y) nine names: eight on the row and names_cut 9"
else bad "(y) nine: $(jq -c .meta.closer_evidence "$WRITES" | cut -c1-400)"; fi
# the bound is 4096 inclusive: metadata of exactly 4096 with the evidence keeps it whole; at 4097 the next form is taken
xout "spawn ENOENT" > "$FAKE/x.test.ts.out"
xpad() { row g-x x src/x.test.ts "$GEN" '["d > one"]' | jq -c --argjson n "$1" '.meta.note = ("" | . + ([range($n)] | map("p") | add // ""))'; }
reset "$(xpad 0)"; close_failing_test_gaps x 4545454545454545 "$DIR"
L0="$(jq -r '.meta | tostring | length' "$WRITES")"; K=$((4096 - L0))
reset "$(xpad "$K")"; close_failing_test_gaps x 4646464646464646 "$DIR"; Y6="$(jq -c '.meta' "$WRITES")"
reset "$(xpad $((K + 1)))"; close_failing_test_gaps x 4747474747474747 "$DIR"; Y7="$(jq -c '.meta' "$WRITES")"
if printf '%s' "$Y6" | jq -e '(tostring | length) == 4096 and (.closer_evidence | has("evidence_cut") | not) and (.closer_evidence.names[0] | has("got") and has("error"))' >/dev/null \
  && printf '%s' "$Y7" | jq -e '(tostring | length) <= 4096 and .closer_evidence.evidence_cut == true and (.closer_evidence.names[0] | has("error") | not)' >/dev/null; then
  ok "(y) metadata of exactly 4096 keeps the evidence whole; at 4097 the matcher line goes"
else bad "(y) edge: L0=$L0 Y6=$(printf '%s' "$Y6" | jq -c '{n: (tostring | length), e: .closer_evidence}' | cut -c1-300) Y7=$(printf '%s' "$Y7" | jq -c '{n: (tostring | length), e: .closer_evidence}' | cut -c1-300)"; fi
# when only the empty list of names fits, the row still says how many there were
XL="$(jq -cn '[range(3) | "d > \(.) " + ([range(290)] | map("n") | add)]')"
{ for i in 0 1 2; do printf 'error: e\n(fail) %s\n' "$(printf '%s' "$XL" | jq -r ".[$i]")"; done; printf ' 0 pass\n 3 fail\n'; } > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" "$XL" | jq -c '.meta.note = ([range(2600)] | map("p") | add)')"; close_failing_test_gaps x 4848484848484848 "$DIR"
if jq -e '.meta.closer_evidence.names == [] and .meta.closer_evidence.names_cut == 3 and .meta.closer_evidence.evidence_cut == true' "$WRITES" >/dev/null; then
  ok "(y) a row with room for no names still says how many there were"
else bad "(y) empty names: $(jq -c '{n: (.meta | tostring | length), e: .meta.closer_evidence}' "$WRITES" | cut -c1-400) log=$(tail -3 "$LOG")"; fi
# the same names and counts with another exit code (the bound cut the run: 124) are new evidence and write again
xout "spawn ENOENT" > "$FAKE/x.test.ts.out"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]')"; close_failing_test_gaps x 4949494949494949 "$DIR"
reset "$(row g-x x src/x.test.ts "$GEN" '["d > one"]' | jq -c --argjson m "$(jq -c .meta "$WRITES")" '.meta = $m')"
echo 124 > "$FAKE/x.test.ts.rc"; close_failing_test_gaps x 5050505050505050 "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && jq -e '.meta.closer_evidence.rc == "124"' "$WRITES" >/dev/null; then
  ok "(y) the same names and counts under another exit code write a new row"
else bad "(y) rc: writes=$(wc -l < "$WRITES") $(jq -c .meta.closer_evidence "$WRITES" | cut -c1-300) log=$(tail -3 "$LOG")"; fi
rm -f "$FAKE/x.test.ts.rc"

# (x) a row near the bound holding an earlier run's evidence; its names are gone from the source and from the run
WN='["ISOLATION > a","ISOLATION > b","ISOLATION > c","ISOLATION > d","ISOLATION > e"]'
: > "$DIR/src/w.test.ts"; printf '(pass) OTHER > p1\n 1 pass\n 0 fail\n' > "$FAKE/w.test.ts.out"; rm -f "$FAKE/w.test.ts.rc"
reset "$(row g-w x src/w.test.ts "$GEN" "$WN" | jq -c --arg b "$(printf '%03600d' 0)" '.meta.pad = $b
  | .meta.closer_evidence = {sha: "OLDSHA", rc: "1", count: "0 pass, 1 fail", names: [{name: "ISOLATION > a", result: "fail"}]}')"
close_failing_test_gaps x 7e58b13aaaaaaaaa "$DIR"
if [ -s "$WRITES" ] && jq -e -s 'all(.[]; (.meta | tostring | length) <= 4096 and .meta.names_absent != null
      and .meta.closer_evidence.sha != "OLDSHA" and .meta.closer_evidence.count != "0 pass, 1 fail")' "$WRITES" >/dev/null; then
  ok "[MUST-FAIL] (x) a row near the bound that held an earlier run's evidence is marked absent without it"
else bad "(x) old evidence: $(jq -c '{n: (.meta | tostring | length), a: .meta.names_absent, e: .meta.closer_evidence}' "$WRITES" | cut -c1-400)"; fi
rm -f "$DIR/src/w.test.ts"
# where only the run's sha, exit and counts fit (a checkout path too long for the rest), the row carries those
LD="$T/$(printf 'l%.0s' $(seq 200))/$(printf 'm%.0s' $(seq 200))/$(printf 'n%.0s' $(seq 200))"
mkdir -p "$LD/src"; git init -q "$LD"; touch "$LD/src/w.test.ts"; git -C "$LD" add src/w.test.ts
git -C "$LD" -c user.name=t -c user.email=t@t commit -q -m w; LSHA="$(git -C "$LD" rev-parse HEAD)"
{ for n in a b c; do printf 'error: expect(received).toBe(expected)\n(fail) ISOLATION > %s\n' "$n"; done; printf ' 0 pass\n 3 fail\n'; } > "$FAKE/w.test.ts.out"
echo 1 > "$FAKE/w.test.ts.rc"
WR="$(row g-w x src/w.test.ts "$GEN" '["ISOLATION > a","ISOLATION > b","ISOLATION > c"]' \
  | jq -c '.meta.closer_evidence = {sha: "OLDSHA", rc: "0", count: "3 pass, 0 fail", names: []}')"
WP=$((3700 - $(printf '%s' "$WR" | jq '.meta | tostring | length')))
reset "$(printf '%s' "$WR" | jq -c --arg b "$(printf "%0${WP}d" 0)" '.meta.pad = $b')"
close_failing_test_gaps x 7e58b13bbbbbbbbb "$LD"
if [ "$(wc -l < "$WRITES")" = 1 ] && jq -e --arg s "$LSHA" '(.meta | tostring | length) <= 4096 and (.meta.closer_evidence
      | .sha == $s and .rc == "1" and .count == "0 pass, 3 fail" and .names_dropped == true and .names_cut == 3
        and (has("names") | not) and (has("dir") | not))' "$WRITES" >/dev/null; then
  ok "[MUST-FAIL] (x) where only the run's sha, exit and counts fit, the row carries this run's, with no names"
else bad "(x) fallback: $(jq -c '{n: (.meta | tostring | length), e: .meta.closer_evidence}' "$WRITES" | cut -c1-400)"; fi
if [ -f "$RECORDS_DIR/src/fold.ts" ]; then
  WF="$(cd "$RECORDS_DIR" && jq -c -s '[.[0], (.[0] | .meta.closer_evidence.count = "3 pass, 0 fail")]' "$WRITES" | bun -e '
    const { closerRed } = await import(process.cwd() + "/src/fold.ts")
    console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()).map(closerRed)))' 2>&1)"
  if [ "$WF" = "[true,false]" ]; then ok "[MUST-FAIL] (x) records' closerRed reads that row as red (and the same row with no fails as not)"
  else bad "(x) closerRed on the fallback row: $WF"; fi
else printf 'SKIP - (x) closerRed: no records-vessel checkout at %s\n' "$RECORDS_DIR"; fi
rm -f "$FAKE/w.test.ts.rc"

# (z) a long run read under the script's pipefail: the closer reads its run's lines from a here-string, so a line that is
# there is never read as missing because the reader stopped first. Five names failing on a thrown error, their titles
# not in the source as the runner prints them (an escaped quote, a title built by a template), the run long.
printf "test('a guard writes on this file\\'s client', () => { guard() })\nfor (const w of ['k1', 'k2']) test(\`AUTH=\${w} → writes\`, () => { guard() })\n" > "$DIR/src/z.test.ts"
ZN="[\"Z > a guard writes on this file's client\",\"Z > AUTH=k1 → writes\",\"Z > AUTH=k2 → writes\"]"
long() { head -c 2097152 /dev/zero | tr '\0' 'p' | fold -w 100 | sed 's/^/(pass) OTHER > /'; }
{ printf 'error: NETWORK GUARD tripped: a request left the box\n      at guard (/w/src/z.test.ts:1:9)\n(fail) %s [0.42ms]\n' "Z > a guard writes on this file's client" "Z > AUTH=k1 → writes" "Z > AUTH=k2 → writes"
  long; printf '\n 20972 pass\n 3 fail\n'; } > "$FAKE/z.test.ts.out"; echo 1 > "$FAKE/z.test.ts.rc"
reset "$(row g-z x src/z.test.ts "$GEN" "$ZN")"
close_failing_test_gaps x 7e58b13675aaaaaa "$DIR"
if ! jq -e -s 'any(.[]; .meta.names_absent != null or .meta.check_runnable == false)' "$WRITES" >/dev/null && grep -q 'g-z still red alone (0/3 named tests pass)' "$LOG"; then
  ok "[MUST-FAIL] (z) a long run whose named tests fail on a thrown error is red, never absent, though their titles are not in the source as printed"
else bad "(z) red: writes=$(jq -c '.meta | {check_runnable, names_absent}' "$WRITES" | head -2) log=$(grep -o 'g-z[^|]*' "$LOG" | head -2)"; fi
{ printf '# Unhandled error between tests\n'; long; printf '\n 20972 pass\n 0 fail\n 1 error\n'; } > "$FAKE/z.test.ts.out"
reset "$(row g-z x src/z.test.ts "$GEN" "$ZN")"
close_failing_test_gaps x 7e58b13675bbbbbb "$DIR"
if ! jq -e -s 'any(.[]; .meta.names_absent != null or .meta.check_runnable == false)' "$WRITES" >/dev/null; then
  ok "[MUST-FAIL] (z) a long run that broke before its tests (an unhandled error first) marks nothing absent"
else bad "(z) broken: $(jq -c '.meta | {check_runnable, names_absent}' "$WRITES" | head -2)"; fi
rm -f "$FAKE/z.test.ts.rc" "$DIR/src/z.test.ts"

# every row this file's legs wrote: none names a test absent that its own evidence reads as passing or failing
ZC="$(jq -c 'select(.meta.names_absent != null and (.meta.closer_evidence.names | type) == "array")
  | . as $r | $r.meta.names_absent as $a | [$r.meta.closer_evidence.names[] | select(.result == "pass" or .result == "fail") | .name | select(IN($a[]))]
  | select(length > 0) | {gap: $r.gap_id, both: .}' "$ALLW")"; ZRC=$?
if [ -s "$ALLW" ] && [ "$ZRC" = 0 ] && [ -z "$ZC" ]; then ok "(z) no row names a test absent that its own evidence reads as passing or failing ($(wc -l < "$ALLW") rows)"
else bad "(z) self-contradicting rows (jq exit $ZRC): ${ZC:-none read}"; fi

[ "$FAILS" = 0 ] && { echo "PASS - pull-sync closes a generator gap once its named tests pass alone, and only then"; exit 0; }
echo "$FAILS FAILED"; exit 1
