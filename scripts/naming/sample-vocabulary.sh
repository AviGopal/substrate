#!/usr/bin/env bash
# Sample the distinctive internal vocabulary of the system from CLAUDE.md
# and the foundation doc. Used as context when picking system/brand names.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "# System vocabulary sample"
echo
echo "Source: CLAUDE.md + docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md"
echo "Method: extract terms emphasized via **bold**, headers, and high-frequency capitalized nouns."
echo

corpus=(CLAUDE.md docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
existing=()
for f in "${corpus[@]}"; do
  [ -f "$f" ] && existing+=("$f")
done

echo "## Bolded / emphasized terms"
echo '```'
grep -hoE '\*\*[A-Z][a-zA-Z-]+\*\*' "${existing[@]}" 2>/dev/null \
  | tr -d '*' | sort | uniq -c | sort -rn | head -40
echo '```'
echo

echo "## Distinctive nouns (high-frequency, lowercase, domain-specific)"
echo '```'
grep -hoE '\b(impulse|activity|vessel|substrate|ribosome|becoming|trace|posterior|thompson|percolation|lift|resolver|shape|boredom|improvise|topology|discovery|composition|verifier|enrichment|seeding|anchor|cooperation|federation)\b' \
  "${existing[@]}" 2>/dev/null \
  | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn | head -25
echo '```'
echo

echo "## Existing brand family"
echo '```'
grep -hoE '\b(metabob|minibob|devbob|bob)\b' "${existing[@]}" 2>/dev/null \
  | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn
echo '```'
echo

echo "## Philosophical framing phrases (verbatim)"
echo '```'
grep -hoE '(process-of-becoming|continuous (transformation|evolution)|self-improving|push-away|adversarial-resistant|measured outcomes|trace store|pattern learner|active push-away)' \
  "${existing[@]}" 2>/dev/null \
  | sort | uniq -c | sort -rn
echo '```'
