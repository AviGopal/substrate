#!/usr/bin/env bash
# pull-sync files what its detectors find as records rows (scripts/substrate/substrate-pull-sync.sh gap_resolve):
# nothing serves substrateGap since development-vessel left the image, so a filed gap went nowhere. Runs the script's
# own functions with curl stubbed as discovery in front of an in-memory records store.
#   (a) a gap written once becomes one row (shape gap, role detector); the same gap again writes nothing;
#   (b) a later closed row closes it: the open read leaves it out, the read by id shows it closed;
#   (c) a row with status closed written by the walk (role walk) closes nothing;
#   (d) a 10k-line failing log yields a row under 8 KiB;
#   (e) reads answer as the old store did: {body: {gaps: [...]}}; a write asked for its status code gets 200;
#   (f) the gate exemption (tracked_fail_names) is untouched by a detector row naming a test;
#   (g) a read records answers with an error fails closed: rc 7, and nothing is written;
#   (h) a write records answers with a row not stamped detector (another key's) is a failure, not "ok";
#   (i) a gap's repo is a top-level field of its row, and the same gap again writes nothing;
#   (k) the failing-test generator states repo from the same vessel its evidence_resolve runs (never from the summary),
#       and the script still parses (its jq programs sit in single quotes: a stray quote in one ends the string).
# usage: validation/scripts/pull-sync-gap-rows.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  for f in shape_route gap_resolve dev_resolve tracked_fail_names; do sed -n "/^$f() {/,/^}/p" "$SCRIPT"; done
} > "$T/fns.sh"
grep -q '^gap_resolve()' "$T/fns.sh" && grep -q '^tracked_fail_names()' "$T/fns.sh" \
  || { echo "FAIL - could not extract gap_resolve and tracked_fail_names"; exit 1; }
LOG="$T/log.txt"; log() { echo "$*" >> "$LOG"; }
ROWS="$T/rows.json"; echo '[]' > "$ROWS"; WRITES="$T/writes.txt"; : > "$WRITES"
DISCOVERY=http://discovery.test; SHAPE_ROUTES=" "; SR_ROUTE=""; DEV_VESSEL=""
export METABOB_API_KEY=""
# curl as discovery and records: capability says everything is served; record_read answers the rows of a shape;
# record_write appends the row, stamped with the declared writer and role, and answers it.
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
      echo x >> "$WRITES"; printf '%s' "$row" ;;
    *) printf '{}' ;;
  esac
}
# shellcheck disable=SC1090
source "$T/fns.sh"
gap() { printf '%s' "${3:-a test fails}" > "$T/sum.txt"; jq -cn --arg id "$1" --arg st "$2" --rawfile sum "$T/sum.txt" \
  '{impulse: {pointer: {type: "substrateGap_write", gap: {id: $id, category: "failing_test", source: "substrate_detected", status: $st, summary: $sum, classification_metadata: {filed_by: "pull-sync failing-test generator"}}}}}'; }

dev_resolve "$(gap g1 open)" --max-time 5 > /dev/null
dev_resolve "$(gap g1 open)" --max-time 5 > /dev/null
row="$(jq -c '.[0]' "$ROWS")"
if [ "$(wc -l < "$WRITES")" = 1 ] && [ "$(printf '%s' "$row" | jq -r '.shape + "/" + .role + "/" + .gap_id')" = "gap/detector/g1" ]; then
  ok "(a) a gap is one detector row; the same gap again writes nothing"
else bad "(a) writes=$(wc -l < "$WRITES") rows=$(cat "$ROWS")"; fi

dev_resolve "$(gap g1 closed)" --max-time 5 > /dev/null
open="$(dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","status":"open","limit":50}}}' --max-time 5)"
byid="$(dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","id":"g1","limit":1}}}' --max-time 5)"
if [ "$(printf '%s' "$open" | jq '.body.gaps | length')" = 0 ] && [ "$(printf '%s' "$byid" | jq -r '.body.gaps[0].status')" = closed ]; then
  ok "(b) a later closed row closes it"
else bad "(b) open=$open byid=$byid"; fi

dev_resolve "$(gap g2 open)" --max-time 5 > /dev/null
jq -c '. + [{shape: "gap", gap_id: "g2", status: "closed", id: "forged", seq: 99, writer: "walk-x", role: "walk"}]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
if [ "$(dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","id":"g2","limit":1}}}' --max-time 5 | jq -r '.body.gaps[0].status')" = open ]; then
  ok "(c) a closed row the walk wrote closes nothing"
else bad "(c) $(dev_resolve '{"impulse":{"pointer":{"type":"substrateGap","id":"g2"}}}')"; fi

for i in $(seq 1 10000); do printf 'line %s of a failing log\n' "$i"; done > "$T/sum.txt"
dev_resolve "$(jq -cn --rawfile sum "$T/sum.txt" '{impulse: {pointer: {type: "substrateGap_write", gap: {id: "g3", status: "open", summary: $sum, classification_metadata: {log: $sum}}}}}')" --max-time 5 > /dev/null
size="$(jq -c '[.[] | select(.gap_id == "g3")][0]' "$ROWS" | wc -c)"
if [ "$size" -lt 8192 ]; then ok "(d) a 10k-line log yields a row under 8 KiB ($size bytes)"; else bad "(d) $size bytes"; fi

code="$(dev_resolve "$(gap g4 open)" --max-time 5 -w '\n%{http_code}' | tail -1)"
if [ "$code" = 200 ] && printf '%s' "$open" | jq -e '.body.gaps | type == "array"' >/dev/null; then
  ok "(e) reads answer {body:{gaps}}; a write asked for its status gets 200"
else bad "(e) code=$code open=$open"; fi

jq -c '. + [{shape: "gap", gap_id: "failing-test-x", status: "open", id: "t1", seq: 100, writer: "pull-sync", role: "detector", meta: {evidence_resolve: {shape: "test_suite", input: {vessel: "x", test_file: "a.test.ts", only_tests: ["it works"]}}}}]' "$ROWS" > "$ROWS.new" && mv "$ROWS.new" "$ROWS"
tracked="$(tracked_fail_names x a.test.ts 2>/dev/null)"
if [ -z "$tracked" ]; then ok "(f) the gate exemption is untouched by a detector row naming a test"
else bad "(f) tracked=$tracked"; fi

READ_MODE=""
curl_real="$(declare -f curl)"
eval "$(printf '%s' "$curl_real" | sed 's/^curl ()/curl_store ()/')"
curl() {
  case "$READ_MODE:$*" in
    error:*record_read*) cat > /dev/null; printf '{"error":"x"}' ;;
    person:*record_write*) cat > /dev/null; printf '{"id":"p1","role":"person"}' ;;
    *) curl_store "$@" ;;
  esac
}
before="$(wc -l < "$WRITES")"
withrepo() { gap "$1" open | jq -c --arg r "$2" '.impulse.pointer.gap.repo = $r'; }
w0="$(wc -l < "$WRITES")"
dev_resolve "$(withrepo g7 local-tools-vessel)" --max-time 5 > /dev/null
dev_resolve "$(withrepo g7 local-tools-vessel)" --max-time 5 > /dev/null
r7="$(jq -c '[.[] | select(.gap_id == "g7")] | max_by(.seq)' "$ROWS")"
if [ "$(( $(wc -l < "$WRITES") - w0 ))" = 1 ] && [ "$(printf '%s' "$r7" | jq -r '.repo')" = local-tools-vessel ]; then
  ok "(i) a gap's repo is a top-level field of its row; the same gap again writes nothing"
else bad "(i) writes $(( $(wc -l < "$WRITES") - w0 )), row=$r7"; fi
gen="$(sed -n '/FAILING-TEST GAP GENERATOR/,/^  rm -f "$st"/p' "$SCRIPT")"
if bash -n "$SCRIPT" && printf '%s' "$gen" | grep -q 'evidence_resolve: {shape: "test_suite", input: {vessel: $v,' && printf '%s' "$gen" | grep -qE '^ *repo: \$v,$'; then
  ok "(k) the failing-test generator states repo from the vessel its evidence_resolve runs"
else bad "(k) the script does not parse, or the generator does not set repo: \$v beside evidence_resolve.input.vessel"; fi
before="$(wc -l < "$WRITES")"
READ_MODE=error; dev_resolve "$(gap g5 open)" --max-time 5 > /dev/null; rc=$?
if [ "$rc" = 7 ] && [ "$(wc -l < "$WRITES")" = "$before" ]; then ok "(g) an error answer to the read fails closed: rc 7, nothing written"
else bad "(g) rc=$rc writes $before -> $(wc -l < "$WRITES")"; fi
READ_MODE=person; code="$(dev_resolve "$(gap g6 open)" --max-time 5 -w '\n%{http_code}' | tail -1)"; READ_MODE=""
if [ "$code" = 502 ]; then ok "(h) a row not stamped detector is a failed write (502)"; else bad "(h) code=$code"; fi

echo; [ "$FAILS" = 0 ] && { echo "PASS - pull-sync files its gaps as detector rows in records, deduped, bounded, closed by a later row"; exit 0; }
echo "$FAILS FAILED"; exit 1
