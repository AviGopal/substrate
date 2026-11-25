#!/usr/bin/env bash
# A person releases a gap the failing-test generator held (scripts/substrate/substrate-pull-sync.sh lift_held_gaps), and
# the closer holds the fix to the test file's size at release (close_failing_test_gaps). Runs the script's own functions
# with curl stubbed as discovery in front of an in-memory records store.
#   (a) a held row with no claim gets one, and localized false on top (work, waiting for no one); a second call writes
#       nothing;
#   (b) a person's r 1 on any row of the gap: open, unheld, protected_files kept, no edit_site, localized_by, the size;
#   (c) a person's r 0: check_runnable false (top level and meta), the test still protected, no edit_site,
#       claim_rejected_by, the size (a change must not edit the check that verifies it);
#   (d) the latest outcome decides;
#   (e) an outcome by anyone but a person, or on another gap's row, releases nothing;
#   (f) another vessel's held gap, a gap the generator did not file, and a closed gap are not touched;
#   (g) records unreadable: nothing written;
#   (h) the test file missing from the checkout: the gap stays held;
#   (j) gap_resolve writes an emit that differs from the latest row only in its claim;
#   (k) a later outcome re-decides a released gap (r 1 then r 0), keeping the size at the first release; the same
#       deciding outcome writes nothing again;
#   (r) a later r 1 clears check_runnable; (s) the fact survives the carry and a second release tick;
#   (l) every tick, with no gate run: lift_held_gaps_each releases each graded vessel's gap against its clone, skips a
#       vessel with no clone, and the tick calls it outside the gate's queue;
#   (m) r 1 names the test's sources (relative imports resolved inside the checkout, no test file, nothing outside it,
#       nothing unresolved); r 0 names none; a gap released r 1 before sources existed gets them once; one whose test
#       file is gone from the checkout is not written at all (see (y));
#   (n) an open generator gap whose latest row names no repo gets one row naming the vessel its evidence runs, the
#       rest of the row (status, summary, meta, any hold) as it was, and not again; (n2) a gap naming a repo, a closed
#       one, one another writer filed, one naming no vessel: nothing; (n3) records unreadable: nothing, logged;
#   (o) a release keeps the repo of the gap; (p) the tick calls carry_gap_repo after the release;
#   (w) a held gap the closer marked not checkable (its named tests absent: no claim, check_runnable false) is not given a
#       claim: a person's word on it would release a gap whose check cannot run;
#   (x) a verdict given before the closer's mark (on an earlier row) does not lift the mark; (x2) nor does one naming the
#       mark row itself (it has no claim to judge); (x5) one naming a row after the mark (tests back, re-armed) releases;
#       (x6) a mark whose row carries check_runnable false only in its meta is still a mark; (x7) [GUARD] after the
#       closer's re-arm (from its mark, so no claim) the claim is stated once, then nothing is written; (x3) a verdict with no seq
#       releases nothing; (x4) a gap with a row with no seq: nothing written,
#       and it is said;
#   (cw) the walk's change_wanted on a gap row decides as a person's outcome does (newest by seq): a site releases the
#       gap there (edit_site), once it is a file of the checkout, not the test, inside the repo; finding none (with a
#       why) leaves it the walk's work, not localized, the why in its claim; one naming neither, not by described, citing no row of the gap, with no seq, or
#       unreadable decides nothing; a parked row (stated, waiting) is written once as work; a site is judged by the
#       file it resolves to (any spelling, a link), and the release names that file; only a person's outcome is r 0,
#       and a person's outcome decides over the walk's, whichever is newer;
#   (i) the closer leaves a released gap open while its test file has fewer expects than at release, and closes it when
#       it has as many;
#   (z) [MUST-FAIL] a gap the walk released at a site, then a new change_wanted naming the same file (any spelling):
#       nothing written, said; [GUARD] a new change_wanted naming another file: released there; [MUST-FAIL] a release
#       the store refuses is said not written and counted so, and is decided again on the next tick; the count line
#       counts writes: a decision refused by the checks is counted not released, never released; [MUST-FAIL] a gap
#       held again after its release (its claim refused, the old site still in its meta) is released again at that site;
#   (y) [MUST-FAIL] a test file on disk but not tracked at HEAD (a build copy, ignored) is never released, by a person's
#       r 1 or the walk's site, and nothing is written for it on a later tick; the closer marks it not checkable, and a
#       tick after the mark writes nothing either, and it is counted not released; the same gap on a tracked file
#       releases as before.
#   (x7) [GUARD] after the closer's re-arm, the claim is stated once and then nothing is written
#   (y2) [MUST-FAIL] a tracked test file missing from the checkout is not released, and is counted not released.
# usage: validation/scripts/pull-sync-held-gap-release.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve emit_gap emit_gap_checked jq_ao test_tracked closer_evidence close_failing_test_gaps test_size test_sources lift_held_gaps lift_held_gaps_each carry_gap_repo; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
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
    record_read) if [ -n "$DOWN" ] || [ "$(printf '%s' "$d" | jq -r .pointer.shape)" = "${DOWN_SHAPE:-}" ]; then printf '{"error":"down"}'; else jq -c --arg s "$(printf '%s' "$d" | jq -r .pointer.shape)" 'map(select(.shape == $s))' "$ROWS"; fi ;;
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
scrubbed_env() { shift; "$@"; }
FAKE="$T/fake"; mkdir -p "$FAKE"
cat > "$FAKE/bun" <<'B'
#!/usr/bin/env bash
f="$(basename "$2")"; cat "$(dirname "$0")/$f.out" 2>/dev/null
B
chmod +x "$FAKE/bun"; BUN_BIN="$FAKE/bun"
DIR="$T/checkout"; mkdir -p "$DIR/src"; git init -q "$DIR"
export TEST_BASELINE_DIR="$T/baseline"; mkdir -p "$TEST_BASELINE_DIR"
# The checkout tracks every file a leg puts in it (git add before each closer call), as a gated vessel's checkout tracks
# its tests: the closer marks a gap on an untracked test file not checkable.
eval "orig_$(declare -f close_failing_test_gaps)"
close_failing_test_gaps() { [ "${3:-}" = "$DIR" ] && git -C "$DIR" add -A; orig_close_failing_test_gaps "$@"; }
eval "orig_$(declare -f lift_held_gaps)"
lift_held_gaps() { [ "${3:-}" = "$DIR" ] && git -C "$DIR" add -A; orig_lift_held_gaps "$@"; }
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
if printf '%s' "$L" | jq -e '.status == "open" and (.meta | has("operator_hold") or has("edit_site") | not)
    and .check_runnable == false and .meta.check_runnable == false and .meta.protected_files == ["repos/x/src/a.test.ts"]
    and .meta.claim_rejected_by == "r1" and .meta.baseline == {cases: 2, expects: 3}
    and (.summary | contains("not worked here")) and (.summary | contains("fix the test at edit_site") | not)' >/dev/null; then
  ok "(c) r 0 releases it as not runnable here: check_runnable false, the test still protected, no edit_site"
else bad "(c) latest=$L log=$(cat "$LOG")"; fi

reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 1 r0)" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$(latest g-a | jq -r '.check_runnable')" = false ] && [ "$(latest g-a | jq -r '.meta.edit_site // "none"')" = none ]; then ok "(d) the latest outcome decides"
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
if printf '%s' "$L" | jq -e --argjson b "$b1" '.check_runnable == false and .meta.claim_rejected_by == "late" and (.meta | has("localized_by") or has("edit_site") | not)
    and .meta.protected_files == ["repos/x/src/a.test.ts"]
    and .meta.baseline == $b and $b == {cases: 2, expects: 3} and (.summary | contains("not worked here")) and (.summary | contains("judged the test right") | not)' >/dev/null && [ "$again" = 0 ]; then
  ok "(k) a later outcome re-decides a released gap, keeping the first release's size; the same outcome writes nothing again"
else bad "(k) latest=$L again=$again log=$(cat "$LOG")"; fi

CL="$T/clones"; mkdir -p "$CL/x/src"; cp "$DIR/src/a.test.ts" "$CL/x/src/a.test.ts"
git -C "$CL/x" init -q && git -C "$CL/x" add src/a.test.ts && git -C "$CL/x" -c user.name=t -c user.email=t@example.invalid commit -qm clone
reset "$(held g-a x src/a.test.ts "$GEN")" "$(held g-y y src/a.test.ts "$GEN")" "$(outcome 0 r0)" "$(outcome 0 r1)"
lift_held_gaps_each "$CL"
if [ "$(latest g-a | jq -r '.check_runnable')" = false ] && [ "$(latest g-y | jq -r '.meta.operator_hold')" = true ] \
  && grep -q 'y: held-gap release: no clone' "$LOG" \
  && grep -qE '^lift_held_gaps_each "\$CLONE_DIR"' "$SCRIPT" && ! sed -n '/^while IFS=.|. read -r gv gq gh gd/,/^done/p' "$SCRIPT" | grep -q lift_held_gaps; then
  ok "(l) every tick, no gate run: a graded vessel's gap is released against its clone; a vessel with no clone is skipped"
else bad "(l) g-a=$(latest g-a) g-y=$(latest g-y) log=$(cat "$LOG")"; fi

# (r) A person's later r 1 clears the fact: the gap is worked again, on the source.
reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
jq -c --argjson o "$(outcome 1 r0)" '. + [$o + {id: "later", seq: 99}]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
lift_held_gaps x 0123456789abcdef "$DIR"
L="$(latest g-a)"
if printf '%s' "$L" | jq -e '(has("check_runnable") | not) and (.meta | has("check_runnable") | not) and .meta.localized_by == "later"' >/dev/null; then
  ok "(r) a later r 1 clears check_runnable: the gap is worked again"
else bad "(r) latest=$L"; fi

# (s) Every other writer of an open gap row carries the fact forward: the carry copies the row whole, and a second
# release tick on the same outcome writes nothing.
reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
: > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"; same="$(wc -l < "$WRITES")"
carry_gap_repo
L="$(latest g-a)"
if [ "$same" = 0 ] && printf '%s' "$L" | jq -e '.repo == "x" and .check_runnable == false and .meta.check_runnable == false' >/dev/null; then
  ok "(s) the fact survives: a second release tick writes nothing, and the carry keeps check_runnable false"
else bad "(s) same=$same latest=$L"; fi

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
if [ "$first" = 0 ] && [ "$gsrc" = "null" ] && [ "$second" = 0 ]; then
  ok "(m) a released gap whose test file is gone is not written, on any tick"
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

# (w) a held gap marked not checkable by the closer gets no claim
reset "$(held g-w x src/a.test.ts "$GEN" | jq -c '.check_runnable = false | .meta += {check_runnable: false, names_absent: ["d > one"], absent_at_head: "0123456789"}')"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ]; then ok "(w) a held gap whose check cannot run is not given a claim"
else bad "(w) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (x) r 1 on the held row, then the closer's mark: no release, the mark stands
mark() { jq -c '. + {check_runnable: false} | .meta += {check_runnable: false, names_absent: ["d > one"], absent_at_head: "0123456789"}'; }
reset "$(held g-x x src/a.test.ts "$GEN")" "$(outcome 1 r0)" "$(held g-x x src/a.test.ts "$GEN" | mark)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && latest g-x | jq -e '.check_runnable == false' >/dev/null; then ok "(x) a verdict from before the mark does not lift it"
else bad "(x) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (x2) the mark, then r 1 naming the mark row itself (the row the surface writes: {shape: outcome, r, input_refs: [row id]})
reset "$(held g-x x src/a.test.ts "$GEN")" "$(held g-x x src/a.test.ts "$GEN" | mark)" "$(outcome 1 r1)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && latest g-x | jq -e '.check_runnable == false' >/dev/null; then ok "(x2) a verdict naming the mark row itself releases nothing"
else bad "(x2) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (x5) the mark, then the re-arm (tests back, red; claim stated again), then r 1 naming the re-arm row: released
rearm() { jq -c '. + {check_runnable: true, claim: "The test is right: ..."} | .meta += {check_runnable: true, names_absent: null, absent_at_head: null}'; }
reset "$(held g-x x src/a.test.ts "$GEN")" "$(held g-x x src/a.test.ts "$GEN" | mark)" "$(held g-x x src/a.test.ts "$GEN" | rearm)" "$(outcome 1 r2)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$(wc -l < "$WRITES")" = 1 ] && latest g-x | jq -e '.meta.localized_by == "r3" and (has("check_runnable") | not) and .meta.check_runnable == null' >/dev/null; then
  ok "(x5) a verdict naming a row after the mark releases"
else bad "(x5) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (x7) [GUARD] the re-arm as the closer writes it (from its own mark, which dropped the claim): the release states the
# claim once, and the next tick writes nothing, so the closer and the release do not answer each other
closer_rearm() { jq -c 'del(.claim, .waits_for) + {check_runnable: true} | .meta += {check_runnable: true, names_absent: null, absent_at_head: null}'; }
stated="$(held g-x x src/a.test.ts "$GEN" | jq -c '. + {claim: "The test is right: ...", waits_for: "person"}')"
reset "$stated" "$(printf '%s' "$stated" | mark | jq -c 'del(.claim)')" "$(printf '%s' "$stated" | mark | closer_rearm)"
lift_held_gaps x 0123456789abcdef "$DIR"; first="$(wc -l < "$WRITES")"; claimed="$(latest g-x | jq -r '.claim // "" | startswith("The test is right: the source must change")')"
: > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$first" = 1 ] && [ "$claimed" = true ] && [ ! -s "$WRITES" ]; then ok "(x7) after the closer's re-arm the claim is stated once, then nothing"
else bad "(x7) first=$first claimed=$claimed second=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (x6) r 1 before a mark that says not checkable only in its meta: no release
reset "$(held g-x x src/a.test.ts "$GEN")" "$(outcome 1 r0)" "$(held g-x x src/a.test.ts "$GEN" | mark | jq -c 'del(.check_runnable)')"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.meta.localized_by != null)) | length == 0' "$WRITES" >/dev/null; then ok "(x6) a mark in the meta alone is still a mark"
else bad "(x6) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (x3) the (x5) verdict with no seq: nothing
reset "$(held g-x x src/a.test.ts "$GEN")" "$(held g-x x src/a.test.ts "$GEN" | mark)" "$(held g-x x src/a.test.ts "$GEN" | rearm)" "$(outcome 1 r2)"
jq -c 'map(if .shape == "outcome" then del(.seq) else . end)' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.meta.localized_by != null or (has("check_runnable") | not))) | length == 0' "$WRITES" >/dev/null; then
  ok "(x3) a verdict with no seq releases nothing"
else bad "(x3) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (x4) a gap row with no seq: nothing written for that gap, and it is said
reset "$(held g-y x src/a.test.ts "$GEN")" "$(outcome 1 r0)"
jq -c 'map(if .shape == "gap" then del(.seq) else . end)' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && grep -q 'gap rows with no seq (g-y)' "$LOG"; then ok "(x4) a gap row with no seq: nothing written, and said"
else bad "(x4) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# (wf) no row waits on a person: none written says waits_for, a person's r 0 included (its check_runnable false stays)
reset "$(held g-a x src/a.test.ts "$GEN")"
lift_held_gaps x 0123456789abcdef "$DIR"
held_wf="$(latest g-a | jq -r '.waits_for // "none"')"
reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
marked_wf="$(latest g-a | jq -r '.waits_for // "none"')"
# released from a held row that already says it waits (as every held row does once its claim is stated)
reset "$(held g-a x src/a.test.ts "$GEN" | jq -c '. + {waits_for: "person"}')" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
released_wf="$(latest g-a | jq -r '.waits_for // "none"')"
if [ "$held_wf" = none ] && [ "$marked_wf" = none ] && [ "$released_wf" = none ]; then
  ok "[MUST-FAIL] (wf1) no row waits for a person: not a stated claim, not a person's r 0, not an r 1 release"
else bad "(wf1) held=$held_wf marked=$marked_wf released=$released_wf log=$(cat "$LOG")"; fi

# (wf2) a stated row written before the top-level fact (a held row with its claim) is written once more with
# localized false on top and no wait, and a row marked r 0 that still says it waits once more without it; then never again
pre_claim="$(held g-a x src/a.test.ts "$GEN" | jq -c '. + {claim: "The test is right: the source must change so these tests in repos/x/src/a.test.ts pass: d > one"}')"
reset "$pre_claim"
lift_held_gaps x 0123456789abcdef "$DIR"; n1="$(wc -l < "$WRITES")"; : > "$WRITES"
lift_held_gaps x 0123456789abcdef "$DIR"; n2="$(wc -l < "$WRITES")"
wf="$(latest g-a | jq -r '.waits_for // "none"')"; wloc="$(latest g-a | jq -r '.localized')"
reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
jq -c 'map(if .shape == "gap" then . + {waits_for: "person"} else . end)' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"; : > "$WRITES"
lift_held_gaps x 0123456789abcdef "$DIR"; m1="$(wc -l < "$WRITES")"; mwf="$(latest g-a | jq -r '.waits_for // "none"')"; : > "$WRITES"
lift_held_gaps x 0123456789abcdef "$DIR"; m2="$(wc -l < "$WRITES")"
if [ "$n1" = 1 ] && [ "$n2" = 0 ] && [ "$wf" = none ] && [ "$wloc" = false ] && [ "$m1" = 1 ] && [ "$mwf" = none ] && [ "$m2" = 0 ]; then
  ok "[MUST-FAIL] (wf2) a row with the old fields is written once in the new form, then not again (held: $n1/$n2, marked: $m1/$m2)"
else bad "(wf2) held $n1/$n2 wf=$wf marked $m1/$m2 wf=$mwf log=$(cat "$LOG")"; fi

# THE NOT-LOCALIZED FACT (the USER: "Read as facts"): the generator now files localized false and no hold; an older row's
# hold whose reason is needs_localization reads as the same fact; a hold for any other reason is not the generator's.
unloc() { held "$@" | jq -c '.meta |= (del(.operator_hold, .operator_hold_reason) + {localized: false})'; }
reset "$(unloc g-n x src/a.test.ts "$GEN")"
lift_held_gaps x 0123456789abcdef "$DIR"; L="$(latest g-n)"
if [ "$(wc -l < "$WRITES")" = 1 ] && printf '%s' "$L" | jq -e '(.claim | startswith("The test is right")) and .waits_for == null and .localized == false and .meta.localized == false and (.meta | has("operator_hold") | not)' >/dev/null; then
  ok "(nf1) a new-form row (localized false, no hold) gets its claim and localized false on top, waits for no one, no hold"
else bad "(nf1) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; L="$(latest g-n)"
if printf '%s' "$L" | jq -e '.meta.localized_by == "r1" and (.meta | has("localized") or has("operator_hold") | not) and (has("check_runnable") | not) and (.meta.sources | type) == "array"' >/dev/null; then
  ok "(nf2) a person's r 1 on a new-form row: localized_by, sources, the fact gone, still work"
else bad "(nf2) $L log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; L="$(latest g-n)"
if printf '%s' "$L" | jq -e '.check_runnable == false and .meta.check_runnable == false and .meta.claim_rejected_by == "r1"' >/dev/null; then
  ok "(nf3) a person's r 0 on a new-form row: check_runnable false (the check is not edited here)"
else bad "(nf3) $L log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(outcome 0 r0 grader)" "$(outcome 0 r0 model)"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.check_runnable == false or .meta.check_runnable == false or .meta.claim_rejected_by != null)) | length == 0' "$WRITES" >/dev/null; then
  ok "(nf4) an r 0 by a grader or a model on the claim sets no check_runnable false: only a person's does"
else bad "(nf4) writes=$(cat "$WRITES")"; fi
other="$(held g-o x src/a.test.ts "$GEN" | jq -c '.meta.operator_hold_reason = "a person is reviewing this gap"')"
reset "$other" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && [ "$(latest g-o | jq -c .meta)" = "$(printf '%s' "$other" | jq -c .meta)" ]; then
  ok "(nf5) a generator gap held for another reason is not read as the fact: no claim, no release, the hold kept"
else bad "(nf5) writes=$(cat "$WRITES")"; fi

# (y) a gap store larger than one argument may be (128 KiB): read whole, the mark decides, and the tick says what it read
# (it was passed to jq as one argument, jq could not start, and every tick read as "no marks")
reset "$(held g-a x src/a.test.ts "$GEN")" "$(outcome 1 r0)"
jq -c --argjson pad "$(held pad y src/b.test.ts "$GEN" closed)" \
  '. + [range(0; 260) as $i | $pad + {gap_id: ("pad-" + ($i | tostring)), id: ("p" + ($i | tostring)), seq: (100 + $i), summary: ($pad.summary + (" filler" * 80))}]' \
  "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
BIG="$(jq -c 'map(select(.shape == "gap"))' "$ROWS" | wc -c)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$BIG" -gt 131072 ] && [ "$(latest g-a | jq -r '.meta.localized_by // "none"')" = r1 ] \
  && grep -q "x: held-gap release: read 261 gap rows, 1 person marks, released 1, stated 0" "$LOG"; then
  ok "(y) a gap store over 128 KiB ($BIG bytes) is read: the person's mark releases the gap, and the tick says what it read and decided"
else bad "(y) store=$BIG bytes latest=$(latest g-a | jq -c "{meta: .meta | del(.evidence_resolve), check_runnable}") log=$(cat "$LOG")"; fi
# (y1) the count line tells a release from a restated claim: a held gap no mark decides is stated, not released
reset "$(held g-a x src/a.test.ts "$GEN")"
lift_held_gaps x 0123456789abcdef "$DIR"
if grep -q "x: held-gap release: read 1 gap rows, 0 person marks, released 0, stated 1" "$LOG"; then
  ok "(y1) a claim stated for an undecided gap is counted as stated, not released"
else bad "(y1) log=$(cat "$LOG")"; fi
# (y2) input jq cannot read is said as unreadable, never as no marks, and nothing is written
reset "$(held g-a x src/a.test.ts "$GEN" | jq -c '.summary = 5')" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && grep -q "x: held-gap release: input unreadable (jq exit" "$LOG"; then
  ok "(y2) a release jq cannot compute is said as input unreadable, and nothing is written"
else bad "(y2) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi

# THE SYSTEM FINDS THE SITE (the "The system finds it" ruling): the walk's change_wanted on a gap row decides as a
# person's outcome does, newest by seq; a site must be a file of the checkout and not the test; finding none leaves the
# gap the walk's work, with no wait on a person.
cw() { # wanted site_or_why ref [role]
  if [ "$1" = true ]; then jq -cn --arg s "$2" --arg ref "$3" --arg role "${4:-described}" '{shape: "change_wanted", wanted: true, repo: "x", edit_site: $s, evidence_refs: ["cs"], input_refs: [$ref], role: $role, writer: "described"}'
  else jq -cn --arg w "$2" --arg ref "$3" --arg role "${4:-described}" '{shape: "change_wanted", wanted: false, why: $w, evidence_refs: ["cs"], input_refs: [$ref], role: $role, writer: "described"}'; fi
}
printf 'export const f = 1;\n' > "$DIR/src/b.ts"; printf 'export const o = 1;\n' > "$T/outside.ts"
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; L="$(latest g-n)"
if printf '%s' "$L" | jq -e '.status == "open" and .meta.edit_site == "repos/x/src/b.ts" and .meta.localized_by == "r1"
    and (has("localized") | not) and (.meta | has("localized") or has("operator_hold") | not) and (has("waits_for") | not)
    and .meta.protected_files == ["repos/x/src/a.test.ts"] and (.meta.sources | type) == "array" and (.meta.baseline | type) == "object"
    and (.summary | contains("The walk found where the change belongs")) and (.summary | contains("A person judged") | not)' >/dev/null; then
  : > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"
  if [ ! -s "$WRITES" ] && grep -q "released g-n at repos/x/src/b.ts by the walk's change_wanted r1" "$LOG"; then
    ok "[MUST-FAIL] (cw1) the walk's site releases the gap there: edit_site, localized_by, the test still protected, sources, the size; not again"
  else bad "(cw1) second tick wrote $(cat "$WRITES") log=$(cat "$LOG")"; fi
else bad "(cw1) $L log=$(cat "$LOG")"; fi
mkdir -p "$DIR/repos/y/src"; cp "$DIR/src/b.ts" "$DIR/repos/y/src/b.ts"   # a path of another repo, present here
for c in "repos/x/src/a.test.ts:its own test file" "repos/x/src/nope.ts:not a file of the checkout" "repos/x/src:not a file of the checkout" "repos/y/src/b.ts:outside repos/x/" \
         "repos/x/../outside.ts:a path that leaves the checkout"; do
  site="${c%%:*}"; why="${c#*:}"
  reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true "$site" r0)"
  lift_held_gaps x 0123456789abcdef "$DIR"
  if [ ! -s "$WRITES" ] && grep -qF "names $site, $why; nothing released" "$LOG" && [ "$(latest g-n | jq -r '.meta.localized_by // "none"')" = none ]; then
    ok "[MUST-FAIL] (cw2) a site that is $why releases nothing, and is said"
  else bad "(cw2) $why: writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
done
rm -rf "$DIR/repos"
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true "" r0 | jq -c 'del(.edit_site)')" "$(cw true "" r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.meta.localized_by != null or .waits_for != null)) | length == 0' "$WRITES" >/dev/null && grep -q "stated 1" "$LOG"; then
  ok "[MUST-FAIL] (cw3) a change_wanted naming no site (or an empty one) decides nothing: the claim is stated, as with no judgment"
else bad "(cw3) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw false "" r0)" "$(cw false "" r0 | jq -c 'del(.why)')"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.meta.unlocalized_by != null or .waits_for != null)) | length == 0' "$WRITES" >/dev/null && grep -q "stated 1" "$LOG"; then
  ok "[MUST-FAIL] (cw3b) a change_wanted finding none with no why (or an empty one) decides nothing"
else bad "(cw3b) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw false "searched src/ for the handler; none" r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; L="$(latest g-n)"
if printf '%s' "$L" | jq -e '.waits_for == null and .localized == false and .meta.localized == false and .meta.unlocalized_by == "r1"
    and (.claim | contains("The walk found no place to change: searched src/ for the handler; none"))
    and (.summary | contains("The walk searched and found no source file"))' >/dev/null && grep -q "released 0, stated 0, found no site 1" "$LOG"; then
  : > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"
  # the row as the no-site branch wrote it before no gap waited on one: the wait and the summary naming a person
  jq -c 'map(if .shape == "gap" then . + {waits_for: "person", summary: "The walk searched and found no source file of the repo this failure comes from: a person judges whether the source or the test is wrong."} else . end)' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
  lift_held_gaps x 0123456789abcdef "$DIR"; back="$(latest g-n | jq -r '.waits_for // "none"')"
  [ "$back" = none ] && ok "[MUST-FAIL] (cw4b) a row that still says it waits for a person is written without it: no gap waits on a person" || bad "(cw4b) waits_for=$back log=$(cat "$LOG")"
  said="$(latest g-n | jq -r '.summary // ""')"
  if [ "$said" = "The walk searched and found no source file of the repo this failure comes from: whether the source or the test is wrong is still open." ]; then
    ok "[GUARD] (cw4d) that row's summary is the no-site text as it reads now, once: no person is named as the judge"
  else bad "(cw4d) summary=$said"; fi
  : > "$WRITES"; : > "$LOG"; lift_held_gaps x 0123456789abcdef "$DIR"
  if [ ! -s "$WRITES" ] && ! grep -q "found no site for g-n" "$LOG"; then ok "[MUST-FAIL] (cw4) the walk finding no site leaves the gap its work (no wait, why in the claim), counted so; not again"
  else bad "(cw4) second tick wrote $(cat "$WRITES") log=$(cat "$LOG")"; fi
else bad "(cw4) $L log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw false "none found" r0)" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; L="$(latest g-n)"
if printf '%s' "$L" | jq -e '.meta.localized_by == "r2" and (has("waits_for") or has("localized") | not) and (.meta | has("unlocalized_by") or has("localized") | not)' >/dev/null; then
  ok "[GUARD] (cw5) a person's r 1 after the walk found none releases it (newest decides)"
else bad "(cw5) $L log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0)" "$(outcome 0 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; L="$(latest g-n)"
if printf '%s' "$L" | jq -e '.check_runnable == false and .meta.claim_rejected_by == "r2" and (.meta | has("edit_site") | not)' >/dev/null; then
  ok "[GUARD] (cw6) a person's later r 0 overrides the walk's site"
else bad "(cw6) $L log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(unloc g-m x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0 walk)" "$(cw true repos/x/src/b.ts r1 | jq -c '.input_refs = ["r9"]')"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.meta.localized_by != null)) | length == 0' "$WRITES" >/dev/null; then
  ok "[GUARD] (cw7) a change_wanted not by described, or citing no row of the gap, releases nothing"
else bad "(cw7) writes=$(cat "$WRITES")"; fi
# (cw8) today's parked rows (claim stated, waits_for person, the fact in meta) are written once as work: localized false
# on top, no wait; then never again
parked="$(unloc g-n x src/a.test.ts "$GEN" | jq -c '. + {waits_for: "person", claim: "The test is right: the source must change so these tests in repos/x/src/a.test.ts pass: d > one"}')"
reset "$parked"
lift_held_gaps x 0123456789abcdef "$DIR"; n1="$(wc -l < "$WRITES")"; L="$(latest g-n)"; : > "$WRITES"
lift_held_gaps x 0123456789abcdef "$DIR"; n2="$(wc -l < "$WRITES")"
if [ "$n1" = 1 ] && [ "$n2" = 0 ] && printf '%s' "$L" | jq -e '.waits_for == null and .localized == false and .meta.localized == false' >/dev/null; then
  ok "[MUST-FAIL] (cw8) a parked row is written once as work (localized false on top, no wait), then not again"
else bad "(cw8) $n1/$n2 $L log=$(cat "$LOG")"; fi
# (cw8b) a row that says localized false on top and still waits (no decision) is written once without the wait
reset "$(unloc g-n x src/a.test.ts "$GEN" | jq -c '. + {localized: false, waits_for: "person", claim: "The test is right: the source must change so these tests in repos/x/src/a.test.ts pass: d > one"}')"
lift_held_gaps x 0123456789abcdef "$DIR"; n1="$(wc -l < "$WRITES")"; L="$(latest g-n)"
if [ "$n1" = 1 ] && printf '%s' "$L" | jq -e '.waits_for == null and .localized == false' >/dev/null; then
  ok "[MUST-FAIL] (cw8b) a stated row still waiting is written once without the wait"
else bad "(cw8b) $n1 $L log=$(cat "$LOG")"; fi
# (cw9) a row saying localized false only on top (as the stated rows carry it) is released by the walk's site
reset "$(held g-n x src/a.test.ts "$GEN" | jq -c '.meta |= del(.operator_hold, .operator_hold_reason) | . + {localized: false}')" "$(cw true repos/x/src/b.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ "$(latest g-n | jq -r '.meta.edit_site // "none"')" = repos/x/src/b.ts ] && [ "$(latest g-n | jq -r 'has("localized")')" = false ]; then
  ok "[MUST-FAIL] (cw9) a row saying localized false only on top is read as not localized, and released at the site"
else bad "(cw9) $(latest g-n) log=$(cat "$LOG")"; fi
# (cw7b) a change_wanted with no seq decides nothing
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0)"
jq -c 'map(if .shape == "change_wanted" then del(.seq) else . end)' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.meta.localized_by != null)) | length == 0' "$WRITES" >/dev/null; then ok "[GUARD] (cw7b) a change_wanted with no seq releases nothing"
else bad "(cw7b) writes=$(cat "$WRITES")"; fi
# (cw10) the walk's judgments unreadable: nothing decided or written, and said (never read as "no judgment")
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0)"; DOWN_SHAPE=change_wanted
lift_held_gaps x 0123456789abcdef "$DIR"; DOWN_SHAPE=""
if [ ! -s "$WRITES" ] && grep -q 'records unreadable' "$LOG"; then ok "[MUST-FAIL] (cw10) the walk's judgments unreadable: nothing written, and said"
else bad "(cw10) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
# (cw4c) a held-form row (the hold, no fact in meta) the walk found no site for says localized false in its meta as well
reset "$(held g-a x src/a.test.ts "$GEN")" "$(cw false "none found" r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if latest g-a | jq -e '.meta.localized == false and .localized == false and .waits_for == null and (.meta | has("operator_hold") | not)' >/dev/null; then
  ok "[MUST-FAIL] (cw4c) a held row the walk found no site for carries the fact (top level and meta), not the hold, and no wait"
else bad "(cw4c) $(latest g-a) log=$(cat "$LOG")"; fi

# A site is judged by the file it resolves to. (cw11, cw12 are qa's probe legs P1, P8.)
for site in repos/x/./src/a.test.ts repos/x/src//a.test.ts; do
  reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true "$site" r0)"
  lift_held_gaps x 0123456789abcdef "$DIR"
  if [ ! -s "$WRITES" ] && grep -q "names $site, its own test file" "$LOG"; then ok "[MUST-FAIL] (cw11) $site, the test by another spelling, releases nothing"
  else bad "(cw11) $site: writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
done
ln -s a.test.ts "$DIR/src/link.ts"
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true repos/x/src/link.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && grep -q "names repos/x/src/link.ts, its own test file" "$LOG"; then ok "[MUST-FAIL] (cw12) a link to the test releases nothing"
else bad "(cw12) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
rm -f "$DIR/src/link.ts"; ln -s ../../outside.ts "$DIR/src/out.ts"
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true repos/x/src/out.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && grep -q "names repos/x/src/out.ts, a path that leaves the checkout" "$LOG"; then ok "[MUST-FAIL] (cw13) a link out of the checkout releases nothing"
else bad "(cw13) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
rm -f "$DIR/src/out.ts"
for site in repos/x/./src//b.ts repos/x/src/../src/b.ts; do
  reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true "$site" r0)"
  lift_held_gaps x 0123456789abcdef "$DIR"
  if latest g-n | jq -e '.meta.edit_site == "repos/x/src/b.ts" and .meta.localized_by == "r1"' >/dev/null && grep -q "released g-n at repos/x/src/b.ts" "$LOG"; then
    ok "[MUST-FAIL] (cw14) $site releases at the file it names, repos/x/src/b.ts"
  else bad "(cw14) $site: $(latest g-n) log=$(cat "$LOG")"; fi
done
# Only a person's outcome is r 0. (cw15, cw17, cw18 are qa's P2, P3, P4.)
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw false "none found" r0 | jq -c '. + {edit_site: "repos/x/src/b.ts"}')"
lift_held_gaps x 0123456789abcdef "$DIR"
if latest g-n | jq -e '.waits_for == null and (.meta | has("edit_site") or has("localized_by") | not) and .meta.unlocalized_by == "r1"' >/dev/null; then
  ok "[MUST-FAIL] (cw15) wanted false carrying a site is no site found, not released at the site"
else bad "(cw15) $(latest g-n)"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw false "" r0 | jq -c 'del(.why) + {edit_site: "repos/x/src/b.ts"}')"
lift_held_gaps x 0123456789abcdef "$DIR"
if jq -se 'map(select(.check_runnable == false or .meta.check_runnable == false or .meta.claim_rejected_by != null or .meta.localized_by != null or .waits_for == "person")) | length == 0' "$WRITES" >/dev/null \
   && ! grep -q "released g-n\|found no site for g-n" "$LOG" && grep -q "stated 1" "$LOG"; then
  ok "[MUST-FAIL] (cw16) a walk row naming neither a site nor a why (a site under wanted false) never judges the test: no check_runnable false, no person wait; the claim is stated as if it were absent"
else bad "(cw16) writes=$(cat "$WRITES") log=$(cat "$LOG")"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
jq -c --argjson c "$(cw false "looked again; none" r0 | jq -c '. + {id: "rz", seq: 99}')" '. + [$c]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
lift_held_gaps x 0123456789abcdef "$DIR"
if latest g-n | jq -e '.waits_for == null and (.meta | has("edit_site") or has("localized_by") | not) and .meta.unlocalized_by == "rz"' >/dev/null; then
  ok "[MUST-FAIL] (cw17) released at a site, then none found: no site or localized_by left"
else bad "(cw17) $(latest g-n)"; fi
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(cw false "none found" r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
jq -c --argjson c "$(cw true repos/x/src/b.ts r0 | jq -c '. + {id: "rz", seq: 99}')" '. + [$c]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
lift_held_gaps x 0123456789abcdef "$DIR"
if latest g-n | jq -e '.meta.edit_site == "repos/x/src/b.ts" and .meta.localized_by == "rz" and (.meta | has("unlocalized_by") | not) and (has("waits_for") | not)' >/dev/null; then
  ok "[MUST-FAIL] (cw18) none found, then a site: released, no unlocalized_by left"
else bad "(cw18) $(latest g-n)"; fi

# (cw19) a person's outcome decides over the walk's judgment, whichever is newer: the two come from separate reads whose
# seqs are not compared
reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(outcome 1 r0)" "$(cw false "none found" r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if latest g-n | jq -e '.meta.localized_by == "r1" and (has("waits_for") | not) and (.meta | has("unlocalized_by") | not)' >/dev/null; then
  reset "$(unloc g-n x src/a.test.ts "$GEN")" "$(outcome 0 r0)" "$(cw true repos/x/src/b.ts r0)"
  lift_held_gaps x 0123456789abcdef "$DIR"
  if latest g-n | jq -e '.meta.claim_rejected_by == "r1" and .check_runnable == false and (.meta | has("edit_site") | not)' >/dev/null; then
    ok "[GUARD] (cw19) a person's outcome decides over a newer walk judgment (r 1 over none, r 0 over a site)"
  else bad "(cw19) r0 then site: $(latest g-n)"; fi
else bad "(cw19) r1 then none: $(latest g-n)"; fi

# (z)
printf 'export const f = 1;\n' > "$DIR/src/b.ts"; printf 'export const g = 1;\n' > "$DIR/src/c.ts"
addcw() { # site seq: a change_wanted citing the gap's latest row
  jq -c --arg s "$1" --argjson q "$2" --arg ref "$(latest g-z | jq -r .id)" \
    '. + [{shape: "change_wanted", wanted: true, repo: "x", edit_site: $s, evidence_refs: ["cs"], input_refs: [$ref], role: "described", writer: "described", id: ("cw" + ($q | tostring)), seq: $q}]' \
    "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
}
reset "$(unloc g-z x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; z1="$(wc -l < "$WRITES")"
addcw repos/x/./src/b.ts 900; : > "$WRITES"; : > "$LOG"
lift_held_gaps x 0123456789abcdef "$DIR"; z2="$(wc -l < "$WRITES")"; zsame="$(grep -c 'names the same site, nothing written' "$LOG")"
zcount="$(grep -c 'released 0, stated 0, found no site 0' "$LOG")"
addcw repos/x/src/c.ts 901; : > "$WRITES"
lift_held_gaps x 0123456789abcdef "$DIR"; z3="$(wc -l < "$WRITES")"; zsite="$(latest g-z | jq -r .meta.edit_site)"
if [ "$z1" = 1 ] && [ "$z2" = 0 ] && [ "$zsame" = 1 ] && [ "$zcount" = 1 ] && [ "$z3" = 1 ] && [ "$zsite" = repos/x/src/c.ts ]; then
  ok "(z) a new change_wanted at the same site writes nothing; one at another file releases there"
else bad "(z) first=$z1 same=$z2 said=$zsame count=$zcount other=$z3 site=$zsite log=$(tail -3 "$LOG")"; fi
# held again (its claim refused) with the released site still in its meta: the same site releases it again
jq -c '. + [(map(select(.gap_id == "g-z")) | sort_by(.seq) | last
  | .id = "rz" | .seq = 950 | .localized = false | .meta.localized = false | .meta.claim_rejected_by = "o9" | del(.meta.localized_by))]' \
  "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
addcw repos/x/src/c.ts 951; : > "$WRITES"
lift_held_gaps x 0123456789abcdef "$DIR"; zre="$(wc -l < "$WRITES")"
if [ "$zre" = 1 ]; then ok "(z) a gap held again after its release is released again at the same site"
else bad "(z) held again, same site: writes=$zre log=$(tail -3 "$LOG")"; fi
reset "$(unloc g-z x src/a.test.ts "$GEN")" "$(cw true repos/x/src/b.ts r0)"
WFAIL=1 lift_held_gaps x 0123456789abcdef "$DIR"
zw="$(grep -c 'g-z not written (the store refused it)' "$LOG")"; zwc="$(grep -c 'released 0, stated 0, found no site 0, not released 0, not written 1' "$LOG")"
: > "$LOG"; lift_held_gaps x 0123456789abcdef "$DIR"; zagain="$(wc -l < "$WRITES")"
if [ "$zw" = 1 ] && [ "$zwc" = 1 ] && [ "$zagain" = 1 ]; then ok "(z) a release the store refuses is said not written, counted so, and decided again next tick"
else bad "(z) refused said=$zw counted=$zwc next=$zagain log=$(tail -3 "$LOG")"; fi
reset "$(unloc g-z x src/a.test.ts "$GEN")" "$(cw true repos/x/src/gone.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"
if grep -q 'released 0, stated 0, found no site 0, not released 1, not written 0' "$LOG"; then ok "(z) a decision the checks refuse is counted not released"
else bad "(z) refused-by-check count: $(tail -2 "$LOG")"; fi
rm -f "$DIR/src/c.ts"

# (y)
printf 'dist/\n' > "$DIR/.gitignore"; mkdir -p "$DIR/dist"; printf 'test("d > one", () => { expect(1).toBe(1) })\n' > "$DIR/dist/u.test.js"
reset "$(held g-u x dist/u.test.js "$GEN")" "$(outcome 1 r0)"
: > "$LOG"; lift_held_gaps x 0123456789abcdef "$DIR"; y1="$(wc -l < "$WRITES")"
ycount="$(grep -c 'released 0, stated 0, found no site 0, not released 1, not written 0' "$LOG")"
lift_held_gaps x 0123456789abcdef "$DIR"; y2="$(wc -l < "$WRITES")"
ylog="$(grep -c 'dist/u.test.js is not tracked' "$LOG")"
reset "$(held g-u x dist/u.test.js "$GEN")" "$(cw true repos/x/src/b.ts r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; y3="$(wc -l < "$WRITES")"
close_failing_test_gaps x 0123456789abcdef "$DIR"; ymark="$(latest g-u | jq -c '[.check_runnable, .meta.operator_hold]')"
: > "$WRITES"; lift_held_gaps x 0123456789abcdef "$DIR"; lift_held_gaps x 0123456789abcdef "$DIR"; y4="$(wc -l < "$WRITES")"
reset "$(held g-u x src/a.test.ts "$GEN")" "$(outcome 1 r0)"
lift_held_gaps x 0123456789abcdef "$DIR"; ytr="$(latest g-u | jq -r '.meta.localized_by // "none"')"
if [ "$y1" = 0 ] && [ "$y2" = 0 ] && [ "$y3" = 0 ] && [ "$ymark" = '[false,true]' ] && [ "$y4" = 0 ] && [ "$ytr" = r1 ] \
   && [ "$ylog" -ge 1 ] && [ "$ycount" = 1 ]; then
  ok "(y) an untracked test file is never released (r 1 or a site) and is counted not released; the closer marks it, nothing more is written; tracked releases"
else bad "(y) logged=$ylog counted=$ycount r1=$y1 again=$y2 site=$y3 mark=$ymark after=$y4 tracked=$ytr log=$(tail -3 "$LOG")"; fi
rm -rf "${DIR:?}/dist" "$DIR/.gitignore"

# (y2) a tracked test file missing from the checkout is not released, and is counted not released
printf 'test("g > one", () => { expect(1).toBe(1) })\n' > "$DIR/src/g.test.ts"
git -C "$DIR" add src/g.test.ts && git -C "$DIR" -c user.name=t -c user.email=t@example.invalid commit -qm g && rm -f "$DIR/src/g.test.ts"
reset "$(held g-g x src/g.test.ts "$GEN")" "$(outcome 1 r0)"
# straight to the release, past this file's wrapper, which stages the tree (and so the file's removal) first
: > "$WRITES"; : > "$LOG"; orig_lift_held_gaps x 0123456789abcdef "$DIR"
if [ ! -s "$WRITES" ] && grep -q 'src/g.test.ts is not in the checkout' "$LOG" \
   && grep -q 'released 0, stated 0, found no site 0, not released 1, not written 0' "$LOG"; then
  ok "(y2) a tracked test file missing from the checkout is not released, and is counted not released"
else bad "(y2) writes=$(cat "$WRITES") log=$(tail -3 "$LOG")"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - a person releases a held generator gap, and its fix is held to the test's released size"; exit 0; }
echo "$FAILS FAILED"; exit 1
