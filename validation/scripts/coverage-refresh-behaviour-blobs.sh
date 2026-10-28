#!/usr/bin/env bash
# coverage-refresh-behaviour-blobs.sh [--write]: for every BEHAVIOUR entry of scripts/substrate/gate/coverage.json whose
# src changed, recompute src_blob and the recorded mutant's blob (evidence.mutated_blob) from the committed file.
# Since in-place-image-convergence 1.3, pull-sync installs a behaviour path only when the staged blob equals src_blob,
# so a commit that changes such a path must carry its refreshed entry. This only RECOMPUTES the hashes; the claim is
# re-EARNED by image-coverage-map.check.sh replaying the mutant against the corpus (run it before pushing).
# Without --write it prints what it would change.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; CM="$ROOT/scripts/substrate/gate/coverage.json"
mutate() { case "$1" in 'insert `exit 99` after line 1') sed '1a exit 99' "$2" ;; 'append a syntax error') cat "$2"; printf '\nif then fi ((\n' ;; 'replace with {}') echo '{}' ;;
  'delete every InaccessiblePaths= line') sed '/^[[:space:]]*InaccessiblePaths[[:space:]]*=/d' "$2" ;;
  'rewrite ExecStart= to /bin/true') sed 's#^\([[:space:]]*ExecStart[[:space:]]*=\).*#\1/bin/true#' "$2" ;;
  'delete every On*= trigger line') sed '/^[[:space:]]*On[A-Za-z]*[[:space:]]*=/d' "$2" ;;
  'rewrite ExecStartPre= to /bin/true') sed 's#^\([[:space:]]*ExecStartPre[[:space:]]*=\).*#\1/bin/true#' "$2" ;;
  *) return 1 ;; esac; }  # the spellings image-coverage-map.check.sh's mutate() replays
upd='{}'; n=0
while IFS=$'\t' read -r dst src blob how; do
  [ -f "$ROOT/$src" ] || continue
  nb="$(git hash-object "$ROOT/$src")"; [ "$nb" = "$blob" ] && continue
  mb="$(mutate "$how" "$ROOT/$src" | git hash-object --stdin)" || { echo "  $dst: unknown mutation '$how'"; continue; }
  echo "  $dst: src_blob ${blob:0:12} -> ${nb:0:12}, mutated_blob -> ${mb:0:12}"
  upd="$(jq -c --arg d "$dst" --arg b "$nb" --arg m "$mb" '. + {($d): {b: $b, m: $m}}' <<<"$upd")"; n=$((n + 1))
done < <(jq -r '.paths|to_entries[]|select(.value.level=="behaviour")|[.key,.value.src,.value.src_blob,.value.evidence.mutation]|@tsv' "$CM")
[ "$n" = 0 ] && { echo "all behaviour proofs match their src"; exit 0; }
if [ "${1:-}" = --write ]; then
  jq --argjson u "$upd" '.paths |= with_entries(if $u[.key] then .value.src_blob = $u[.key].b | .value.evidence.mutated_blob = $u[.key].m else . end)' "$CM" > "$CM.new" && mv "$CM.new" "$CM"
  echo "refreshed $n entr(ies); now replay them: validation/scripts/image-coverage-map.check.sh"
else echo "$n entr(ies) would change (re-run with --write)"; fi
