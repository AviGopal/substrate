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
#   (h) a test file two gaps check runs once per call.
# usage: validation/scripts/pull-sync-failing-test-closer.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve emit_gap close_failing_test_gaps; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
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

echo; [ "$FAILS" = 0 ] && { echo "PASS - pull-sync closes a generator gap once its named tests pass alone, and only then"; exit 0; }
echo "$FAILS FAILED"; exit 1
