#!/usr/bin/env bash
# gate-fixture-unit-semantics.test.sh: the unit fixtures notice the semantic changes that matter, file by file, so a
# unit file can earn level BEHAVIOUR in the coverage map (in-place-image-convergence 1.3 installs only those).
#   (a) CONTROL: the committed tree passes unit-semantics.sh and unit-verify.sh
#   (b) must-fail (qa): one run-dir.conf deleted -> that tick's effective ExecStart runs the clone -> unit-semantics RED
#   (c) must-fail: the canonical secrets drop-in emptied of InaccessiblePaths= -> RED, naming a vessel unit (S1)
#   (d) must-fail: a vessel's ExecStart= rewritten to /bin/true -> RED (E1)
#   (e) must-fail: a timer without its On*= triggers -> unit-verify RED
#   (f) must-fail: a candidate that adds itself to an exemption it cannot reach (the lists are embedded): a vessel
#       listed in vessel.d/EXCEPTIONS with its secrets drop-in removed is still RED
#   (g) the per-file replay: every unit file gets its class mutant (a .service, and a drop-in carrying ExecStart=:
#       every ExecStart= line -> /bin/true; a .timer: every On*= line deleted; a drop-in carrying InaccessiblePaths=:
#       every such line deleted); the files whose mutant a fixture refuses are listed with that fixture. Each is
#       a behaviour claim for the map, to be re-earned in the image by image-coverage-map.check.sh. A mutant that
#       changes nothing, or that no fixture refuses, stays parse. (g) runs only with --emit <file> (about 4 min, one
#       fixture pair per unit file, too slow for every commit's glue run); the claims are written there as TSV
#       (src, mutation, fixtures, mutated_blob) for validation/scripts/coverage-claim-units.sh.
# Mutation spellings are the ones image-coverage-map.check.sh's mutate() replays.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; EMIT=""
[ "${1:-}" = --emit ] && EMIT="$2"
FX="$ROOT/validation/scripts/gate/fixtures"
T="$(mktemp -d "${TMPDIR:-/tmp}/unitsem.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
mk() { rm -rf "$T/c"; mkdir -p "$T/c/scripts"; cp -a "$ROOT/scripts/substrate" "$T/c/scripts/"; }
judge() { # -> the failing fixtures, comma separated, or -
  local r="" x
  for x in unit-semantics.sh unit-verify.sh; do CANDIDATE_DIR="$T/c" bash "$FX/$x" > "$T/$x.out" 2>&1 || r="$r,$x"; done
  r="${r#,}"; echo "${r:--}"; }
mutate() { # <how> <file>: as image-coverage-map.check.sh replays it
  case "$1" in
    'delete every InaccessiblePaths= line') sed '/^[[:space:]]*InaccessiblePaths[[:space:]]*=/d' "$2" ;;
    'rewrite ExecStart= to /bin/true') sed 's#^\([[:space:]]*ExecStart[[:space:]]*=\).*#\1/bin/true#' "$2" ;;
    'delete every On*= trigger line') sed '/^[[:space:]]*On[A-Za-z]*[[:space:]]*=/d' "$2" ;;
  esac; }
U=scripts/substrate/units

mk; got="$(judge)"; [ "$got" = - ] && ok "(a) control: the committed units pass both unit fixtures" || { bad "(a) control: $got failed: $(grep FAIL "$T"/*.out | head -3)"; echo "$FAILS failure(s)"; exit 1; }
mk; rd="$(cd "$T/c/$U" && ls -d *.service.d/run-dir.conf | head -1)"; rm -f "$T/c/$U/$rd"
[[ "$(judge)" == *unit-semantics.sh* ]] && grep -q 'runs the clone' "$T/unit-semantics.sh.out" \
  && ok "(b) deleting $rd makes the tick run the clone, and unit-semantics refuses it by name" || bad "(b) deleting $rd was not refused: $(head -2 "$T/unit-semantics.sh.out")"
mk; mutate 'delete every InaccessiblePaths= line' "$T/c/$U/vessel.d/10-secrets-out-of-reach.conf" > "$T/m" && cat "$T/m" > "$T/c/$U/vessel.d/10-secrets-out-of-reach.conf"
[[ "$(judge)" == *unit-semantics.sh* ]] && grep -q -- '-vessel.service: /workspace/.substrate-secrets is not masked' "$T/unit-semantics.sh.out" \
  && ok "(c) the canonical secrets drop-in emptied is refused, naming the vessels (S1)" || bad "(c) not refused: $(head -2 "$T/unit-semantics.sh.out")"
mk; mutate 'rewrite ExecStart= to /bin/true' "$T/c/$U/discovery-vessel.service" > "$T/m" && cp "$T/m" "$T/c/$U/discovery-vessel.service"
[[ "$(judge)" == *unit-semantics.sh* ]] && grep -q 'discovery-vessel.service: ExecStart=/bin/true does not run substrate code' "$T/unit-semantics.sh.out" \
  && ok "(d) a vessel that runs /bin/true is refused (E1)" || bad "(d) not refused: $(head -2 "$T/unit-semantics.sh.out")"
mk; tm="$(cd "$T/c/$U" && ls *.timer | head -1)"; mutate 'delete every On*= trigger line' "$T/c/$U/$tm" > "$T/m" && cp "$T/m" "$T/c/$U/$tm"
[[ "$(judge)" == *unit-verify.sh* ]] && ok "(e) $tm without its triggers is refused by unit-verify" || bad "(e) $tm without triggers was not refused"
mk; echo "discovery-vessel.service the candidate excuses itself" >> "$T/c/$U/vessel.d/EXCEPTIONS"; rm -f "$T/c/$U/discovery-vessel.service.d/10-secrets-out-of-reach.conf"
[[ "$(judge)" == *unit-semantics.sh* ]] && grep -q 'discovery-vessel.service: /workspace/.substrate-secrets is not masked' "$T/unit-semantics.sh.out" \
  && ok "(f) a candidate cannot excuse itself through the candidate's own EXCEPTIONS" || bad "(f) self-excused: $(head -2 "$T/unit-semantics.sh.out")"

# (g) per-file replay
[ -n "$EMIT" ] || { echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }; }
: > "$T/claims"; declare -A earned=() stays=()
while IFS= read -r rel; do
  f="$ROOT/$U/$rel"
  case "$rel" in
    *.timer) how='delete every On*= trigger line' ;;
    *.service) how='rewrite ExecStart= to /bin/true' ;;
    *.d/*.conf) if grep -q '^[[:space:]]*ExecStart[[:space:]]*=' "$f"; then how='rewrite ExecStart= to /bin/true'
                elif grep -q '^[[:space:]]*InaccessiblePaths[[:space:]]*=' "$f"; then how='delete every InaccessiblePaths= line'
                else stays[$rel]="no semantic mutant for this class"; continue; fi ;;
    *) stays[$rel]="a list file"; continue ;;
  esac
  mutate "$how" "$f" > "$T/m"
  cmp -s "$T/m" "$f" && { stays[$rel]="the mutant changes nothing"; continue; }
  mk; cat "$T/m" > "$T/c/$U/$rel"   # writes through a symlink, as check.sh's replay does
  got="$(judge)"
  if [ "$got" = - ]; then stays[$rel]="no fixture refuses its mutant"; continue; fi
  earned[$rel]="$got"; printf '%s\t%s\t%s\t%s\n' "$U/$rel" "$how" "$got" "$(git hash-object "$T/m")" >> "$T/claims"
done < <(cd "$ROOT/$U" && find . \( -type f -o -type l \) | sed 's#^\./##' | sort)
ne=${#earned[@]}; ns=${#stays[@]}
echo "  earned: $ne (services $(grep -c '\.service	' "$T/claims"), timers $(grep -c '\.timer	' "$T/claims"), drop-ins $(grep -c '\.conf	' "$T/claims"))   stays parse: $ns"
for k in $(printf '%s\n' "${!stays[@]}" | sort); do echo "    parse: $k (${stays[$k]})"; done | head -60
[ "$ne" -gt 0 ] && ok "(g) the per-file replay ran: $ne unit file(s) earn behaviour, $ns stay parse" || bad "(g) no unit file earned behaviour"
[ -n "$EMIT" ] && cp "$T/claims" "$EMIT"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
