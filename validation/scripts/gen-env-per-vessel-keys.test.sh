#!/usr/bin/env bash
# gen-env-per-vessel-keys.test.sh: gen-env must render a per-vessel key (LOCAL_TOOLS / GOAL_HOST / RIBOSOME / CONCEPT_DB
# *_API_KEY) from the persisted store before falling back to the fleet key. seed-identity writes the dedicated keys it mints
# to the store, but gen-env never read them back, so from the second boot on every per-vessel key was the fleet key
# (a node's GOAL_HOST_VESSEL_API_KEY key_id equalled METABOB_API_KEY's). Protected judge-adjacent
# bootstrap test: a red here means a scoped per-vessel key (goal-host's verdict-corpus writer) reverts on the next boot.
#   (a) MUST-FAIL: a store holding GOAL_HOST_VESSEL_API_KEY renders it (provenance: persisted), not the fleet key
#   (b) control: absent from the store -> the fleet key, as before (provenance: derived)
#   (c) an explicitly supplied value wins over the store
#   (d) the store writer does not list the per-vessel names, so its merge carries a stored key through untouched and the
#       fleet fallback is never written into the store as if it were a dedicated key
# The block is extracted from gen-env and run with persisted_secret and prov; no value is ever printed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; G="${1:-$HERE/../../scripts/substrate/gen-env.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/pvkeys.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
sed -n '/^persisted_secret() {/,/^}/p' "$G" > "$T/ps.sh"
awk '/^# Optional per-vessel keys/{on=1} on{print} on && /^$/{exit}' "$G" > "$T/blk.sh"
grep -q 'GOAL_HOST_VESSEL_API_KEY' "$T/blk.sh" && grep -q 'persisted_secret() {' "$T/ps.sh" || { echo "FAIL - could not extract the per-vessel block or persisted_secret"; exit 1; }
FLEET=mb-fleetVALUEneverprinted; DED=mb-dedicatedVALUEneverprinted; EXPL=mb-explicitVALUEneverprinted
run() { # $1 store line for GOAL_HOST ('' = none), $2 explicit env value ('' = none) -> "<which>|<prov line>"
  ( unset LOCAL_TOOLS_VESSEL_API_KEY GOAL_HOST_VESSEL_API_KEY RIBOSOME_VESSEL_API_KEY CONCEPT_DB_API_KEY
    SECRETS_FILE="$T/store"; printf 'METABOB_API_KEY=%s\n' "$FLEET" > "$SECRETS_FILE"; [ -n "$1" ] && printf '%s\n' "$1" >> "$SECRETS_FILE"
    PROV_TMP="$T/prov"; : > "$PROV_TMP"; prov() { printf '%s=%s\n' "$1" "$2" >> "$PROV_TMP"; }
    METABOB_API_KEY="$FLEET"; [ -n "$2" ] && GOAL_HOST_VESSEL_API_KEY="$2"
    . "$T/ps.sh"; . "$T/blk.sh" 2>/dev/null
    case "$GOAL_HOST_VESSEL_API_KEY" in "$DED") w=dedicated ;; "$FLEET") w=fleet ;; "$EXPL") w=explicit ;; *) w=other ;; esac
    printf '%s|%s' "$w" "$(grep '^GOAL_HOST_VESSEL_API_KEY=' "$PROV_TMP" | tail -1)" )
}
r="$(run "GOAL_HOST_VESSEL_API_KEY=$DED" "")"
[ "${r%%|*}" = dedicated ] && ok "(a) a stored per-vessel key is rendered, not the fleet key" || bad "(a) rendered the ${r%%|*} key"
[ "${r#*|}" = "GOAL_HOST_VESSEL_API_KEY=persisted" ] && ok "(a) provenance: persisted" || bad "(a) provenance '${r#*|}'"
r="$(run "GOAL_HOST_VESSEL_API_KEY=\"$DED\"" "")"
[ "${r%%|*}" = dedicated ] && ok "(a) a quoted stored key is read without its quotes" || bad "(a) quoted store: ${r%%|*}"
r="$(run "" "")"
[ "${r%%|*}" = fleet ] && ok "(b) absent from the store: the fleet key, as before" || bad "(b) rendered ${r%%|*}"
case "${r#*|}" in "GOAL_HOST_VESSEL_API_KEY=derived"|"") pv="${r#*|}"; ok "(b) provenance: not persisted (${pv:-none})" ;; *) bad "(b) provenance '${r#*|}'" ;; esac
r="$(run "GOAL_HOST_VESSEL_API_KEY=$DED" "$EXPL")"
[ "${r%%|*}" = explicit ] && ok "(c) an explicit value wins over the store" || bad "(c) rendered ${r%%|*}"
awk '/Substrate internal secrets/{f=1} f{print} f&&/^SECRETS$/{exit}' "$G" > "$T/writer"
grep -qE '^(LOCAL_TOOLS_VESSEL|GOAL_HOST_VESSEL|RIBOSOME_VESSEL)_API_KEY=|^CONCEPT_DB_API_KEY=' "$T/writer" && bad "(d) the store writer lists a per-vessel key (it would persist the fleet fallback as a dedicated key)" || ok "(d) the store writer does not list per-vessel keys: its merge carries a stored one through"
grep -q 'carried through untouched' "$G" && ok "(d) the writer's carry-unknown-keys merge is present" || bad "(d) no carry merge in the store writer"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
