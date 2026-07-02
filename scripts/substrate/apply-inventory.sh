#!/bin/bash
# apply-inventory.sh — select which vessel units run, from vessels.inventory.json.
#
# Run by entrypoint.sh AFTER gen-env and BEFORE `exec systemd`, so unit selection
# happens offline (systemctl disable just removes the *.wants symlinks the Dockerfile
# created). The image bakes the FULL enable-list; this trims it down to a subset.
#
# Selection (env, highest precedence first):
#   ENABLED_VESSELS=unit,unit   explicit allow-list (exact unit names); overrides roles
#   ENABLED_ROLES=role,role     roles to keep (role-GROUP aliases hub/spoke/full expand
#                               via inventory.roles); everything else is disabled
#   DISABLED_VESSELS=unit,unit  always disabled, even if selected above
# DEFAULT (neither ENABLED_* set) = keep everything = identical to today (no-op).
# DRY_RUN=1 prints the plan without changing anything.
#
# Manifest-installed units (federation-*: "manifest":true) are NOT baked-enabled, so
# they are never disabled here — they're installed on demand via vessel-ctl.sh.
set -euo pipefail

# Prefer the substrate-writable volume copy (seeded by entrypoint) so the
# substrate's own edits to its fleet definition govern boot selection.
INV="${VESSELS_INVENTORY:-/workspace/substrate/fleet/vessels.inventory.json}"
[ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[apply-inventory] $*" >&2; }

if [ ! -f "$INV" ]; then log "no inventory at $INV — keeping all units (no-op)"; exit 0; fi
if ! command -v jq >/dev/null 2>&1; then log "jq missing — keeping all units (no-op)"; exit 0; fi

# No selection env → keep everything.
if [ -z "${ENABLED_VESSELS:-}" ] && [ -z "${ENABLED_ROLES:-}" ] && [ -z "${DISABLED_VESSELS:-}" ]; then
  log "no ENABLED_ROLES/ENABLED_VESSELS/DISABLED_VESSELS set — all units enabled (default)"
  exit 0
fi

csv() { echo "$1" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' || true; }

# Expand ENABLED_ROLES: a token may be a role (e.g. "compute") or a role-GROUP alias
# defined in inventory.roles (e.g. "hub" -> ["store","control",...]).
expand_roles() {
  local out=""
  for tok in $(csv "${ENABLED_ROLES:-}"); do
    local grp
    grp="$(jq -r --arg t "$tok" '.roles[$t] // empty | .[]?' "$INV" 2>/dev/null || true)"
    if [ -n "$grp" ]; then out="$out $grp"; else out="$out $tok"; fi
  done
  echo "$out" | tr ' ' '\n' | grep -v '^$' | sort -u
}

manageable_units() { jq -r '.vessels[] | select((.manifest // false) | not) | .unit' "$INV"; }
role_of() { jq -r --arg u "$1" '.vessels[] | select(.unit==$u) | .role' "$INV"; }

DESIRED=""
if [ -n "${ENABLED_VESSELS:-}" ]; then
  DESIRED="$(csv "${ENABLED_VESSELS}")"
  log "explicit ENABLED_VESSELS: $(echo $DESIRED | tr '\n' ' ')"
elif [ -n "${ENABLED_ROLES:-}" ]; then
  ROLES="$(expand_roles)"
  log "ENABLED_ROLES expands to: $(echo $ROLES | tr '\n' ' ')"
  for u in $(manageable_units); do
    r="$(role_of "$u")"
    if echo "$ROLES" | grep -qx "$r"; then DESIRED="$DESIRED
$u"; fi
  done
else
  DESIRED="$(manageable_units)"   # only DISABLED_VESSELS set → start from all
fi

# Subtract DISABLED_VESSELS.
DISABLED_EXPLICIT="$(csv "${DISABLED_VESSELS:-}")"

is_desired() { echo "$DESIRED" | grep -qx "$1" && ! echo "$DISABLED_EXPLICIT" | grep -qx "$1"; }

disabled_count=0
for u in $(manageable_units); do
  if is_desired "$u"; then continue; fi
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN would disable: $u"
  else
    systemctl disable "$u" >/dev/null 2>&1 || log "warn: could not disable $u"
    log "disabled: $u"
  fi
  disabled_count=$((disabled_count + 1))
done
log "done — $disabled_count unit(s) $( [ "$DRY_RUN" = "1" ] && echo 'would be' || echo '' ) disabled; the rest stay enabled"
