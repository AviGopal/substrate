#!/usr/bin/env bash
# The vessels that read the owner seeder's rows order themselves after it but do not Require it: a seeder run that
# fails (a rerun while records restarts) must never stop them, since systemd does not start a vessel stopped for a
# failed dependency again when the dependency next succeeds.
#   (a) MUST-FAIL: walk-vessel and described-shape-vessel name walk-owner-seed in Wants= and After=, never Requires=
#   (b) no other unit or drop-in Requires= walk-owner-seed (a guard)
set -uo pipefail
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
U="$SRC/scripts/substrate/units"
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
for v in walk-vessel described-shape-vessel; do
  d="$U/$v.service.d/40-after-owner-seed.conf"
  if [ -f "$d" ] && grep -qx 'Wants=walk-owner-seed.service' "$d" && grep -qx 'After=walk-owner-seed.service' "$d" \
     && ! grep -q '^Requires=.*walk-owner-seed' "$d"; then ok "(a) $v wants and follows the seeder, never requires it"
  else bad "(a) $v: $(grep -hE '^(Requires|Wants|After)=' "$d" 2>/dev/null | tr '\n' ' ')"; fi
done
others="$(grep -rlE '^Requires=.*walk-owner-seed' "$U" 2>/dev/null || true)"
[ -z "$others" ] && ok "(b) nothing Requires= the seeder" || bad "(b) still Requires= the seeder: $others"
echo; [ "$FAILS" -eq 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
