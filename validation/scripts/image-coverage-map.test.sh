#!/usr/bin/env bash
# image-coverage-map.test.sh: every tier A image path has one honest coverage entry (pre-commit glue test).
#
# A tooling path may converge in place only where an accepted gate fixture exercises it; a pass that
# exercises nothing is not evidence. scripts/substrate/gate/coverage.json says, per tier A destination of
# scripts/substrate/image-files.manifest, which fixture exercises it and how:
#   behaviour  committing an `exit 99` mutation of the src makes the named fixture(s) FAIL in shadow-eval
#   parse      only a syntax mutation does
#   none       no fixture fails; reason says why it stays baked or why its convergence is uncovered:
#              outside-gate-paths, units-exempt (the named units_exempt record, with owner gap and expiry),
#              converges-today-uncovered (pull-sync installs it with no fixture; each one listed in the
#              converges_today_exempt record, with its own owner gap and expiry), unreached (baked only)
# The mutation proofs and the exemption expiry are judged by image-coverage-map.check.sh (slow, and a date
# must not turn every unrelated commit red). This test keeps
# the map consistent with the manifest, the corpus, gate_paths and what pull-sync installs today, so a
# drift in any of them (a new baked file, a renamed fixture, a newly installed path) turns it red.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/lib/gate-test-lib.sh"
MF="$ROOT/scripts/substrate/image-files.manifest"; CM="$ROOT/scripts/substrate/gate/coverage.json"
POL="$ROOT/scripts/substrate/gate/gate-policy.json"; FX="$ROOT/validation/scripts/gate/fixtures"
for f in "$MF" "$CM" "$POL"; do [ -f "$f" ] || { bad "input present: ${f#$ROOT/}"; done_tests; }; done
jq -e '.paths|type=="object"' "$CM" >/dev/null 2>&1 || { bad "coverage.json parses with a paths object"; done_tests; }

# 1. One entry per tier A destination, both directions.
grep -v '^#' "$MF" | awk -F'\t' '$4=="A"{print $2"\t"$1}' | sort > "$T/want"
jq -r '.paths|to_entries[]|"\(.key)\t\(.value.src)"' "$CM" | sort > "$T/have"
if diff <(cut -f1 "$T/want") <(cut -f1 "$T/have") > "$T/kd"; then ok "one coverage entry per tier A destination"
else head -10 "$T/kd" | sed 's/^/  key drift: /'; bad "one coverage entry per tier A destination"; fi
if diff "$T/want" "$T/have" > "$T/sd"; then ok "every entry's src is the manifest's src"
else grep '^[<>]' "$T/sd" | head -10 | sed 's/^/  src drift: /'; bad "every entry's src is the manifest's src"; fi

# 2. Levels, reasons and fixtures are well formed; a claimed fixture is in the accepted corpus.
jq -r '.paths|to_entries[]|[.key,.value.level,.value.reason,((.value.fixtures//[])|join(",")),(.value.evidence|if type=="object" and (.accepted|type)=="string" and (.mutated_blob|type)=="string" then .accepted else "" end)]|@tsv' "$CM" > "$T/rows" \
  || { bad "coverage.json rows render"; done_tests; }
# A short read would judge a subset and still pass.
[ "$(wc -l < "$T/rows")" = "$(jq '.paths|length' "$CM")" ] || { bad "every coverage entry is judged ($(wc -l < "$T/rows") of $(jq '.paths|length' "$CM") rendered)"; done_tests; }
lvl_bad=0
while IFS=$'\t' read -r dst level reason fixtures evidence; do
  case "$level:$reason" in
    behaviour:mutation-proven|parse:mutation-proven)
      [ -n "$fixtures" ] && [ -n "$evidence" ] || { echo "  $dst: $level needs fixtures and evidence {accepted, mutated_blob}"; lvl_bad=1; }
      IFS=, read -ra fl <<< "$fixtures"
      for x in "${fl[@]}"; do [ -f "$FX/$x" ] || { echo "  $dst: fixture $x is not in the corpus"; lvl_bad=1; }; done ;;
    none:outside-gate-paths|none:converges-today-uncovered|none:unreached|none:units-exempt)
      [ -z "$fixtures" ] || { echo "  $dst: none names fixtures"; lvl_bad=1; } ;;
    *) echo "  $dst: level/reason '$level/$reason' is not a known pair"; lvl_bad=1 ;;
  esac
done < "$T/rows"
[ "$lvl_bad" = 0 ] && ok "levels, reasons and fixtures are well formed" || bad "levels, reasons and fixtures are well formed"

# 3. A reason is a fact about the tree, not a label: gate_paths decides outside-gate-paths, and what
#    pull-sync installs today (image-convergence-surface.test.sh) decides converges-today-uncovered vs unreached.
mapfile -t GLOBS < <(jq -r '.gate_paths[]' "$POL")
in_gate() { local g; for g in "${GLOBS[@]}"; do case "$1" in $g) return 0 ;; esac; done; return 1; }
bash "$HERE/image-convergence-surface.test.sh" 2>/dev/null | sed -n 's/^  never converged: //p' | sort > "$T/never"
[ -s "$T/never" ] || echo "  (note: pull-sync installs every tier A path; no path reads as unreached)"
owned() { jq -e --arg k "$1" '.[$k]|(.owner_gap|type=="string" and length>0) and (.expires|type=="string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))' "$CM" >/dev/null 2>&1; }
UDIR=$(jq -r '.units_exempt.dir // empty' "$CM")
if [ -n "$UDIR" ] && owned units_exempt; then
  ok "the units exemption is a named record with an owner gap and an expiry"
  echo "  units exempt, uncovered: $(jq '[.paths[]|select(.reason=="units-exempt")]|length' "$CM") paths under $UDIR until $(jq -r .units_exempt.expires "$CM") (owner: $(jq -r .units_exempt.owner_gap "$CM"))"
else UDIR="/nonexistent-units-dir"; bad "the units exemption is a named record with an owner gap and an expiry"; fi
# Every path that converges today with no fixture is listed, by name, in its own owned and dated record.
if owned converges_today_exempt && diff <(jq -r '.converges_today_exempt.paths[]?' "$CM" | sort) \
     <(jq -r '.paths|to_entries[]|select(.value.reason=="converges-today-uncovered")|.key' "$CM" | sort) > "$T/cte"; then
  ok "every uncovered converging path is listed in an owned, dated exemption"
  echo "  converges today, uncovered: $(jq '.converges_today_exempt.paths|length' "$CM") paths until $(jq -r .converges_today_exempt.expires "$CM") (owner: $(jq -r .converges_today_exempt.owner_gap "$CM"))"
else head -10 "$T/cte" 2>/dev/null | sed 's/^/  exemption drift: /'; bad "every uncovered converging path is listed in an owned, dated exemption"; fi
rs_bad=0
while IFS=$'\t' read -r dst level reason _ _; do
  src=$(jq -r --arg d "$dst" '.paths[$d].src' "$CM")
  if in_gate "$src"; then
    if [ "$level" = none ]; then
      if [[ "$dst" == "$UDIR"/* ]]; then want=units-exempt
      elif grep -qxF "$dst" "$T/never"; then want=unreached; else want=converges-today-uncovered; fi
      [ "$reason" = "$want" ] || { echo "  $dst: reason $reason, but the tree says $want"; rs_bad=1; }
    fi
  else
    [ "$level:$reason" = none:outside-gate-paths ] || { echo "  $dst: src $src is outside gate_paths but reads $level/$reason"; rs_bad=1; }
  fi
done < "$T/rows"
[ "$rs_bad" = 0 ] && ok "every reason matches gate_paths and the installer set" || bad "every reason matches gate_paths and the installer set"

# 4. Report (not fail) proofs older than the code they were earned on.
jq -r '.paths|to_entries[]|select(.value.level!="none")|"\(.value.src)\t\(.value.src_blob)"' "$CM" | while IFS=$'\t' read -r src blob; do
  [ -f "$ROOT/$src" ] && [ "$(git hash-object "$ROOT/$src")" != "$blob" ] && echo "  coverage evidence older than src: $src (re-run image-coverage-map.check.sh)"
done
echo "tier A: $(wc -l < "$T/rows") paths; $(jq '[.paths[]|select(.level=="behaviour")]|length' "$CM") behaviour, $(jq '[.paths[]|select(.level=="parse")]|length' "$CM") parse, $(jq '[.paths[]|select(.level=="none")]|length' "$CM") none"
done_tests
