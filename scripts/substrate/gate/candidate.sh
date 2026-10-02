#!/usr/bin/env bash
# candidate.sh — the change classifier for gate candidates. Runs FROM accepted/ only (the
# accepted pull-sync calls it); judges a super-repo commit whose gate paths differ from the
# accepted sha. Never installs or runs the candidate itself: shadow-eval.sh does, sandboxed.
#
#   candidate.sh --gate-dir <G> --super <clone> --candidate <sha>
#
# Verdicts (stdout, one per line; `GAP <impulse-json>` lines are filed by the caller):
#   none        the candidate touches no gate path (or IS the accepted sha)
#   widening    it edits/removes an accepted fixture, or drops a gate_paths/fixture_paths
#               entry (H2, the 6ac1aa6 class). Not promotable on parity; P has no criterion
#               yet, so a widening is never promoted here. Gap category authority_widening.
#   refused     shadow evaluation failed, or the candidate cannot be judged (accepted sha has
#               no git identity, or the candidate does not descend from it). Gap.
#   soaking     shadow pass, n of N consecutive ticks
#   promote     shadow pass for N ticks: promote.request written for the runner
# Policy (gate_paths, fixture_paths, classifier, soak_ticks) is read from the ACCEPTED copy.
# Every verdict is also appended to $G/notices.jsonl: the notice humans read without the lane
# (the gap goes through development-vessel and is lost when the lane is down).
set -uo pipefail
G=""; SUPER=""; CAND=""
while [ $# -gt 0 ]; do
  case "$1" in --gate-dir) G="$2"; shift ;; --super) SUPER="$2"; shift ;; --candidate) CAND="$2"; shift ;; esac; shift
done
[ -n "$G" ] && [ -n "$SUPER" ] && [ -n "$CAND" ] || { echo "usage: candidate.sh --gate-dir G --super S --candidate SHA" >&2; exit 64; }
ACC_DIR="$G/accepted"
POLICY_REL=scripts/substrate/gate/gate-policy.json
POL="$ACC_DIR/$POLICY_REL"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACC="$(cat "$G/accepted.sha" 2>/dev/null || true)"
STATE="$G/candidate.json"
c12="${CAND:0:12}"

gap() { # id category summary
  jq -nc --arg id "$1" --arg c "$2" --arg s "$3" --arg cand "$CAND" --arg acc "$ACC" \
    '{impulse:{pointer:{type:"substrateGap_write",gap:{id:$id,category:$c,source:"substrate_detected",summary:$s,
      classification_metadata:{candidate_sha:$cand,accepted_sha:$acc},status:"open"}}}}' | sed 's/^/GAP /'
}
verdict() { # verdict reason [passes]
  local before; before="$(jq -r '"\(.sha) \(.verdict) \(.passes)"' "$STATE" 2>/dev/null || true)"
  jq -nc --arg s "$CAND" --arg v "$1" --arg r "$2" --argjson p "${3:-0}" --arg at "$(date -u +%FT%TZ)" \
    '{sha:$s,verdict:$v,reason:$r,passes:$p,at:$at}' > "$STATE.tmp" && mv -f "$STATE.tmp" "$STATE"
  # Humans read the gate's own store (append-only, no lane dependency): notices.jsonl.
  # One line per change of (sha, verdict, passes): a widening re-judged every tick is noticed once.
  [ "$before" = "$CAND $1 ${3:-0}" ] || jq -c '{at, kind:("candidate_"+.verdict), sha, reason, passes}' "$STATE" >> "$G/notices.jsonl" 2>/dev/null || true
  echo "verdict $1 ${c12}: $2"
}
in_globs() { # path globs... -> 0 when any glob matches ('*' crosses '/')
  local p="$1" g; shift
  for g in "$@"; do [[ "$p" == $g ]] && return 0; done; return 1
}
is_gate() { # path -> a MANIFEST gate glob matches and no "!" exclusion does
  local p="$1" g hit=1
  for g in "${GATE[@]}"; do
    if [[ "$g" == '!'* ]]; then [[ "$p" == ${g#!} ]] && return 1; else [[ "$p" == $g ]] && hit=0; fi
  done
  return $hit
}
mapfile -t GATE < <(jq -r '.gate_paths[]?' "$ACC_DIR/MANIFEST.json" 2>/dev/null)
mapfile -t FIX < <(jq -r '.fixture_paths[]?' "$POL" 2>/dev/null)
mapfile -t ORD < <(jq -r '.classifier.fixture_ordinary_status[]? // empty' "$POL" 2>/dev/null)
[ "${#ORD[@]}" -gt 0 ] || ORD=(A)

[ "$CAND" = "$ACC" ] && { rm -f "$STATE"; echo "verdict none: candidate is the accepted sha"; exit 0; }
if ! git -C "$SUPER" cat-file -e "$ACC^{commit}" 2>/dev/null; then
  verdict refused "accepted sha '$ACC' is not a commit in the mirror (image-restored gate?)"
  gap "gate-accepted-has-no-git-identity" gate_candidate_refused "The accepted gate ($ACC) has no commit identity in $SUPER, so gate candidates cannot be diffed or judged; every gate change is refused until an operator runs gate-runner rollback-gate --to <accepted sha>."
  exit 0
fi
mapfile -t CHANGED < <(git -C "$SUPER" diff --name-status --no-renames "$ACC" "$CAND" 2>/dev/null)
GATE_CHANGED=(); WIDEN=()
for line in "${CHANGED[@]}"; do
  st="${line%%$'\t'*}"; p="${line#*$'\t'}"
  is_gate "$p" || continue
  GATE_CHANGED+=("$st $p")
  if in_globs "$p" "${FIX[@]}"; then in_globs "$st" "${ORD[@]}" || WIDEN+=("$st $p (accepted fixture edited or removed)"); fi
done
[ "${#GATE_CHANGED[@]}" -gt 0 ] || { rm -f "$STATE"; echo "verdict none: no gate path differs from ${ACC:0:12}"; exit 0; }
echo "gate paths changed vs ${ACC:0:12}: ${GATE_CHANGED[*]}"
git -C "$SUPER" merge-base --is-ancestor "$ACC" "$CAND" 2>/dev/null || {
  verdict refused "does not descend from the accepted sha"
  gap "gate-candidate-refused-$c12" gate_candidate_refused "Gate candidate $CAND does not descend from the accepted gate $ACC; it is not judged and not promoted."
  exit 0; }
# Dropping a protected or fixture glob, or ADDING a non-root exclusion, is a widening,
# whatever the files say: a candidate policy may only grow the gated set.
cand_pol="$(git -C "$SUPER" show "$CAND:$POLICY_REL" 2>/dev/null || echo '{}')"
for key in gate_paths fixture_paths; do
  while IFS= read -r dropped; do [ -n "$dropped" ] && WIDEN+=("$POLICY_REL drops $key entry '$dropped'"); done < <(
    jq -r --argjson c "$cand_pol" --arg k "$key" '(.[$k] // []) - ($c[$k] // []) | .[]' "$POL" 2>/dev/null)
done
while IFS= read -r added; do [ -n "$added" ] && WIDEN+=("$POLICY_REL adds non_root_paths entry '$added'"); done < <(
  jq -r --argjson c "$cand_pol" '($c.non_root_paths // []) - (.non_root_paths // []) | .[]' "$POL" 2>/dev/null)
if [ "${#WIDEN[@]}" -gt 0 ]; then
  verdict widening "$(printf '%s; ' "${WIDEN[@]}")"
  gap "gate-candidate-widening-$c12" authority_widening "Gate candidate $CAND widens the accepted gate (${ACC:0:12}): $(printf '%s; ' "${WIDEN[@]}")A widening is judged as such (H2), never promoted on fixture parity; it needs criterion evidence relevant to the newly accepted class, which this slice does not yet provide."
  exit 0
fi
if ! out="$(bash "$HERE/shadow-eval.sh" --accepted "$ACC_DIR" --super "$SUPER" --candidate "$CAND" 2>&1)"; then
  printf '%s\n' "$out" | sed 's/^/shadow: /' | tail -20
  verdict refused "shadow evaluation failed"
  gap "gate-candidate-refused-$c12" gate_candidate_refused "Gate candidate $CAND failed shadow evaluation against the accepted fixture corpus (${ACC:0:12}): $(printf '%s' "$out" | grep -E '^(FAIL|REFUSE)' | head -5 | tr '\n' ' ')"
  exit 0
fi
printf '%s\n' "$out" | sed 's/^/shadow: /' | tail -5
prev="$(jq -r --arg s "$CAND" 'select(.sha==$s and (.verdict=="soaking" or .verdict=="promote")) | .passes' "$STATE" 2>/dev/null || true)"
n=$(( ${prev:-0} + 1 ))
N="$(jq -r '.soak_ticks.default // 3' "$POL" 2>/dev/null)"; case "$N" in ''|*[!0-9]*) N=3 ;; esac
if [ "$n" -lt "$N" ]; then verdict soaking "shadow pass $n/$N" "$n"; exit 0; fi
jq -nc --arg s "$CAND" --arg f "$ACC" --arg t "shadow:${c12}:$n" --arg at "$(date -u +%FT%TZ)" \
  '{sha:$s,from_sha:$f,verdict_trace_id:$t,at:$at}' > "$G/promote.request.tmp" && mv -f "$G/promote.request.tmp" "$G/promote.request"
verdict promote "shadow pass $n/$N — promote.request written" "$n"
