#!/usr/bin/env bash
# discovery-deregister.sh — remove a vessel's registration(s) from discovery.
#
#   discovery-deregister.sh <vessel-name-or-id-substring>
#
# The graceful-detach primitive: called by rendered units' ExecStopPost on any
# clean stop, and by vessel-ctl uninstall, so a planned detach leaves the
# registry immediately instead of rotting for the 5-min TTL (crash death still
# falls back to TTL expiry). Matches registrations whose vesselId/name contains
# the argument (vessels self-assign ids, often instance-suffixed). Best-effort:
# never fails the caller.
set -uo pipefail

NEEDLE="${1:?usage: discovery-deregister.sh <vessel-name-or-id-substring>}"
DISCOVERY="${DISCOVERY_ENDPOINT:-http://127.0.0.1:8100}"
KEY="${METABOB_API_KEY:-$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d '"')}"
[ -n "$KEY" ] || exit 0

IDS="$(curl -s -m 5 -X POST -H "Authorization: ApiKey $KEY" -H 'Content-Type: application/json' \
  -d '{"pointer":{"type":"vesselRegistry"}}' "$DISCOVERY/resolve" 2>/dev/null \
  | jq -r --arg n "$NEEDLE" '.content.vessels[]? | select(((.vesselId // .id // "") + " " + (.name // "")) | contains($n)) | .vesselId // .id' 2>/dev/null || true)"

for id in $IDS; do
  curl -s -m 5 -X DELETE -H "Authorization: ApiKey $KEY" "$DISCOVERY/vessels/$id" >/dev/null 2>&1 \
    && echo "[discovery-deregister] removed $id"
done
exit 0
