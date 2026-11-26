#!/usr/bin/env bash
# The failing-test generator (scripts/substrate/substrate-pull-sync.sh gen_failing_test_gaps) files a gap no stack
# localizes with the fact that says so, never a hold (the USER: "Read as facts"):
#   (a) an assertion failure with no source frame: localized false, needs_information, the test protected, no
#       operator_hold and no operator_hold_reason, no edit_site;
#   (b) one with a source frame: edit_site at that frame, and no localized false;
#   (c) [MUST-FAIL] a run whose summary is followed by a long tail (a teardown's output past the pipe's buffer) is a run
#       with a result: its summary line is read from a here-string, so the script's pipefail cannot read it as missing.
#   (d) [MUST-FAIL] red alone is the test runner's: local-tools' gap_check is asked for the file at the full HEAD with the
#       payload's names, and the generator runs no bun of its own;
#   (e) [MUST-FAIL] gap_check refusing, or not answering: nothing filed, nothing marked polluted;
#   (f) [MUST-FAIL] a name the runner's report passes alone is not filed, though the run's output says it failed, and is
#       marked polluted: the closer, reading the same report, would close it on the next tick.
#   (g) [GUARD] a run the runner killed (signalled) proves nothing, whatever its report says: nothing filed, nothing
#       marked polluted;
#   (h) [GUARD] a name the runner's report says is absent (not run) is neither filed nor marked polluted.
# Runs the script's own function with the store, the alone run (gap_check) and the write stubbed.
# usage: validation/scripts/pull-sync-failing-test-generator-fact.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
for f in gen_failing_test_gaps jq_ao test_tracked; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; sed -n "/^$f() { .*}$/p" "$SCRIPT"; done > "$T/fns.sh"
grep -q '^gen_failing_test_gaps()' "$T/fns.sh" || { echo "FAIL - could not extract gen_failing_test_gaps"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
EMITS="$T/emits.txt"; emit_gap() { printf '%s\n' "$1" >> "$EMITS"; }
# discovery: an empty gap store, and local-tools' gap_check running the fake bun (lib/gap-check-stub.sh)
source "$(dirname "$0")/lib/gap-check-stub.sh"
BRANCH=dev
dev_resolve() {
  case "$(printf '%s' "$1" | jq -r '.impulse.pointer.type')" in
    gap_check) gap_check_stub "$(printf '%s' "$1" | jq -c '{pointer: .impulse.pointer}')" ;;
    *) printf '{"body":{"gaps":[]}}' ;;
  esac
}
scrubbed_env() { shift; "$@"; }
export TEST_BASELINE_DIR="$T/baseline"; mkdir -p "$TEST_BASELINE_DIR"
DIR="$T/checkout"; mkdir -p "$DIR/src"
printf 'test("one", () => { expect(1).toBe(2) })\n' > "$DIR/src/a.test.ts"
printf 'test("two", () => { expect(1).toBe(2) })\n' > "$DIR/src/b.test.ts"
printf 'test("three", () => { expect(1).toBe(2) })\n' > "$DIR/src/c.test.ts"
# the generator files only files tracked at HEAD, as a gated checkout's tests are
git init -q "$DIR"; git -C "$DIR" add -A
FAKE="$T/fake"; mkdir -p "$FAKE"
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
case "$2" in */a.test.ts) printf '(fail) one\n 0 pass\n 1 fail\n' ;; */b.test.ts) printf '(fail) two\n 0 pass\n 1 fail\n' ;;
  */c.test.ts) printf '(fail) three\n 0 pass\n 1 fail\n'; head -c 2097152 /dev/zero | tr '\0' 't' | fold -w 100 ;; esac
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
OUT="$(printf '%s\n' "src/a.test.ts:" "error: expect(received).toBe(expected)" "Expected: 2" "Received: 1" "(fail) one [1.00ms]" \
  "src/b.test.ts:" "error: expect(received).toBe(expected)" "      at check (/w/src/lib/b.ts:3:5)" "(fail) two [1.00ms]" \
  "src/c.test.ts:" "error: expect(received).toBe(expected)" "(fail) three [1.00ms]" " 0 pass" " 3 fail")"
printf '%s\n' "(fail) one" "(fail) two" "(fail) three" > "$T/prev"
: > "$EMITS"; : > "$LOG"
gen_failing_test_gaps x "$OUT" "$T/prev" 0123456789abcdef "$DIR"
A="$(jq -c 'select(.impulse.pointer.gap.classification_metadata.evidence_resolve.input.test_file == "src/a.test.ts") | .impulse.pointer.gap.classification_metadata' "$EMITS")"
Bm="$(jq -c 'select(.impulse.pointer.gap.classification_metadata.evidence_resolve.input.test_file == "src/b.test.ts") | .impulse.pointer.gap.classification_metadata' "$EMITS")"
if printf '%s' "$A" | jq -e '.localized == false and .disposition == "needs_information" and .protected_files == ["repos/x/src/a.test.ts"]
    and (has("operator_hold") or has("operator_hold_reason") or has("edit_site") | not)' >/dev/null; then
  ok "(a) a gap no stack localizes is filed with localized false and no hold"
else bad "(a) emitted: ${A:-nothing} log=$(cat "$LOG")"; fi
if printf '%s' "$Bm" | jq -e '.edit_site == "repos/x/src/lib/b.ts" and (has("localized") or has("operator_hold") | not)' >/dev/null; then
  ok "(b) a gap with a source frame is filed with its edit_site, no fact of not being localized"
else bad "(b) emitted: ${Bm:-nothing} log=$(cat "$LOG")"; fi
C="$(jq -c 'select(.impulse.pointer.gap.classification_metadata.evidence_resolve.input.test_file == "src/c.test.ts")' "$EMITS")"
if [ -n "$C" ] && ! grep -q 'alone run of src/c.test.ts produced no result' "$LOG"; then
  ok "[MUST-FAIL] (c) a run with a long tail after its summary is read as a run with a result, and its gap is filed"
else bad "(c) c.test.ts: emitted ${C:-nothing}; log=$(grep c.test.ts "$LOG" | head -3)"; fi
H40=0123456789abcdef0123456789abcdef01234567
OUT1="$(printf '%s\n' "src/a.test.ts:" "error: expect(received).toBe(expected)" "(fail) one [1.00ms]" " 0 pass" " 1 fail")"
printf '%s\n' "(fail) one" > "$T/prev"
again() { : > "$EMITS"; : > "$LOG"; : > "$T/gc-asks.txt"; rm -f "$TEST_BASELINE_DIR/x.polluted"; gen_failing_test_gaps x "$OUT1" "$T/prev" "$H40" "$DIR"; }
again
if [ "$(wc -l < "$T/gc-asks.txt")" = 1 ] && jq -e --arg h "$H40" '.type == "gap_check" and .repo == "x" and .ref == $h and .branch == "dev"
    and .test_file == "src/a.test.ts" and .only_tests == ["one"]' "$T/gc-asks.txt" >/dev/null && [ "$(wc -l < "$EMITS")" = 1 ] \
  && ! command grep -qE 'BUN_BIN|bun"? test|scrubbed_env' <<<"$(declare -f gen_failing_test_gaps)"; then
  ok "[MUST-FAIL] (d) red alone is asked of gap_check (full HEAD, branch, the names), and the generator runs no bun itself"
else bad "(d) asks=$(cat "$T/gc-asks.txt") emits=$(wc -l < "$EMITS") log=$(cat "$LOG")"; fi
for mode in refuse down; do
  if [ "$mode" = refuse ]; then GC_REFUSE="the test run wrote no report" again; else GC_DOWN=1 again; fi
  if [ ! -s "$EMITS" ] && ! command grep -qxF "one" "$TEST_BASELINE_DIR/x.polluted" 2>/dev/null \
     && command grep -q "did not check src/a.test.ts alone" "$LOG"; then
    ok "[MUST-FAIL] (e) gap_check $mode: nothing filed, nothing marked polluted"
  else bad "(e) $mode: emits=$(cat "$EMITS") polluted=$(cat "$TEST_BASELINE_DIR/x.polluted" 2>/dev/null) log=$(cat "$LOG")"; fi
done
GC_REPORT=pass again
if [ ! -s "$EMITS" ] && command grep -qxF "one" "$TEST_BASELINE_DIR/x.polluted"; then
  ok "[MUST-FAIL] (f) a name the runner's report passes alone is not filed, though the output said it failed, and is marked polluted"
else bad "(f) emits=$(cat "$EMITS") polluted=$(cat "$TEST_BASELINE_DIR/x.polluted" 2>/dev/null) log=$(cat "$LOG")"; fi
for rep in "" pass; do
  GC_SIGNALLED=true GC_REPORT="$rep" again
  if [ ! -s "$EMITS" ] && ! command grep -qxF "one" "$TEST_BASELINE_DIR/x.polluted" 2>/dev/null \
     && command grep -q "did not check src/a.test.ts alone" "$LOG"; then
    ok "[GUARD] (g) a signalled run, its report ${rep:-as the output gives it}: nothing filed, nothing marked polluted"
  else bad "(g) ${rep:-output}: emits=$(cat "$EMITS") polluted=$(cat "$TEST_BASELINE_DIR/x.polluted" 2>/dev/null) log=$(cat "$LOG")"; fi
done
GC_REPORT=absent again
if [ ! -s "$EMITS" ] && ! command grep -qxF "one" "$TEST_BASELINE_DIR/x.polluted" 2>/dev/null; then
  ok "[GUARD] (h) a name the runner's report says is absent is neither filed nor marked polluted"
else bad "(h) emits=$(cat "$EMITS") polluted=$(cat "$TEST_BASELINE_DIR/x.polluted" 2>/dev/null) log=$(cat "$LOG")"; fi
echo; [ "$FAILS" = 0 ] && { echo "PASS - the generator files the fact, never a hold"; exit 0; }
echo "$FAILS FAILED"; exit 1
