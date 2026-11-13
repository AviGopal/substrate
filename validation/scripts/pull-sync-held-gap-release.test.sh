#!/usr/bin/env bash
# A person releases a gap the failing-test generator held (scripts/substrate/substrate-pull-sync.sh lift_held_gaps), and
# the closer holds the fix to the test file's size at release (close_failing_test_gaps). Runs the script's own functions
# with curl stubbed as discovery in front of an in-memory records store.
#   (a) a held row with no claim gets one (still held); a second call writes nothing;
#   (b) a person's r 1 on any row of the gap: open, unheld, protected_files kept, no edit_site, localized_by, the size;
#   (c) a person's r 0: edit_site the test file, protected_files gone, claim_rejected_by, the size;
#   (d) the latest outcome decides;
#   (e) an outcome by anyone but a person, or on another gap's row, releases nothing;
#   (f) another vessel's held gap, a gap the generator did not file, and a closed gap are not touched;
#   (g) records unreadable: nothing written;
#   (h) the test file missing from the checkout: the gap stays held;
#   (j) gap_resolve writes an emit that differs from the latest row only in its claim;
#   (k) a later outcome re-decides a released gap (r 1 then r 0), keeping the size at the first release; the same
#       deciding outcome writes nothing again;
#   (l) every tick, with no gate run: lift_held_gaps_each releases each graded vessel's gap against its clone, skips a
#       vessel with no clone, and the tick calls it outside the gate's queue;
#   (m) r 1 names the test's sources (relative imports resolved inside the checkout, no test file, nothing outside it,
#       nothing unresolved); r 0 names none; a gap released r 1 before sources existed gets them once, and one whose
#       test file is gone from the checkout gets [] once, not a rewrite every tick;
#   (n) an open generator gap whose latest row names no repo gets one row naming the vessel its evidence runs, the
#       rest of the row (status, summary, meta, any hold) as it was, and not again; (n2) a gap naming a repo, a closed
#       one, one another writer filed, one naming no vessel: nothing; (n3) records unreadable: nothing, logged;
#   (o) a release keeps the repo of the gap; (p) the tick calls carry_gap_repo after the release;
#   (i) the closer leaves a released gap open while its test file has fewer expects than at release, and closes it when
#       it has as many.
# usage: validation/scripts/pull-sync-held-gap-release.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve emit_gap close_failing_test_gaps test_size test_sources lift_held_gaps lift_held_gaps_each carry_gap_repo; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^lift_held_gaps()' "$T/fns.sh" && grep -q '^test_size()' "$T/fns.sh" \
  || { echo "FAIL - could not extract lift_held_gaps and test_size"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; WRITES="$T/writes.txt"; DOWN=""
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY=""
curl() {
  cat > /dev/null
  local d="" a prev=""; for a in "$@"; do case "$prev" in -d) d="$a" ;; esac; prev="$a"; done
  local t; t="$(printf '%s' "$d" | jq -r '.pointer.type // empty')"
  case "$t" in
    vesselCapability) printf '{"content":{"vessels":[{"vesselId":"v"}]}}' ;;
    record_read) if [ -n "$DOWN" ]; then printf '{"error":"down"}'; else jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS"; fi ;;
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
f="$(basename "$2")"; cat "$(dirname "$0")/$f.out" 2>/dev/null
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
DIR="$T/checkout"; mkdir -p "$DIR/src"
export TEST_BASELINE_DIR="$T/baseline"; mkdir -p "$TEST_BASELINE_DIR"
GEN="pull-sync failing-test generator"
HELD="Not yet localized (no source frame in the stack, or an unclassified error): needs a diagnosis of whether the source or the test is wrong before any compose."
held() { # gap_id vessel test_file filed_by [status]
  jq -cn --arg id "$1" --arg v "$2" --arg tf "$3" --arg by "$4" --arg st "${5:-open}" --arg h "$HELD" \
    '{shape: "gap", gap_id: $id, status: $st, category: "failing_test", summary: ("Failing test(s) in " + $tf + ". " + $h + " Done when the named tests pass."),
      writer: "pull-sync", role: "detector",
      meta: {filed_by: $by, evidence_resolve: {shape: "test_suite", input: {vessel: $v, test_file: $tf, only_tests: ["d > one"]}},
             protected_files: [("repos/" + $v + "/" + $tf)], disposition: "needs_information", operator_hold: true, operator_hold_reason: "needs_localization"}}'
}
outcome() { jq -cn --argjson r "$1" --arg ref "$2" --arg role "${3:-person}" '{shape: "outcome", r: $r, input_refs: [$ref], role: $role, writer: "someone"}'; }
reset() { printf '%s\n' "$@" | jq -s -c 'to_entries | map(.value + {id: ("r" + (.key | tostring)), seq: (.key + 1)})' > "$ROWS"; : > "$WRITES"; : > "$LOG"; }
latest() { jq -c --arg id "$1" '[.[] | select(.shape == "gap" and .gap_id == $id)] | sort_by(.seq) | last' "$ROWS"; }
printf 'describe("d", () => {\n  it("one", () => { expect(1).toBe(1); expect(2).toBe(2); });\n  test("two", () => { expect(3).toBe(3); });\n});\n' > "$DIR/src/a.test.ts"

reset "$(held g-a x src/a.test.ts "$GEN")"
lift_held_gaps x 0123456789abcdef "$DIR"
L="$(latest g-a)"
if [ "$(wc -l < "$WRITES")" = 1 ] && printf '%s' "$L" | jq -e '.claim | startswith("The test is right: the source must change so these tests in repos/x/src/a.test.ts pass: d > one")' >/dev/null \
  && printf '%s' "$L" | jq -e --argjson o "$(held g-a x src/a.test.ts "$GEN")" '.status == "open" and .meta == $o.meta and .summary == $o.summary and .category == $o.category' >/dev/null; then
  : > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"
  if [ ! -s "$WRITES" ]; then ok "(a) a held row gets its claim and nothing else changes (still held); it is not written again"; else bad "(a) second call wrote $(cat "$WRITES")"; fi
else bad "(a) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
L="$(latest g-a)"
if printf '%s' "$L" | jq -e '.status == "open" and (.meta | has("operator_hold") or has("disposition") or has("edit_site") | not)
    and .meta.protected_files == ["repos/x/src/a.test.ts"] and .meta.localized_by == "r2" and .meta.baseline == {cases: 2, expects: 3}
    and (.summary | contains("A person judged the test right")) and (.summary | contains("Not yet localized") | not)' >/dev/null; then
  ok "(b) r 1 releases it: unheld, the test still protected, no edit_site, by that outcome, at the file's size"
else bad "(b) latest=$L log=$(cat "$LOG")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
L="$(latest g-a)"
if printf '%s' "$L" | jq -e '.status == "open" and (.meta | has("operator_hold") or has("protected_files") | not)
    and .meta.edit_site == "repos/x/src/a.test.ts" and .meta.claim_rejected_by == "r1" and .meta.baseline == {cases: 2, expects: 3}
    and (.summary | contains("leave the source as it is"))' >/dev/null; then
  ok "(c) r 0 releases it with the test file as edit_site and the test no longer protected"
else bad "(c) latest=$L log=$(cat "$LOG")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 1 r0)" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$(latest g-a | jq -r '.meta.edit_site // "none"')" = "repos/x/src/a.test.ts" ]; then ok "(d) the latest outcome decides"
else bad "(d) latest=$(latest g-a)"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(held g-b x src/a.test.ts "$GEN")" "$(outcome 1 r0 described)" "$(outcome 1 r1)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$(latest g-a | jq -r '.meta.operator_hold')" = true ] && [ "$(latest g-b | jq -r '.meta.operator_hold // "gone"')" = gone ]; then
  ok "(e) an outcome not by a person, or on another gap's row, releases nothing"
else bad "(e) g-a=$(latest g-a) g-b=$(latest g-b)"; fi

reset "$(held g-y y src/a.test.ts "$GEN")" "$(held g-h x src/a.test.ts operator)" "$(held g-c x src/a.test.ts "$GEN" closed)" \
  "$(outcome 1 r0)" "$(outcome 1 r1)" "$(outcome 1 r2)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ]; then ok "(f) another vessel's gap, one the generator did not file, and a closed one are not touched"
else bad "(f) writes=$(cat "$WRITES")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 1 r0)"; DOWN=1
lift_held_gaps x 0123456789abcdef "$DIR"; DOWN=""
if [ ! -s "$WRITES" ] && grep -q 'records unreadable' "$LOG"; then ok "(g) records unreadable: nothing written"
else bad "(g) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

reset "$(held g-a x src/gone.test.ts "$GEN")" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$(latest g-a | jq -r '.meta.operator_hold')" = true ]; then ok "(h) the test file missing from the checkout: the gap stays held"
else bad "(h) latest=$(latest g-a)"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
printf '(pass) d > one\n 1 pass\n 0 fail\n' > "$FAKE/a.test.ts.out"
printf 'describe("d", () => {\n  it("one", () => { expect(1).toBe(1); });\n  test("two", () => { expect(3).toBe(3); });\n});\n' > "$DIR/src/a.test.ts"
: > "$WRITES"; close_failing_test_gaps x 1111111111aaaa "$DIR"
weak="$(wc -l < "$WRITES")"
printf 'describe("d", () => {\n  it("one", () => { expect(1).toBe(1); expect(2).toBe(2); });\n  test("two", () => { expect(3).toBe(3); });\n});\n' > "$DIR/src/a.test.ts"
close_failing_test_gaps x 2222222222bbbb "$DIR"
if [ "$weak" = 0 ] && [ "$(latest g-a | jq -r .status)" = closed ]; then
  ok "(i) the closer leaves a released gap open while its test lost an expect, and closes it at its released size"
else bad "(i) weak-writes=$weak latest=$(latest g-a) log=$(cat "$LOG")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")"
emit_gap "$(jq -cn '{impulse: {pointer: {type: "substrateGap_write", gap: {id: "g-a", status: "open", category: "failing_test", claim: "c",
  summary: "Failing test(s) in src/a.test.ts. '"$HELD"' Done when the named tests pass.",
  classification_metadata: ('"$(held g-a x src/a.test.ts "$GEN" | jq -c .meta)"')}}}}')"
if [ "$(wc -l < "$WRITES")" = 1 ] && [ "$(latest g-a | jq -r .claim)" = c ]; then ok "(j) an emit differing only in its claim writes a new row"
else bad "(j) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
b1="$(latest g-a | jq -c .meta.baseline)"
printf 'describe("d", () => {\n  it("one", () => { expect(1).toBe(1); });\n});\n' > "$DIR/src/a.test.ts"
jq -c --argjson o "$(outcome 0 r0)" '. + [$o + {id: "late", seq: 99}]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
: > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"
L="$(latest g-a)"; : > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"; again="$(wc -l < "$WRITES")"
if printf '%s' "$L" | jq -e --argjson b "$b1" '.meta.edit_site == "repos/x/src/a.test.ts" and .meta.claim_rejected_by == "late" and (.meta | has("localized_by") or has("protected_files") | not)
    and .meta.baseline == $b and $b == {cases: 2, expects: 3} and (.summary | contains("leave the source as it is")) and (.summary | contains("judged the test right") | not)' >/dev/null && [ "$again" = 0 ]; then
  ok "(k) a later outcome re-decides a released gap, keeping the first release's size; the same outcome writes nothing again"
else bad "(k) latest=$L again=$again log=$(cat "$LOG")"; fi

CL="$T/clones"; mkdir -p "$CL/x/src"; cp "$DIR/src/a.test.ts" "$CL/x/src/a.test.ts"
reset "$(held g-a x src/a.test.ts "$GEN")" "$(held g-y y src/a.test.ts "$GEN")" "$(outcome 0 r0)" "$(outcome 0 r1)"
lift_held_gaps_each "$CL"
if [ "$(latest g-a | jq -r '.meta.edit_site // "none"')" = "repos/x/src/a.test.ts" ] && [ "$(latest g-y | jq -r '.meta.operator_hold')" = true ] \
  && grep -q 'y: held-gap release: no clone' "$LOG" \
  && grep -qE '^lift_held_gaps_each "\$CLONE_DIR"' "$SCRIPT" && ! sed -n '/^while IFS=.|. read -r gv gq gh gd/,/^done/p' "$SCRIPT" | grep -q lift_held_gaps; then
  ok "(l) every tick, no gate run: a graded vessel's gap is released against its clone; a vessel with no clone is skipped"
else bad "(l) g-a=$(latest g-a) g-y=$(latest g-y) log=$(cat "$LOG")"; fi

mkdir -p "$DIR/src/lib"
printf 'export const s = 1;\n' > "$DIR/src/lib.ts"; printf 'export const h = 1;\n' > "$DIR/src/helper.test.ts"
printf 'export const i = 1;\n' > "$DIR/src/lib/index.ts"; printf 'x\n' > "$T/outside.ts"
printf '%s\n' 'import { describe, it, expect } from "bun:test";' 'import { s } from "./lib";' 'import { i } from "./lib/index.js";' \
  'import { h } from "./helper.test";' 'import { o } from "../../outside";' 'import { m } from "./missing";' \
  'const late = await import("../src/lib.ts");' 'describe("d", () => { it("one", () => { expect(s).toBe(1); }); });' > "$DIR/src/b.test.ts"
want='["repos/x/src/lib.ts","repos/x/src/lib/index.ts"]'
reset "$(held g-a x src/b.test.ts "$GEN")" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; r1="$(latest g-a | jq -c '.meta.sources')"
reset "$(held g-a x src/b.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; r0="$(latest g-a | jq -c '.meta.sources // "none"')"
old_rel="$(held g-a x src/b.test.ts "$GEN" | jq -c '.meta |= (del(.operator_hold, .operator_hold_reason, .disposition) + {localized_by: "r1", baseline: {cases: 1, expects: 1}})')"
reset "$old_rel" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; back="$(latest g-a | jq -c '[.meta.sources, .meta.localized_by, .meta.baseline]')"
: > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"; again="$(wc -l < "$WRITES")"
if [ "$r1" = "$want" ] && [ "$r0" = '"none"' ] && [ "$back" = "[$want,\"r1\",{\"cases\":1,\"expects\":1}]" ] && [ "$again" = 0 ]; then
  ok "(m) r 1 names the sources the test imports (inside the checkout, no tests); r 0 none; an older r 1 release gets them once"
else bad "(m) r1=$r1 r0=$r0 back=$back again=$again log=$(cat "$LOG")"; fi

gone="$(held g-a x src/gone.test.ts "$GEN" | jq -c '.meta |= (del(.operator_hold, .operator_hold_reason, .disposition) + {localized_by: "r1", baseline: {cases: 1, expects: 1}})')"
reset "$gone" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; first="$(wc -l < "$WRITES")"; gsrc="$(latest g-a | jq -c '.meta.sources')"
: > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"; second="$(wc -l < "$WRITES")"
if [ "$first" = 1 ] && [ "$gsrc" = "[]" ] && [ "$second" = 0 ]; then
  ok "(m) a released gap whose test file is gone gets sources [] once, and is not written again"
else bad "(m) gone: first=$first sources=$gsrc second=$second log=$(cat "$LOG")"; fi

# ── (n)-(p) an open generator gap filed before gaps named their repository names it, once ──────────────────────────
withrepo() { printf '%s' "$1" | jq -c --arg r "$2" '. + {repo: $r}'; }
reset "$(held g-a x src/a.test.ts "$GEN")"
carry_gap_repo
L="$(latest g-a)"
if [ "$(wc -l < "$WRITES")" = 1 ] && printf '%s' "$L" | jq -e --argjson o "$(held g-a x src/a.test.ts "$GEN")" \
    '.repo == "x" and .status == "open" and .meta == $o.meta and .summary == $o.summary and .category == $o.category and .meta.operator_hold == true' >/dev/null; then
  : > "$WRITES"; : > "$LOG"; carry_gap_repo
  # Not again: the carry itself emits nothing for a gap whose latest row names a repo (no log line), so it can never
  # become a periodic write that re-offers the walk a produce; records' dedupe is not what stops it.
  if [ ! -s "$WRITES" ] && ! grep -q 'gap repo carry:' "$LOG"; then ok "(n) an open generator gap with no repo gets one row naming its vessel, everything else (the hold too) as it was; not again, not even emitted"
  else bad "(n) a second call wrote $(cat "$WRITES")"; fi
else bad "(n) writes=$(cat "$WRITES") latest=$L log=$(cat "$LOG")"; fi

NOVESSEL="$(held g-e x src/a.test.ts "$GEN" | jq -c '.meta.evidence_resolve.input.vessel = ""')"
reset "$(withrepo "$(held g-r x src/a.test.ts "$GEN")" x)" "$(held g-c x src/a.test.ts "$GEN" closed)" "$(held g-h x src/a.test.ts operator)" "$NOVESSEL"
carry_gap_repo
if [ ! -s "$WRITES" ]; then ok "(n2) a gap naming a repo, a closed one, one the generator did not file, and one naming no vessel are not written"
else bad "(n2) wrote $(cat "$WRITES")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")"; DOWN=1
carry_gap_repo; DOWN=""
if [ ! -s "$WRITES" ] && grep -q 'gap repo carry: records unreadable' "$LOG"; then ok "(n3) records unreadable: nothing written, and the log says so"
else bad "(n3) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

reset "$(withrepo "$(held g-a x src/a.test.ts "$GEN")" x)" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$(latest g-a | jq -r '.repo // "none"')" = x ] && [ "$(latest g-a | jq -r '.meta.operator_hold // "gone"')" = gone ]; then
  ok "(o) a release keeps the gap's repo"
else bad "(o) latest=$(latest g-a)"; fi

if grep -qE '^carry_gap_repo \|\| true$' "$SCRIPT" && [ "$(grep -nE '^(lift_held_gaps_each "\$CLONE_DIR"|carry_gap_repo \|\| true$)' "$SCRIPT" | cut -d: -f2 | tr '\n' ' ')" = 'lift_held_gaps_each "$CLONE_DIR" || true carry_gap_repo || true ' ]; then
  ok "(p) the tick calls carry_gap_repo, after the release"
else bad "(p) the tick does not call carry_gap_repo after lift_held_gaps_each"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - a person releases a held generator gap, and its fix is held to the test's released size"; exit 0; }
echo "$FAILS FAILED"; exit 1
