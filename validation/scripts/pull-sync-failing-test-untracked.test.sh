#!/usr/bin/env bash
# A failing-test gap whose test file is not tracked at the gated HEAD checks nothing the repository holds (a file since
# removed, or a build copy such as dist/*.test.js the suite also ran): no change to the source can make it pass
# (scripts/substrate/substrate-pull-sync.sh close_failing_test_gaps, gen_failing_test_gaps).
#   (a) [MUST-FAIL] the closer marks a gap whose file was removed at HEAD not checkable (check_runnable false, every
#       name absent, the HEAD, "not tracked" in its summary), runs nothing, and never writes it closed;
#   (b) [MUST-FAIL] the closer marks a gap on a build copy (on disk, gitignored) the same way, and does not run it,
#       though it would pass;
#   (c) [GUARD] said once: the same gap at the same HEAD again, and at a new HEAD while still untracked, writes nothing;
#   (d) [GUARD] tracked again with its names red: checkable again;
#   (e) [MUST-FAIL] the generator files no gap for a failing file not tracked at HEAD, says so, and still files the
#       tracked file failing in the same run.
# usage: validation/scripts/pull-sync-failing-test-untracked.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "${T:?}"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
for f in shape_route gap_resolve dev_resolve emit_gap emit_gap_checked jq_ao test_tracked close_failing_test_gaps gen_failing_test_gaps; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done > "$T/fns.sh"
grep -q '^close_failing_test_gaps()' "$T/fns.sh" && grep -q '^gen_failing_test_gaps()' "$T/fns.sh" \
  || { echo "FAIL - could not extract the closer and the generator"; exit 1; }
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
scrubbed_env() { shift; "$@"; }
FAKE="$T/fake"; mkdir -p "$FAKE"
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
f="$(basename "$2")"; echo "$f" >> "$(dirname "$0")/ran.txt"; cat "$(dirname "$0")/$f.out" 2>/dev/null
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
export TEST_BASELINE_DIR="$T/baseline"; mkdir -p "$TEST_BASELINE_DIR"
DIR="$T/checkout"; mkdir -p "$DIR/src" "$DIR/dist"; git init -q "$DIR"
printf 'dist/\n' > "$DIR/.gitignore"
printf 'test("one", () => {})\n' > "$DIR/src/kept.test.ts"
git -C "$DIR" add -A
GEN="pull-sync failing-test generator"
row() { # gap_id test_file names-json
  jq -cn --arg id "$1" --arg tf "$2" --arg by "$GEN" --argjson names "$3" \
    '{shape: "gap", gap_id: $id, status: "open", summary: "a test fails", writer: "pull-sync", role: "detector",
      meta: {filed_by: $by, evidence_resolve: {shape: "test_suite", input: {vessel: "x", test_file: $tf, only_tests: $names}}}}'
}
unseen() { rm -f "${TEST_BASELINE_DIR:?}"/*.closer; }
reset() { printf '%s\n' "$@" | jq -s -c 'to_entries | map(.value + {id: ("r" + (.key | tostring)), seq: (.key + 1)})' > "$ROWS"; : > "$WRITES"; : > "$FAKE/ran.txt"; : > "$LOG"; unseen; }
marked() { [ "$(wc -l < "$WRITES")" = 1 ] && jq -e --argjson n "$1" --arg h "$2" '.status == "open" and .check_runnable == false and .meta.check_runnable == false
  and .meta.names_absent == $n and .meta.absent_at_head == $h and (.summary | contains("not tracked"))' "$WRITES" >/dev/null && [ ! -s "$FAKE/ran.txt" ]; }

# (a) removed at HEAD (no file, not tracked)
reset "$(row g-rm src/removed.test.ts '["d > one","d > two"]')"
close_failing_test_gaps x 1111111111abcdef "$DIR"
if marked '["d > one","d > two"]' 1111111111; then ok "(a) a removed test file's gap is marked not checkable, every name absent, nothing run or closed"
else bad "(a) writes=$(cat "$WRITES") ran=$(cat "$FAKE/ran.txt") log=$(cat "$LOG")"; fi

# (b) a build copy on disk, gitignored
printf 'test("one", () => {})\n' > "$DIR/dist/copy.test.js"
printf '(pass) one\n 1 pass\n 0 fail\n' > "$FAKE/copy.test.js.out"
reset "$(row g-dist dist/copy.test.js '["one"]')"
close_failing_test_gaps x 1111111111abcdef "$DIR"
if marked '["one"]' 1111111111; then ok "(b) a build copy's gap is marked not checkable and not run, though it would pass"
else bad "(b) writes=$(cat "$WRITES") ran=$(cat "$FAKE/ran.txt") log=$(cat "$LOG")"; fi

# (c) said once: the marked row is the gap's latest; again at this HEAD and at a new one, nothing
M="$(cat "$WRITES")"
reset "$M"
close_failing_test_gaps x 1111111111abcdef "$DIR"; n1="$(wc -l < "$WRITES")"
unseen
close_failing_test_gaps x 2222222222abcdef "$DIR"; n2="$(wc -l < "$WRITES")"
if [ "$n1" = 0 ] && [ "$n2" = 0 ]; then ok "(c) an untracked gap already marked is not marked again, at this HEAD or a new one"
else bad "(c) n1=$n1 n2=$n2 writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (d) tracked again, its name red: checkable again
printf 'test("one", () => { expect(1).toBe(2) })\n' > "$DIR/src/back.test.ts"; git -C "$DIR" add src/back.test.ts
printf '(fail) one\n 0 pass\n 1 fail\n' > "$FAKE/back.test.ts.out"
reset "$(row g-back src/back.test.ts '["one"]' | jq -c '. + {check_runnable: false, waits_for: "person", meta: (.meta + {check_runnable: false, names_absent: ["one"], absent_at_head: "1111111111"})}')"
close_failing_test_gaps x 3333333333abcdef "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && jq -e '.check_runnable == true and .meta.names_absent == null' "$WRITES" >/dev/null; then ok "(d) tracked again with its names red: checkable again"
else bad "(d) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (e) the generator: a failing build copy is not filed; the tracked file failing beside it is
EMITS="$T/emits.txt"; : > "$EMITS"; : > "$LOG"
emit_gap() { printf '%s\n' "$1" >> "$EMITS"; }
dev_resolve() { printf '{"body":{"gaps":[]}}'; }
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
case "$2" in */kept.test.ts) printf '(fail) two\n 0 pass\n 1 fail\n' ;; */copy.test.js) printf '(fail) three\n 0 pass\n 1 fail\n' ;; esac
B
OUT="$(printf '%s\n' "src/kept.test.ts:" "error: expect(received).toBe(expected)" "      at check (/w/src/lib/k.ts:3:5)" "(fail) two [1.00ms]" \
  "dist/copy.test.js:" "error: expect(received).toBe(expected)" "      at check (/w/src/lib/k.ts:3:5)" "(fail) three [1.00ms]" " 0 pass" " 2 fail")"
printf '%s\n' "(fail) two" "(fail) three" > "$T/prev"
gen_failing_test_gaps x "$OUT" "$T/prev" 4444444444abcdef "$DIR"
files="$(jq -r '.impulse.pointer.gap.classification_metadata.evidence_resolve.input.test_file' "$EMITS" | sort -u | tr '\n' ' ')"
if [ "$files" = "src/kept.test.ts " ] && grep -q 'dist/copy.test.js fails but is not tracked' "$LOG"; then
  ok "(e) the generator files the tracked file only, and says the build copy is not filed"
else bad "(e) filed: ${files:-nothing} log=$(cat "$LOG")"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - an untracked test file's gap is not checkable, and is not filed"; exit 0; }
echo "$FAILS FAILED"; exit 1
