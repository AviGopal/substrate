#!/usr/bin/env bash
# Sample activity/template names from seed templates across vessels.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "# Activity / template naming sample"
echo
echo "Source: \`id:\` and \`name:\` fields in seed-template files under repos/."
echo

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# Look in vessels known to carry seed templates.
roots=(
  repos/minibob/src
  repos/development-vessel
  repos/boredom-vessel
  repos/ribosome-vessel
  repos/ias-executor-ts
)

for root in "${roots[@]}"; do
  [ -d "$root" ] || continue
  grep -rhoE "(^|\s)(id|name)\s*:\s*['\"][a-z][a-z0-9-]*['\"]" \
    --include="*.ts" --include="*.json" "$root" 2>/dev/null \
    | grep -oE "['\"][a-z][a-z0-9-]*['\"]" \
    | tr -d "'\"" \
    | grep -E "-" >> "$tmp" || true
done

sort -u "$tmp" -o "$tmp"
total=$(wc -l < "$tmp")
echo "**Total distinct kebab-case identifiers:** $total"
echo

echo "## By leading verb"
for verb in create make build extract probe verify resolve dispatch select prune replace audit review validate render seed list run check measure; do
  c=$(grep -cE "^${verb}-" "$tmp" || true)
  [ "$c" -gt 0 ] && echo "- \`${verb}-*\`: $c"
done
echo

echo "## Sample (first 80)"
echo '```'
head -80 "$tmp"
echo '```'
echo

echo "## Suffix patterns"
for suffix in -activity -goal -loop -tick -hook -resolver; do
  c=$(grep -cE "${suffix}\$" "$tmp" || true)
  [ "$c" -gt 0 ] && echo "- \`*${suffix}\`: $c"
done
