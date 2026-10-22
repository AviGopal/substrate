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
#              converges-today-uncovered (pull-sync installs it with no fixture only because the optional
#              converges_today_exempt record lists it, with its own owner gap and expiry; with no record no
#              entry may claim it), unreached (baked only, whether or not pull-sync has an installer for it)
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
# A syntax-class mutation cannot earn behaviour for a unit file: a line systemd cannot parse is a syntax error there,
# not a change in what the unit does (exit 99 is a behaviour mutation only in a script).
UNITS_DIR=/usr/lib/systemd/system
sx=$(jq -r --arg u "$UNITS_DIR/" '[.paths|to_entries[]|select((.key|startswith($u)) and .value.level=="behaviour"
        and ((.value.evidence.mutation // "") | test("^insert `exit 99` after line 1$|^append a syntax error$")))|.key]|length' "$CM")
[ "$sx" = 0 ] && ok "no unit path claims behaviour on a syntax-class mutation" || bad "$sx unit path(s) claim behaviour on a syntax-class mutation (that is parse)"

# 3. A reason is a fact about the tree, not a label: gate_paths decides outside-gate-paths, and what
#    pull-sync installs today decides converges-today-uncovered vs unreached. "Installs today" is two facts: an
#    installer exists (image-convergence-surface.test.sh; $T/never lists the paths with none), AND pull-sync's
#    coverage gate would let it through (cov_allows in substrate-pull-sync.sh: level behaviour on the current
#    src blob, or listed in a converges_today_exempt record). The second is mirrored below from this same map.
mapfile -t GLOBS < <(jq -r '.gate_paths[]' "$POL")
in_gate() { local g; for g in "${GLOBS[@]}"; do case "$1" in $g) return 0 ;; esac; done; return 1; }
bash "$HERE/image-convergence-surface.test.sh" 2>/dev/null | sed -n 's/^  never converged: //p' | sort > "$T/never"
[ -s "$T/never" ] || echo "  (note: pull-sync installs every tier A path; no path reads as unreached)"
owned() { jq -e --arg k "$1" '.[$k]|(.owner_gap|type=="string" and length>0) and (.expires|type=="string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))' "$CM" >/dev/null 2>&1; }
UDIR=$(jq -r '.units_exempt.dir // empty' "$CM")
# The units exemption is optional: once a fixture covers the unit files it is deleted, and then no entry may still
# claim units-exempt (a reason with no record behind it would be an exemption nobody owns or dates).
NUE=$(jq '[.paths[]|select(.reason=="units-exempt")]|length' "$CM")
if [ -z "$UDIR" ] && ! jq -e 'has("units_exempt")' "$CM" >/dev/null 2>&1; then
  UDIR="/nonexistent-units-dir"
  [ "$NUE" = 0 ] && ok "no units exemption: no entry claims units-exempt" || bad "no units exemption record, yet $NUE entries claim units-exempt"
elif [ -n "$UDIR" ] && owned units_exempt; then
  ok "the units exemption is a named record with an owner gap and an expiry"
  echo "  units exempt, uncovered: $NUE paths under $UDIR until $(jq -r .units_exempt.expires "$CM") (owner: $(jq -r .units_exempt.owner_gap "$CM"))"
else UDIR="/nonexistent-units-dir"; bad "the units exemption is a named record with an owner gap and an expiry"; fi
# The converges_today_exempt record is optional too. While it exists, every path with an installer and no
# behaviour proof (none in a gate path, or parse) is listed in it by name, owned and dated: that is the debt it
# carries. Its expiry is judged by image-coverage-map.check.sh, so a date does not turn every commit red here.
CTE=0; jq -e 'has("converges_today_exempt")' "$CM" >/dev/null 2>&1 && CTE=1
jq -r 'if has("converges_today_exempt") then (.converges_today_exempt.paths // [])[] else empty end' "$CM" | sort > "$T/cte_list"
# The cov_allows mirror: <dst> installs in place today. An installer exists, and either the record lists it or it
# is behaviour on the current src blob (substrate-pull-sync.sh refuses everything else and leaves it baked).
installs_today() { # dst src level blob
  grep -qxF "$1" "$T/never" && return 1
  [ "$CTE" = 1 ] && grep -qxF "$1" "$T/cte_list" && return 0
  [ "$3" = behaviour ] && [ -f "$ROOT/$2" ] && [ "$(git hash-object "$ROOT/$2" 2>/dev/null)" = "$4" ]
}
# Gate paths with an installer but no behaviour proof: what a record must list while one exists.
: > "$T/parse_inst"; : > "$T/parse_conv"; : > "$T/inst_today"
while IFS=$'\t' read -r pdst psrc plevel pblob; do
  installs_today "$pdst" "$psrc" "$plevel" "$pblob" && echo "$pdst" >> "$T/inst_today"
  [ "$plevel" = parse ] && in_gate "$psrc" || continue
  grep -qxF "$pdst" "$T/never" || echo "$pdst" >> "$T/parse_inst"
  # A parse-level path that pull-sync installs today converges without a behaviour proof: it is debt too.
  installs_today "$pdst" "$psrc" "$plevel" "$pblob" && echo "$pdst" >> "$T/parse_conv"
done < <(jq -r '.paths|to_entries[]|[.key,.value.src,.value.level,(.value.src_blob//"")]|@tsv' "$CM")
NCT=$(jq '[.paths[]|select(.reason=="converges-today-uncovered")]|length' "$CM")
if [ "$CTE" = 0 ]; then
  # No record: nothing converges without a behaviour proof, so no entry may claim converges-today-uncovered
  # and no parse-level path may install today (a reason with no record behind it is an exemption nobody owns).
  if [ "$NCT" = 0 ] && [ ! -s "$T/parse_conv" ]; then ok "no converges-today exemption: no entry claims converges-today-uncovered and no parse path installs today"
  else
    { jq -r '.paths|to_entries[]|select(.value.reason=="converges-today-uncovered")|.key' "$CM"; sed 's/$/ (parse, installs today)/' "$T/parse_conv"; } \
      | head -10 | sed 's/^/  unowned convergence: /'
    bad "no converges-today exemption record, yet $NCT entries claim converges-today-uncovered and $(wc -l < "$T/parse_conv") parse paths install today"
  fi
elif owned converges_today_exempt && diff "$T/cte_list" \
     <( { jq -r '.paths|to_entries[]|select(.value.reason=="converges-today-uncovered")|.key' "$CM"; cat "$T/parse_inst"; } | sort -u) > "$T/cte"; then
  ok "every uncovered converging path is listed in an owned, dated exemption"
  echo "  converges today, uncovered: $(jq '.converges_today_exempt.paths|length' "$CM") paths until $(jq -r .converges_today_exempt.expires "$CM") (owner: $(jq -r .converges_today_exempt.owner_gap "$CM"))"
else head -10 "$T/cte" 2>/dev/null | sed 's/^/  exemption drift: /'; bad "every uncovered converging path is listed in an owned, dated exemption"; fi
echo "  installs in place today: $(wc -l < "$T/inst_today") of $(jq '.paths|length' "$CM") tier A paths (an installer, and behaviour on the current blob or listed in the record)"
rs_bad=0
while IFS=$'\t' read -r dst level reason _ _; do
  src=$(jq -r --arg d "$dst" '.paths[$d].src' "$CM")
  if in_gate "$src"; then
    if [ "$level" = none ]; then
      # With a record, a none path with an installer is its debt (listed above); with none, cov_allows refuses
      # level none, so the path is baked only whether or not it has an installer.
      if [[ "$dst" == "$UDIR"/* ]]; then want=units-exempt
      elif [ "$CTE" = 1 ] && ! grep -qxF "$dst" "$T/never"; then want=converges-today-uncovered; else want=unreached; fi
      [ "$reason" = "$want" ] || { echo "  $dst: reason $reason, but the tree says $want"; rs_bad=1; }
    fi
  else
    [ "$level:$reason" = none:outside-gate-paths ] || { echo "  $dst: src $src is outside gate_paths but reads $level/$reason"; rs_bad=1; }
  fi
done < "$T/rows"
[ "$rs_bad" = 0 ] && ok "every reason matches gate_paths and the installer set" || bad "every reason matches gate_paths and the installer set"

# 4. A BEHAVIOUR proof older than its code freezes that path (pull-sync installs it only on the blob its proof ran
#    on, in-place-image-convergence 1.3), so it fails here: refresh the hashes with coverage-refresh-behaviour-blobs.sh
#    --write and re-earn the claim with image-coverage-map.check.sh in the same commit. A stale parse proof is reported.
stale_b=0
while IFS=$'\t' read -r src blob level; do
  [ -f "$ROOT/$src" ] || continue
  [ "$(git hash-object "$ROOT/$src")" = "$blob" ] && continue
  if [ "$level" = behaviour ]; then echo "  behaviour proof older than src: $src (pull-sync will not install it; re-earn it)"; stale_b=1
  else echo "  coverage evidence older than src: $src (re-run image-coverage-map.check.sh)"; fi
done < <(jq -r '.paths|to_entries[]|select(.value.level!="none")|"\(.value.src)\t\(.value.src_blob)\t\(.value.level)"' "$CM")
[ "$stale_b" = 0 ] && ok "every behaviour proof was earned on the current src blob" || bad "a behaviour proof is older than its src (1.3 leaves that path baked)"
echo "tier A: $(wc -l < "$T/rows") paths; $(jq '[.paths[]|select(.level=="behaviour")]|length' "$CM") behaviour, $(jq '[.paths[]|select(.level=="parse")]|length' "$CM") parse, $(jq '[.paths[]|select(.level=="none")]|length' "$CM") none"
done_tests
