#!/usr/bin/env bash
# Sample vessel names and one-line descriptions from package.json.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "# Vessel naming sample"
echo
echo "Source: \`repos/*\` directories + each \`package.json\` description."
echo

suffix_count=0
bare_count=0

echo "## Vessels with \`-vessel\` suffix"
echo
for d in repos/*-vessel; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  desc=""
  if [ -f "$d/package.json" ]; then
    desc=$(grep -m1 -oE '"description"\s*:\s*"[^"]*"' "$d/package.json" 2>/dev/null \
      | sed -E 's/.*:\s*"([^"]*)"/\1/' || true)
  fi
  echo "- \`$name\` — ${desc:-(no description)}"
  suffix_count=$((suffix_count + 1))
done
echo

echo "## Bare-name entries (no \`-vessel\` suffix)"
echo
for d in repos/*/; do
  name=$(basename "$d")
  case "$name" in
    *-vessel) continue ;;
  esac
  desc=""
  if [ -f "$d/package.json" ]; then
    desc=$(grep -m1 -oE '"description"\s*:\s*"[^"]*"' "$d/package.json" 2>/dev/null \
      | sed -E 's/.*:\s*"([^"]*)"/\1/' || true)
  fi
  echo "- \`$name\` — ${desc:-(no description / non-JS repo)}"
  bare_count=$((bare_count + 1))
done
echo

echo "## Totals"
echo "- with \`-vessel\` suffix: $suffix_count"
echo "- bare name: $bare_count"
echo
echo "## Convention observed"
echo "- kebab-case throughout"
echo "- \`-vessel\` suffix typically marks a service/HTTP vessel registered with discovery"
echo "- bare names typically mark tools, CLIs, libraries, or legacy product repos"
