#!/usr/bin/env bash
# retired-vessels-stay-retired.test.sh: a vessel the inventory marks "retired": true never runs, and no
# operator-facing roster offers it.
#
#   bash validation/scripts/retired-vessels-stay-retired.test.sh [repo-root]
#
# WHY A MARKER AND NOT A DELETION. apply-inventory can only govern units the inventory names: a shipped
# unit absent from `vessels` is not masked, it runs in every profile (apply-inventory only warns about
# it). So a vessel whose unit file still ships is retired by keeping its entry with "retired": true,
# which apply-inventory treats as never desired: masked on every boot, whatever PROFILE, ENABLED_ROLES,
# ENABLED_VESSELS or ENABLED_EXTRA_VESSELS say.
#
# WHAT IT CHECKS.
#   1. apply-inventory, against a fixture inventory (DRY_RUN=1, so nothing on the host is touched):
#      the retired unit is planned for disable+mask under no selection, an explicit ENABLED_VESSELS
#      naming it, a unit-list PROFILE naming it, ENABLED_ROLES covering its role, and
#      ENABLED_EXTRA_VESSELS naming it; the live sibling unit is never planned for disable.
#   2. The tree: for every retired unit in scripts/substrate/vessels.inventory.json, its entry carries no
#      health_port (nothing publishes or probes a port for it), no profile (unit list or composed) names
#      it, no README.md table row (the port and profile tables) names it by unit name or by its short
#      name (`analysis` for analysis-vessel), and its unit name appears in none of the other operator
#      rosters: docker-compose.yml, scripts/substrate/substrate-status.sh, scripts/substrate/gen-env.sh,
#      scripts/substrate/deploy-hub.sh, scripts/substrate/reseed-restart.sh. Prose outside README tables
#      may say a vessel is retired. A negative fixture tree proves each of those is detected.
# Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
AI="$ROOT/scripts/substrate/apply-inventory.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fails=$((fails + 1)); }

echo "== retired-vessels-stay-retired ($ROOT)"

# ── 1. apply-inventory masks a retired unit under every selection ───────────────
cat > "$T/inv.json" <<'EOF'
{
  "roles": { "full": ["compute", "store"], "hub": ["store"] },
  "composed_profiles": { "withcompute": { "roles": ["store"], "vessels": ["live-vessel.service"] } },
  "profiles": { "both": ["live-vessel.service", "old-vessel.service"] },
  "vessels": [
    { "unit": "live-vessel.service", "role": "compute" },
    { "unit": "old-vessel.service", "role": "compute", "retired": true },
    { "unit": "store-vessel.service", "role": "store" }
  ]
}
EOF
plan() { # <label> [VAR=value ...] -> apply-inventory's dry-run log in $T/<label>.log
  local label="$1"; shift
  env -i HOME="$T" PATH="$PATH" VESSELS_INVENTORY="$T/inv.json" DRY_RUN=1 "$@" bash "$AI" > "$T/$label.log" 2>&1
}
check_plan() { # <label> [VAR=value ...]
  local label="$1"
  plan "$@"
  if grep -q 'would disable: old-vessel.service' "$T/$label.log" && ! grep -q 'would disable: live-vessel.service' "$T/$label.log"; then
    ok "$label: the retired unit is planned for disable+mask; the live one is not"
  else
    bad "$label: expected 'would disable: old-vessel.service' and never live-vessel.service; got: $(grep -E 'would disable|FATAL' "$T/$label.log" | tr '\n' ';')"
  fi
}
check_plan "no selection (default: every unit)"
check_plan "ENABLED_VESSELS names it" ENABLED_VESSELS=live-vessel,old-vessel
check_plan "a unit-list PROFILE names it" PROFILE=both
check_plan "ENABLED_ROLES covers its role" ENABLED_ROLES=compute
check_plan "ENABLED_EXTRA_VESSELS names it" PROFILE=withcompute ENABLED_EXTRA_VESSELS=old-vessel

# ── 2. the tree offers no retired unit ──────────────────────────────────────────
ROSTERS=(docker-compose.yml scripts/substrate/substrate-status.sh scripts/substrate/gen-env.sh scripts/substrate/deploy-hub.sh scripts/substrate/reseed-restart.sh)
tree_hits() { # <root> -> one finding per line
  local r="$1" inv="$1/scripts/substrate/vessels.inventory.json" u base short f
  for u in $(jq -r '.vessels[] | select(.retired == true) | .unit' "$inv"); do
    base="${u%.service}"; base="${base%.timer}"; short="${base%-vessel}"
    [ -f "$r/README.md" ] && grep -n -E -- "^\|.*(\b${base}\b|\b${short}\b)" "$r/README.md" | cut -d: -f1 \
      | while IFS= read -r n; do echo "$u: named in a README.md table row:$n"; done
    jq -e --arg u "$u" '.vessels[] | select(.unit == $u) | has("health_port")' "$inv" >/dev/null 2>&1 \
      && echo "$u: the inventory entry still carries a health_port"
    jq -r --arg u "$u" '
      ((.profiles // {}) | to_entries[] | select(.value | index($u)) | "profiles." + .key),
      ((.composed_profiles // {}) | to_entries[] | select((.value.vessels // []) | index($u)) | "composed_profiles." + .key)' "$inv" \
      | while IFS= read -r p; do echo "$u: named by $p"; done
    for f in "${ROSTERS[@]}"; do
      [ -f "$r/$f" ] || continue
      grep -n -F -- "$base" "$r/$f" | cut -d: -f1 | while IFS= read -r n; do echo "$u: named in $f:$n"; done
    done
  done
}
N="$T/neg"; mkdir -p "$N/scripts/substrate"
cat > "$N/scripts/substrate/vessels.inventory.json" <<'EOF'
{ "profiles": { "compute": ["old-vessel.service"] },
  "composed_profiles": { "hub": { "roles": ["store"], "vessels": ["old-vessel.service"] } },
  "vessels": [ { "unit": "old-vessel.service", "role": "compute", "retired": true, "health_port": 8999 } ] }
EOF
printf '| Port | Vessel |\n| 18999 | old-vessel |\n| P999 | old | clients |\n- **old-vessel** is retired from the fleet.\n' > "$N/README.md"
printf 'for p in 8080 8999; do :; done # old-vessel\n' > "$N/scripts/substrate/substrate-status.sh"
got="$(tree_hits "$N" | sort | tr '\n' ';')"
want="old-vessel.service: named by composed_profiles.hub;old-vessel.service: named by profiles.compute;old-vessel.service: named in a README.md table row:2;old-vessel.service: named in a README.md table row:3;old-vessel.service: named in scripts/substrate/substrate-status.sh:1;old-vessel.service: the inventory entry still carries a health_port;"
[ "$got" = "$want" ] && ok "negative control: a health_port, a unit-list and a composed profile, README table rows (unit and short name, not prose) and substrate-status are each detected" \
  || bad "negative control: expected '$want', got '$got'"

retired="$(jq -r '[.vessels[] | select(.retired == true) | .unit] | join(" ")' "$ROOT/scripts/substrate/vessels.inventory.json")"
hits="$(tree_hits "$ROOT")"
if [ -z "$hits" ]; then
  ok "no retired unit (${retired:-none}) has a port, a profile, or a place in an operator roster"
else
  while IFS= read -r h; do bad "$h"; done <<< "$hits"
fi

if [ "$fails" -eq 0 ]; then echo "PASSED"; exit 0; fi
echo "FAILED ($fails)"; exit 1
