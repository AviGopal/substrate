#!/usr/bin/env bash
# Sample resolver class names and impulse-type routing keys.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "# Resolver naming sample"
echo
echo "Source: \`class *Resolver\` declarations and \`type:\` keys in pointer/impulse objects."
echo

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

echo "## Resolver class names"
grep -rhoE "class\s+[A-Z][A-Za-z0-9]*Resolver\b" \
  --include="*.ts" repos/ 2>/dev/null \
  | awk '{print $2}' \
  | sort -u > "$tmp"
count=$(wc -l < "$tmp")
echo
echo "**Total distinct:** $count"
echo
echo '```'
head -60 "$tmp"
echo '```'
echo

echo "## Pointer / impulse \`type\` keys"
grep -rhoE "type\s*:\s*['\"][a-zA-Z_][a-zA-Z0-9_]*['\"]" \
  --include="*.ts" repos/ 2>/dev/null \
  | grep -oE "['\"][a-zA-Z_][a-zA-Z0-9_]*['\"]" \
  | tr -d "'\"" \
  | sort | uniq -c | sort -rn | head -40 > "$tmp"
echo
echo "Top 40 by frequency:"
echo '```'
cat "$tmp"
echo '```'
echo

echo "## Convention observed"
echo "- Class names: PascalCase + \`Resolver\` suffix"
echo "- Routing keys: camelCase nouns matching the shape they own"
echo "- A resolver typically owns shapes with matching prefix (e.g. \`ActivityTemplateResolver\` owns \`activityTemplate*\`)"
