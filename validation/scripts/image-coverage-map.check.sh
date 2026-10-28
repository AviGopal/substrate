#!/usr/bin/env bash
# image-coverage-map.check.sh: the coverage map's claims hold when replayed (slow; not a pre-commit glue test).
#
#   image-coverage-map.check.sh [--all]
#
# For every behaviour/parse entry of scripts/substrate/gate/coverage.json: rebuild the recorded mutation of
# src, confirm it hashes to evidence.mutated_blob (the replay is the proof, not a look-alike), commit it in a
# throwaway worktree and run the accepted corpus with gate/shadow-eval.sh. The claim holds only if every
# named fixture FAILS. Then a negative control: a sample of `none` entries outside the units dir (all of them
# with --all) is mutated the same way, and no fixture may fail; a fixture that does means the map
# undercounts. Also FAILS once an exemption record (units_exempt, converges_today_exempt) has passed its
# expires date: renew it knowingly or build the fixture.
# Positive control first: the unmutated tree must pass the corpus, else no verdict below means anything.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/lib/gate-test-lib.sh"
CM="$ROOT/scripts/substrate/gate/coverage.json"; SE="$ROOT/scripts/substrate/gate/shadow-eval.sh"
git -C "$ROOT" rev-parse --verify -q HEAD >/dev/null || { bad "a git work tree to replay mutations in"; done_tests; }
[ -z "$(git -C "$ROOT" status --porcelain -- scripts/substrate validation/scripts/gate)" ] \
  || echo "  note: uncommitted changes under scripts/substrate or the corpus are not judged; HEAD is"
BASE=$(git -C "$ROOT" rev-parse HEAD)
# The shadow evaluator runs fixtures as nobody when it is root (as in the image), and its sandbox lives
# under TMPDIR: nobody must be able to traverse it, or every fixture exits 126 and nothing is judged.
chmod 0755 "$T"
export TMPDIR="$T"

corpus() { timeout 1800 bash "$SE" --accepted "$ROOT" --super "$ROOT" --candidate "$1" 2>&1; }
failing() { sed -n 's/^FAIL - \([^ ]*\).*/\1/p' | sort | paste -sd, -; }
mutate() { # how src -> mutated content on stdout
  case "$1" in
    'insert `exit 99` after line 1') sed '1a exit 99' "$2" ;;
    'append a syntax error') cat "$2"; printf '\nif then fi ((\n' ;;
    'replace with {}') echo '{}' ;;
    'delete every InaccessiblePaths= line') sed '/^[[:space:]]*InaccessiblePaths[[:space:]]*=/d' "$2" ;;
    'rewrite ExecStart= to /bin/true') sed 's#^\([[:space:]]*ExecStart[[:space:]]*=\).*#\1/bin/true#' "$2" ;;
    'delete every On*= trigger line') sed '/^[[:space:]]*On[A-Za-z]*[[:space:]]*=/d' "$2" ;;
    'rewrite ExecStartPre= to /bin/true') sed 's#^\([[:space:]]*ExecStartPre[[:space:]]*=\).*#\1/bin/true#' "$2" ;;
    *) return 1 ;;
  esac
}
run_mutant() { # src how -> GOT (failing fixtures, "-" for none, ERR) and MBLOB, set in THIS shell
  local W="$T/wt.$RANDOM"; GOT=ERR; MBLOB=""
  git -C "$ROOT" worktree add -q --detach "$W" "$BASE" >/dev/null 2>&1 || return
  if mutate "$2" "$W/$1" > "$T/m"; then
    MBLOB=$(git hash-object "$T/m"); cp "$T/m" "$W/$1"
    git -C "$W" -c user.name=coverage -c user.email=coverage@localhost commit -qam "coverage mutant: $2 $1" >/dev/null
    corpus "$(git -C "$W" rev-parse HEAD)" > "$T/out"
    GOT=$(failing < "$T/out"); GOT="${GOT:--}"
    grep -q '^shadow: ' "$T/out" || GOT=ERR   # a corpus that never reached its verdict judged nothing
  fi
  git -C "$ROOT" worktree remove --force "$W" >/dev/null 2>&1
}

corpus "$BASE" > "$T/pc"
if grep -q '^shadow: .* pass' "$T/pc"; then ok "positive control: the unmutated tree passes the corpus"
else sed -n 's/^/  corpus: /p' "$T/pc" | tail -n 12; bad "positive control: the unmutated tree passes the corpus"; done_tests; fi

# 1. Replay every claim.
while IFS=$'\t' read -r dst src level fixtures how mblob; do
  run_mutant "$src" "$how"; got="$GOT"
  [ "$MBLOB" = "$mblob" ] || echo "  $dst: the replayed mutant hashes to ${MBLOB:0:12}, the proof recorded ${mblob:0:12} (src changed since the proof?)"
  miss=""; IFS=, read -ra fl <<< "$fixtures"
  for x in "${fl[@]}"; do [[ ",$got," == *",$x,"* ]] || miss="$miss $x"; done
  if [ -z "$miss" ]; then ok "$level claim replays: $dst ($fixtures)"
  else echo "  failing under the mutant: $got"; bad "$level claim replays: $dst (did not fail:$miss)"; fi
done < <(jq -r '.paths|to_entries[]|select(.value.level!="none")|[.key,.value.src,.value.level,(.value.fixtures|join(",")),.value.evidence.mutation,.value.evidence.mutated_blob]|@tsv' "$CM")

# 1b. Level honesty for parse claims: a SEMANTIC mutant of a unit file. A parse entry is one whose fixtures notice
#     only syntax; if they also fail the semantic mutant, the entry could earn behaviour (reported, not failed). The
#     two mutants are the ones that matter most: the fleet-wide secrets mask emptied, and a vessel that runs nothing.
while IFS=$'\t' read -r src how; do
  [ -f "$ROOT/$src" ] || continue
  dst=$(jq -r --arg s "$src" '[.paths|to_entries[]|select(.value.src==$s)|.key][0] // empty' "$CM")
  lvl=$(jq -r --arg d "$dst" '.paths[$d].level // "none"' "$CM")
  run_mutant "$src" "$how"; got="$GOT"
  if [ "$got" = ERR ]; then echo "  semantic mutant of $src ($how) could not be judged"
  elif [ "$got" = - ]; then ok "semantic mutant passes the corpus, so $dst stays $lvl (not behaviour): $how"
  else echo "  semantic mutant of $src ($how) FAILS $got: this entry could earn behaviour"; fi
done <<'SEM'
scripts/substrate/units/vessel.d/10-secrets-out-of-reach.conf	delete every InaccessiblePaths= line
scripts/substrate/units/activity-api.service	rewrite ExecStart= to /bin/true
SEM

# 2. Negative control: `none` must mean no fixture notices the mutant.
UDIR=$(jq -r '.units_exempt.dir // "/nonexistent"' "$CM")
mapfile -t NONE < <(jq -r --arg u "$UDIR/" '.paths|to_entries[]|select(.value.level=="none" and (.key|startswith($u)|not))|.value.src' "$CM" | sort -u)
if [ "${1:-}" != --all ]; then
  n="${COVERAGE_NEGATIVE_SAMPLE:-5}"; k=$(( ${#NONE[@]} > 0 ? $(date -u +%j | sed 's/^0*//') % ${#NONE[@]} : 0 ))
  NONE=("${NONE[@]:$k}" "${NONE[@]:0:$k}"); NONE=("${NONE[@]:0:$n}")   # a different window each day
fi
under=0
for src in "${NONE[@]}"; do
  case "$src" in *.json) how='replace with {}' ;; *) how='insert `exit 99` after line 1' ;; esac
  run_mutant "$src" "$how"; got="$GOT"
  if [ "$got" = - ]; then echo "  none holds: $src"
  elif [ "$got" = ERR ]; then echo "  $src: the mutant could not be judged"; under=1; else echo "  $src: mutant FAILS $got, so the map undercounts it"; under=1; fi
done
[ "$under" = 0 ] && ok "none entries stay unnoticed by the corpus (${#NONE[@]} replayed)" || bad "none entries stay unnoticed by the corpus"

# 3. An exemption is a dated decision, not a permanent carve-out.
for rec in units_exempt converges_today_exempt; do
  exp=$(jq -r --arg k "$rec" '.[$k].expires // empty' "$CM")
  if [ -z "$exp" ]; then ok "no $rec record to expire"
  elif [[ "$(date -u +%F)" > "$exp" ]]; then bad "$rec expired on $exp (owner $(jq -r --arg k "$rec" '.[$k].owner_gap' "$CM"))"
  else ok "$rec has not expired ($exp)"; fi
done
done_tests
