#!/usr/bin/env bash
# The failing-test generator (scripts/substrate/substrate-pull-sync.sh gen_failing_test_gaps) files a gap no stack
# localizes with the fact that says so, never a hold (the USER: "Read as facts"):
#   (a) an assertion failure with no source frame: localized false, needs_information, the test protected, no
#       operator_hold and no operator_hold_reason, no edit_site;
#   (b) one with a source frame: edit_site at that frame, and no localized false.
# Runs the script's own function with the store, the alone run and the write stubbed.
# usage: validation/scripts/pull-sync-failing-test-generator-fact.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
for f in gen_failing_test_gaps jq_ao; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done > "$T/fns.sh"
grep -q '^gen_failing_test_gaps()' "$T/fns.sh" || { echo "FAIL - could not extract gen_failing_test_gaps"; exit 1; }
# shellcheck disable=SC1090
source "$T/fns.sh"
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
EMITS="$T/emits.txt"; emit_gap() { printf '%s\n' "$1" >> "$EMITS"; }
dev_resolve() { printf '{"body":{"gaps":[]}}'; }
scrubbed_env() { shift; "$@"; }
export TEST_BASELINE_DIR="$T/baseline"; mkdir -p "$TEST_BASELINE_DIR"
DIR="$T/checkout"; mkdir -p "$DIR/src"
printf 'test("one", () => { expect(1).toBe(2) })\n' > "$DIR/src/a.test.ts"
printf 'test("two", () => { expect(1).toBe(2) })\n' > "$DIR/src/b.test.ts"
FAKE="$T/fake"; mkdir -p "$FAKE"
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
case "$2" in */a.test.ts) printf '(fail) one\n 0 pass\n 1 fail\n' ;; */b.test.ts) printf '(fail) two\n 0 pass\n 1 fail\n' ;; esac
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
OUT="$(printf '%s\n' "src/a.test.ts:" "error: expect(received).toBe(expected)" "Expected: 2" "Received: 1" "(fail) one [1.00ms]" \
  "src/b.test.ts:" "error: expect(received).toBe(expected)" "      at check (/w/src/lib/b.ts:3:5)" "(fail) two [1.00ms]" " 0 pass" " 2 fail")"
printf '%s\n' "(fail) one" "(fail) two" > "$T/prev"
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
echo; [ "$FAILS" = 0 ] && { echo "PASS - the generator files the fact, never a hold"; exit 0; }
echo "$FAILS FAILED"; exit 1
