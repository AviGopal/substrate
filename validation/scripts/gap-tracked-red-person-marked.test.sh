#!/usr/bin/env bash
# A check-first red is exempt only by a gap a person marked right (USER ruling 11-23, check-first reds exempt
# only by a person-marked gap). gtr_person_marked (scripts/substrate/lib/gap-tracked-red.sh) reads records rows
# (gap rows as stored, person outcomes) and writes the gaps that exempt, in the form gtr_tracked_names reads.
# Each leg holds one clause of the rule:
#   (a) [MUST-FAIL] an open detector gap with a person's r 1 citing its row is marked, as {id: gap_id, status
#       open, classification_metadata: meta}; with no verdict, or a person's r 0, it is not
#   (b) the latest person verdict citing the gap decides: r 1 then r 0 is not marked; r 0 then r 1 is
#   (c) a verdict citing only rows at or before the closer's latest mark (check_runnable false with names_absent,
#       at the top or in meta) judged other names: not marked; one citing a row after the mark is
#   (d) the gap's latest row decides its status: a later closed row unmarks it
#   (e) only rows of role detector are the gap and only outcomes of role person mark it
#   (f) a gap with a row that has no numeric seq is not marked (the held-gap release reads it the same way)
#   (g) input that is not a list of rows is an error (1), not "nothing marked"
#   (h) a gap a person filed (its latest gap row of role detector or person is the person's, open) is marked by the
#       filing, with that row's names; a later closed row of the person's, or a later detector row, ends that
#   (i) a marked gap's names exempt only when its test file is among the changed files (gtr_tracked_names): the red
#       lines carry no file, so that is how far "for that test file only" reaches
# usage: validation/scripts/gap-tracked-red-person-marked.test.sh   (bash, jq)
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/gtr-pm.XXXXXX")"; trap 'rm -rf "${T:?}"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
# shellcheck disable=SC1091
. "$SRC/scripts/substrate/lib/gap-tracked-red.sh"
declare -F gtr_person_marked >/dev/null || bad "the lib has no gtr_person_marked"

M='{"evidence_resolve":{"shape":"test_suite","input":{"vessel":"repos/v","test_file":"t.test.ts","only_tests":["a"]}}}'
row() { # <gap_id> <id> <seq> [extra json] -> one detector gap row
  local x="${4:-}"; [ -n "$x" ] || x='{}'
  jq -cn --arg g "$1" --arg id "$2" --argjson s "$3" --argjson m "$M" --argjson x "$x" \
    '{shape: "gap", role: "detector", gap_id: $g, id: $id, seq: $s, status: "open", meta: $m} + $x'
}
out() { # <id> <seq> <r> <cited id> [role] -> one outcome row
  jq -cn --arg id "$1" --argjson s "$2" --argjson r "$3" --arg c "$4" --arg role "${5:-person}" \
    '{shape: "outcome", role: $role, id: $id, seq: $s, r: $r, input_refs: [$c]}'
}
marked() { # <gap rows, one per line> <outcome rows, one per line> -> the marked gap ids, space-separated
  printf '%s\n' "$1" | jq -s 'map(select(. != null))' > "$T/g.json"
  printf '%s\n' "$2" | jq -s 'map(select(. != null))' > "$T/o.json"
  gtr_person_marked "$T/g.json" "$T/o.json" "$T/m.json" || { echo "rc$?"; return; }
  jq -r '[.[].id] | join(" ")' "$T/m.json"
}
is() { [ "$2" = "$3" ] && ok "$1" || bad "$1: got '$2', want '$3'"; }

G1="$(row g1 r1 1)"
# (a)
is "(a) [MUST-FAIL] a person's r 1 citing the gap's row marks it" "$(marked "$G1" "$(out p1 2 1 r1)")" g1
gtr_person_marked "$T/g.json" "$T/o.json" "$T/m.json"
is "(a) [MUST-FAIL] in the loaded form: id, status, classification_metadata" \
  "$(jq -c '.[0] | [.id, .status, .classification_metadata.evidence_resolve.input.only_tests[0]]' "$T/m.json")" '["g1","open","a"]'
is "(a) no person verdict: not marked" "$(marked "$G1" "")" ""
is "(a) a person's r 0 (the test is wrong): not marked" "$(marked "$G1" "$(out p1 2 0 r1)")" ""
is "(a) a verdict citing another row: not marked" "$(marked "$G1" "$(out p1 2 1 elsewhere)")" ""
# (b)
is "(b) r 1 then a later r 0: not marked" "$(marked "$G1" "$(out p1 2 1 r1; out p2 3 0 r1)")" ""
is "(b) r 0 then a later r 1: marked" "$(marked "$G1" "$(out p1 2 0 r1; out p2 3 1 r1)")" g1
is "(b) later by seq, not by order in the read: r 0 (seq 3) listed before r 1 (seq 2) is not marked" \
  "$(marked "$G1" "$(out p2 3 0 r1; out p1 2 1 r1)")" ""
# (c)
MK='{"check_runnable":false,"meta":{"names_absent":["a"]}}'
MKM="{\"meta\":$(jq -c '. + {check_runnable: false, names_absent: ["a"]}' <<< "$M")}"
is "(c) a verdict on a row before the closer's mark (top-level check_runnable): not marked" \
  "$(marked "$G1"$'\n'"$(row g1 r2 2 "$MK")" "$(out p1 3 1 r1)")" ""
is "(c) the same, check_runnable in meta: not marked" \
  "$(marked "$G1"$'\n'"$(row g1 r2 2 "$MKM")" "$(out p1 3 1 r1)")" ""
is "(c) a verdict on the mark row itself: not marked" \
  "$(marked "$G1"$'\n'"$(row g1 r2 2 "$MK")" "$(out p1 3 1 r2)")" ""
is "(c) a verdict on a row after the mark: marked" \
  "$(marked "$G1"$'\n'"$(row g1 r2 2 "$MK")"$'\n'"$(row g1 r3 3)" "$(out p1 4 1 r3)")" g1
is "(c) check_runnable false with no names_absent is no mark: a verdict on the first row marks" \
  "$(marked "$G1"$'\n'"$(row g1 r2 2 '{"check_runnable":false}')" "$(out p1 3 1 r1)")" g1
is "(c) the latest mark counts: a verdict between two marks judged other names" \
  "$(marked "$G1"$'\n'"$(row g1 r2 2 "$MK")"$'\n'"$(row g1 r3 3)"$'\n'"$(row g1 r4 4 "$MK")" "$(out p1 5 1 r3)")" ""
# (d)
is "(d) a later closed row unmarks it" "$(marked "$G1"$'\n'"$(row g1 r2 2 '{"status":"closed"}')" "$(out p1 3 1 r1)")" ""
is "(d) a closed row before a reopening one: marked" \
  "$(marked "$(row g1 r1 1 '{"status":"closed"}')"$'\n'"$(row g1 r2 2)" "$(out p1 3 1 r2)")" g1
# (e)
is "(e) a gap row of role walk is no gap" "$(marked "$(row g1 r1 1 '{"role":"walk"}')" "$(out p1 2 1 r1)")" ""
is "(e) a walk's closed row does not close a detector gap" \
  "$(marked "$G1"$'\n'"$(row g1 r2 2 '{"role":"walk","status":"closed"}')" "$(out p1 3 1 r1)")" g1
is "(e) an outcome of role walk marks nothing" "$(marked "$G1" "$(out p1 2 1 r1 walk)")" ""
is "(e) a person's r 2 is not a verdict: the r 1 before it stands" "$(marked "$G1" "$(out p1 2 1 r1; out p2 3 2 r1)")" g1
# (f)
is "(f) a gap with a row lacking a numeric seq is not marked" \
  "$(marked "$G1"$'\n'"$(row g1 r2 '"x"')" "$(out p1 3 1 r1)")" ""
is "(f) another gap's seqless row leaves this one marked" \
  "$(marked "$G1"$'\n'"$(row g2 s1 '"x"')" "$(out p1 3 1 r1)")" g1
# (g)
echo '{"rows":[]}' > "$T/bad.json"; echo '[]' > "$T/empty.json"
gtr_person_marked "$T/bad.json" "$T/empty.json" "$T/m.json"; is "(g) gap input not a list: 1" "$?" 1
gtr_person_marked "$T/empty.json" "$T/bad.json" "$T/m.json"; is "(g) outcome input not a list: 1" "$?" 1
# an object whose values are rows reads like a list to jq's map: it is still not a list of rows
jq -s '{a: .[0]}' <<< "$G1" > "$T/obj.json"; jq -s '{a: .[0]}' <<< "$(out p1 2 1 r1)" > "$T/oobj.json"
printf '%s\n' "$G1" | jq -s . > "$T/g1.json"; printf '%s\n' "$(out p1 2 1 r1)" | jq -s . > "$T/o1.json"
gtr_person_marked "$T/obj.json" "$T/o1.json" "$T/m.json"; is "(g) gap rows as an object of rows: 1" "$?" 1
gtr_person_marked "$T/g1.json" "$T/oobj.json" "$T/m.json"; is "(g) outcomes as an object of rows: 1" "$?" 1
gtr_person_marked "$T/empty.json" "$T/empty.json" "$T/m.json"; is "(g) empty lists: 0, nothing marked" "$?:$(cat "$T/m.json")" "0:[]"

# (h)
P1="$(row g1 r1 1 '{"role":"person"}')"
is "(h) [MUST-FAIL] an open gap a person filed is marked with no verdict" "$(marked "$P1" "")" g1
jq -c '.[0].classification_metadata.evidence_resolve.input.only_tests' "$T/m.json" > "$T/n.txt"
is "(h) a gap a person filed closed is not marked" "$(marked "$(row g1 r1 1 '{"role":"person","status":"closed"}')" "")" ""
is "(h) a person's gap row with no status is not marked" "$(marked "$(row g1 r1 1 '{"role":"person"}' | jq -c 'del(.status)')" "")" ""
is "(h) its names are the filing row's" "$(cat "$T/n.txt")" '["a"]'
is "(h) a later closed row of the person's unmarks it" "$(marked "$P1"$'\n'"$(row g1 r2 2 '{"role":"person","status":"closed"}')" "")" ""
is "(h) a later detector row ends the filing's mark: it needs a person's verdict" \
  "$(marked "$P1"$'\n'"$(row g1 r2 2)" "")" ""
is "(h) ... and a person's r 1 on the detector row marks it" "$(marked "$P1"$'\n'"$(row g1 r2 2)" "$(out p1 3 1 r2)")" g1
is "(h) a later walk row is no gap row: the filing stands" "$(marked "$P1"$'\n'"$(row g1 r2 2 '{"role":"walk","status":"closed"}')" "")" g1
is "(h) [MUST-FAIL] a gap both filed and marked is one gap (its names would otherwise exempt twice)" \
  "$(marked "$P1"$'\n'"$(row g1 r2 2)"$'\n'"$(row g1 r3 3 '{"role":"person"}')" "$(out p1 4 1 r2)")" g1
PB="$(jq -c '.evidence_resolve.input.only_tests = ["b"]' <<< "$M")"
marked "$P1"$'\n'"$(row g1 r2 2)"$'\n'"$(row g1 r3 3 "{\"role\":\"person\",\"meta\":$PB}")" "$(out p1 4 1 r2)" > /dev/null
is "(h) [MUST-FAIL] a filing after a marked detector row: the filing's names, not the detector's" \
  "$(jq -c '[.[] | .classification_metadata.evidence_resolve.input.only_tests]' "$T/m.json")" '[["b"]]'
is "(h) a filed and a marked gap are one gap each" "$(marked "$P1"$'\n'"$(row g2 s1 2)" "$(out p1 3 1 s1)")" "g1 g2"
# (i)
marked "$G1" "$(out p1 2 1 r1)" > /dev/null
is "(i) [GUARD] a marked gap's names, its test file changed" "$(gtr_tracked_names "$T/m.json" v $'src/x.ts\nt.test.ts')" a
is "(i) [GUARD] ... its test file not changed: nothing" "$(gtr_tracked_names "$T/m.json" v $'src/x.ts\nother.test.ts')" ""

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
