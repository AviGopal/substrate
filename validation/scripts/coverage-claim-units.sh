#!/usr/bin/env bash
# coverage-claim-units.sh [--write]: claim level BEHAVIOUR in scripts/substrate/gate/coverage.json for every unit
# file whose semantic mutant a unit fixture refuses. It runs validation/scripts/gate-fixture-unit-semantics.test.sh
# --emit (the per-file replay, about 4 min) and rewrites each claimed entry: level behaviour, reason
# mutation-proven, the refusing fixture(s), and evidence {accepted, mutation, mutated_blob} for the current src blob.
# A claim it wrote earlier that the replay no longer supports is named WITHDRAWN (and left for a parse re-proof).
# This only WRITES the claims; image-coverage-map.check.sh EARNS them, by replaying each mutant against the full
# corpus in the image. Run it again whenever a unit file changes, before that check. Without --write it prints the
# counts it would write.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; CM="$ROOT/scripts/substrate/gate/coverage.json"
T="$(mktemp -d "${TMPDIR:-/tmp}/claimunits.XXXXXX")"; trap 'rm -rf "$T"' EXIT
bash "$ROOT/validation/scripts/gate-fixture-unit-semantics.test.sh" --emit "$T/claims" > "$T/out" 2>&1 \
  || { tail -5 "$T/out"; echo "the unit fixtures' own test failed; no claims written"; exit 1; }
jq -Rn '[inputs | split("\t") | {src: .[0], mutation: .[1], fixtures: (.[2] | split(",")), mutated_blob: .[3]}]' < "$T/claims" > "$T/claims.json"
echo "claims: $(jq length "$T/claims.json") unit file(s)"
[ "${1:-}" = --write ] || { echo "(re-run with --write to put them in the map)"; exit 0; }
ACC="claimed by coverage-claim-units.sh; earned by image-coverage-map.check.sh"
jq --slurpfile c "$T/claims.json" --arg acc "$ACC" '
  ($c[0] | map({key: .src, value: .}) | from_entries) as $by
  | .paths |= with_entries(
      if $by[.value.src] then
        .value.level = "behaviour" | .value.reason = "mutation-proven" | .value.fixtures = $by[.value.src].fixtures
        | .value.evidence = {accepted: $acc, mutation: $by[.value.src].mutation, mutated_blob: $by[.value.src].mutated_blob}
      else . end)' "$CM" > "$CM.new" && mv "$CM.new" "$CM"
# A claim this tool wrote earlier that the replay no longer supports is NAMED, not silently downgraded: its parse
# proof would need a fresh syntax replay, which is image-coverage-map.check.sh's job.
jq -r --slurpfile c "$T/claims.json" --arg acc "$ACC" '($c[0] | map(.src)) as $s | .paths | to_entries[]
  | select(.value.level == "behaviour" and (.value.evidence.accepted // "") == $acc and ((.value.src) as $x | $s | index($x) | not))
  | "  WITHDRAWN: \(.value.src) (its mutant is no longer refused; re-prove it at parse)"' "$CM"
echo "written; now earn them: validation/scripts/image-coverage-map.check.sh (in the image)"
