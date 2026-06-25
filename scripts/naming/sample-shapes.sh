#!/usr/bin/env bash
# Sample shape names across the codebase and group by suffix pattern.
# Output: markdown to stdout.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "# Shape naming sample"
echo
echo "Source: string literals matching shape grammar found inside \`output_shapes\` / \`input_shapes\` / \`shapes:\` blocks under repos/ (multiline aware), plus any literal ending in a known write-suffix."
echo

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

RG_COMMON=(-I --no-heading
  -g '!**/node_modules/**' -g '!**/dist/**'
  -g '!repos/deployment/vessels/**'
  -t ts -t js -t json)

# Multiline: capture body of output_shapes/input_shapes/shapes arrays.
rg -Uo "${RG_COMMON[@]}" \
  '(output_shapes|input_shapes|shapes)\s*[:=]\s*\[[^\]]*\]' \
  repos/ 2>/dev/null \
  | grep -oE "['\"][a-zA-Z_][a-zA-Z0-9_]*['\"]" \
  | tr -d "'\"" >> "$tmp" || true

# Also harvest any literal that ends in a write-suffix (very high precision for shape names).
rg -o "${RG_COMMON[@]}" \
  "['\"][a-zA-Z_][a-zA-Z0-9_]*_(write|update|deprecate|delete)['\"]" \
  repos/ 2>/dev/null \
  | tr -d "'\"" >> "$tmp" || true

sort -u "$tmp" -o "$tmp"
total=$(wc -l < "$tmp")
echo "**Total distinct shape literals:** $total"
echo

echo "## By suffix"
echo
for suffix in _write _update _deprecate _delete; do
  count=$(grep -cE "${suffix}\$" "$tmp" || true)
  echo "- \`*${suffix}\`: $count"
done
plain=$(grep -cvE "_(write|update|deprecate|delete)\$" "$tmp" || true)
echo "- plain (read shapes): $plain"
echo

echo "## Write shapes"
echo '```'
grep -E "_(write|update|deprecate|delete)\$" "$tmp" || true
echo '```'
echo

echo "## Read shapes (first 80)"
echo '```'
grep -vE "_(write|update|deprecate|delete)\$" "$tmp" | head -80
echo '```'
echo

echo "## Casing"
camel=$(grep -cE "^[a-z][a-zA-Z0-9]*\$" "$tmp" || true)
snake=$(grep -cE "_" "$tmp" | head -1 || true)
echo "- camelCase (no underscore): $camel"
echo "- contains underscore (typically write-suffix): $snake"
