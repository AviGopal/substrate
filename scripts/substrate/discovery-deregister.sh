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

# Scope to THIS substrate's rows. A bare substring match also deletes PEER
# substrates' mirror rows that share the vessel name (observed: stopping the
# hub's federation-transport-vessel removed federation-transport-vessel@<spoke>
# too, blanking the spoke's federated presence until its next re-register).
# A row is ours iff it has no '@<substrate>' qualifier, or its qualifier equals
# our FED_SUBSTRATE_ID; with no id configured, '@'-qualified rows are treated
# as not-ours (TTL expiry remains their backstop).
SUB="${FED_SUBSTRATE_ID:-$(grep -m1 '^FED_SUBSTRATE_ID=' /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d '"')}"
IDS="$(curl -s -m 5 -X POST -H "Authorization: ApiKey $KEY" -H 'Content-Type: application/json' \
  -d '{"pointer":{"type":"vesselRegistry"}}' "$DISCOVERY/resolve" 2>/dev/null \
  | jq -r --arg n "$NEEDLE" --arg sub "$SUB" '.content.vessels[]?
      | (.vesselId // .id // "") as $vid
      | select((($vid + " " + (.name // "")) | contains($n))
          and (($vid | contains("@") | not) or (($sub != "") and ($vid | endswith("@" + $sub)))))
      | $vid' 2>/dev/null || true)"

for id in $IDS; do
  curl -s -m 5 -X DELETE -H "Authorization: ApiKey $KEY" "$DISCOVERY/vessels/$id" >/dev/null 2>&1 \
    && echo "[discovery-deregister] removed $id"
done
exit 0
