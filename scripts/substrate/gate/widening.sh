#!/usr/bin/env bash
# widening.sh — whether a super-repo change widens the gate's authority (H2): the one statement of that rule, read by
# every place that must refuse a widening. candidate.sh asks it at install (base = the accepted sha, policy = the
# accepted copy's); a land onto super asks it before the push (base = the branch it lands on, policy = that base's), so a
# widening is refused before it reaches a public branch, not only when a node would install it.
#
#   widening.sh --policy <gate-policy.json> --super <clone> --base <sha> --head <sha> [--gate-manifest <MANIFEST.json>]
#
# --policy is the BASE's policy (the copy being widened), never the head's: a head may not judge itself.
# --gate-manifest limits the fixture rule to gate paths as that manifest names them ("!" globs excluded), as candidate.sh
# reads them from accepted/; without it every path the policy's fixture_paths match counts.
#
# A widening is any of:
#   - a path matching fixture_paths whose status is not an ordinary one (classifier.fixture_ordinary_status, default A):
#     an accepted fixture edited or removed;
#   - the head's policy dropping a gate_paths or fixture_paths entry the base names;
#   - the head's policy adding a non_root_paths entry;
#   - the head's policy lowering soak_ticks.default or raising soak_ticks.max, or not being a JSON object;
#   - the head's policy calling more fixture changes ordinary than the base's: classifier.fixture_ordinary_status may
#     stay as it is or get shorter; a status the base does not list, a list that is not strings, or no list is a widening.
#
# stdout: one line per widening. Exit 0: none. Exit 1: at least one. Exit 2: it cannot be judged (an unreadable policy,
# a base or head that is not a commit in the clone): a caller refuses on 2 as on 1, never reads it as no widening.
set -uo pipefail
POL=""; SUPER=""; BASE=""; HEAD=""; MAN=""
while [ $# -gt 0 ]; do
  case "$1" in --policy) POL="$2"; shift ;; --super) SUPER="$2"; shift ;; --base) BASE="$2"; shift ;;
    --head) HEAD="$2"; shift ;; --gate-manifest) MAN="$2"; shift ;; esac; shift
done
[ -n "$POL" ] && [ -n "$SUPER" ] && [ -n "$BASE" ] && [ -n "$HEAD" ] \
  || { echo "usage: widening.sh --policy P --super S --base SHA --head SHA [--gate-manifest M]" >&2; exit 64; }
POLICY_REL=scripts/substrate/gate/gate-policy.json
jq -e 'type == "object"' "$POL" >/dev/null 2>&1 || { echo "cannot judge: the base policy $POL is not a readable JSON object"; exit 2; }
for s in "$BASE" "$HEAD"; do
  git -C "$SUPER" cat-file -e "$s^{commit}" 2>/dev/null || { echo "cannot judge: $s is not a commit in $SUPER"; exit 2; }
done

in_globs() { # path globs... -> 0 when any glob matches ('*' crosses '/')
  local p="$1" g; shift
  for g in "$@"; do [[ "$p" == $g ]] && return 0; done; return 1
}
GATE=()
[ -n "$MAN" ] && mapfile -t GATE < <(jq -r '.gate_paths[]?' "$MAN" 2>/dev/null)
is_gate() { # path -> without a manifest, every path; else a manifest gate glob matches and no "!" exclusion does
  [ -n "$MAN" ] || return 0
  local p="$1" g hit=1
  for g in "${GATE[@]}"; do
    if [[ "$g" == '!'* ]]; then [[ "$p" == ${g#!} ]] && return 1; else [[ "$p" == $g ]] && hit=0; fi
  done
  return $hit
}
mapfile -t FIX < <(jq -r '.fixture_paths[]?' "$POL" 2>/dev/null)
mapfile -t ORD < <(jq -r '.classifier.fixture_ordinary_status[]? // empty' "$POL" 2>/dev/null)
[ "${#ORD[@]}" -gt 0 ] || ORD=(A)

WIDEN=()
mapfile -t CHANGED < <(git -C "$SUPER" diff --name-status --no-renames "$BASE" "$HEAD" 2>/dev/null)
for line in "${CHANGED[@]}"; do
  st="${line%%$'\t'*}"; p="${line#*$'\t'}"
  is_gate "$p" || continue
  if [ "${#FIX[@]}" -gt 0 ] && in_globs "$p" "${FIX[@]}"; then in_globs "$st" "${ORD[@]}" || WIDEN+=("$st $p (accepted fixture edited or removed)"); fi
done
# Dropping a protected or fixture glob, or ADDING a non-root exclusion, is a widening, whatever the files say: a head's
# policy may only grow the gated set.
head_pol="$(git -C "$SUPER" show "$HEAD:$POLICY_REL" 2>/dev/null || echo '{}')"
for key in gate_paths fixture_paths; do
  while IFS= read -r dropped; do [ -n "$dropped" ] && WIDEN+=("$POLICY_REL drops $key entry '$dropped'"); done < <(
    jq -r --argjson c "$head_pol" --arg k "$key" '(.[$k] // []) - ($c[$k] // []) | .[]' "$POL" 2>/dev/null)
done
while IFS= read -r added; do [ -n "$added" ] && WIDEN+=("$POLICY_REL adds non_root_paths entry '$added'"); done < <(
  jq -r --argjson c "$head_pol" '($c.non_root_paths // []) - (.non_root_paths // []) | .[]' "$POL" 2>/dev/null)
# The soak may only get STRICTER: lowering the floor (soak_ticks.default) or raising the cap the shaped row may reach
# (soak_ticks.max) relaxes or re-delegates the gate. A head policy that is not a JSON object cannot be compared, so it is
# a widening too (never read as "no change").
if ! jq -e 'type == "object"' >/dev/null 2>&1 <<< "$head_pol"; then
  WIDEN+=("$POLICY_REL is not a JSON object, so its soak_ticks cannot be compared")
else
  while IFS= read -r w; do [ -n "$w" ] && WIDEN+=("$POLICY_REL $w"); done < <(
    jq -r --argjson c "$head_pol" '
      (.soak_ticks.default // 3) as $ad | (.soak_ticks.max // 12) as $am
      | ($c.soak_ticks.default // 3) as $cd | ($c.soak_ticks.max // 12) as $cm
      | (if ($cd | type) != "number" or $cd < $ad then "lowers soak_ticks.default \($ad) -> \($cd)" else empty end),
        (if ($cm | type) != "number" or $cm > $am then "raises soak_ticks.max \($am) -> \($cm)" else empty end)' "$POL" 2>/dev/null)
  # What counts as ordinary may only narrow: a head that adds a status would let the NEXT candidate, judged under it, edit
  # or remove accepted fixtures as ordinary, so the gate could loosen itself in two steps. Compared as the classifier reads
  # each list (an empty one reads as A, above); the head's must be there and be strings, since an absent list hands its
  # meaning to the default in code the same change could edit. So no list says "nothing ordinary": reading [] as none
  # here would change what the classifier itself does with [], so the two change together or not at all.
  while IFS= read -r w; do [ -n "$w" ] && WIDEN+=("$POLICY_REL $w"); done < <(
    jq -r --argjson c "$head_pol" '
      def reads: if type == "array" and length > 0 then . else ["A"] end;
      (.classifier.fixture_ordinary_status | reads) as $b | ($c.classifier.fixture_ordinary_status) as $h
      | if ($h | type) != "array" or ($h | any(type != "string")) then "widens classifier.fixture_ordinary_status \($b) -> \($h | tojson) (not a list of statuses)"
        elif (($h | reads) - $b | length) > 0 then "widens classifier.fixture_ordinary_status \($b) -> \($h)"
        else empty end' "$POL" 2>/dev/null)
fi
[ "${#WIDEN[@]}" -gt 0 ] || exit 0
printf '%s\n' "${WIDEN[@]}"
exit 1
