#!/usr/bin/env bash
# spoke-federate.sh <container> <fed-substrate-id> [relay-multiaddr]
#
# OPTIONAL override, not a required step. A spoke boot with HUB_DISCOVERY_URL set
# already AUTO-enables federation-transport-vessel at boot (entrypoint.sh) with a
# gen-env-assigned FED_SUBSTRATE_ID, so `make up DISCOVERY_ENDPOINT=<hub>` is the
# whole setup. Use this script only to PIN a specific fed-substrate-id or to run
# the hub-side collision check before re-enabling the transport under that id.
#
# It enables the federation-transport-vessel on a running federated spoke —
# upserts the federation identity into /etc/substrate/env, installs the dynamic
# vessel from the manifest (vessel-ctl.sh), and waits for the transport health
# surface. The relay multiaddr is auto-derived from the hub's own federation
# ingress advertisement when not given: the relay and the hub live on the same
# public host by convention, and the ingress circuit multiaddr embeds the relay
# prefix before /p2p-circuit.
set -euo pipefail
C="${1:?usage: spoke-federate.sh <container> <fed-substrate-id> [relay-multiaddr]}"
SID="${2:?FED_SUBSTRATE_ID required (unique per substrate in the hub namespace)}"
RELAY="${3:-}"

# Dual context (same pattern as vessel-ctl): run from the host against a
# container, or directly INSIDE the container (pulled image, no host repo:
# docker exec <name> spoke-federate <name> <id>).
if command -v docker >/dev/null 2>&1 && docker inspect "$C" >/dev/null 2>&1; then
  cexec() { docker exec "$C" bash -c "$1"; }
  VESSEL_CTL="$(dirname "$0")/vessel-ctl.sh"
else
  cexec() { bash -c "$1"; }
  VESSEL_CTL="/usr/local/bin/vessel-ctl"
fi

HUB=$(cexec 'source /etc/substrate/env 2>/dev/null || true; echo "${HUB_DISCOVERY_URL:-}"')
[ -n "$HUB" ] || {
  echo "[spoke-federate] ERROR: container has no HUB_DISCOVERY_URL — boot it as a federated spoke first:"
  echo "  make up API_KEY=<hub-issued-key> ANTHROPIC_API_KEY=<key> DISCOVERY_ENDPOINT=http://<hub>:18100"
  exit 1
}
KEY=$(cexec 'source /etc/substrate/env 2>/dev/null || true; source /workspace/.substrate-secrets 2>/dev/null || true; echo "${METABOB_API_KEY:-}"')

hub_resolve() { # <pointer-json>
  curl -sm 10 -X POST "$HUB/resolve" -H 'Content-Type: application/json' \
    ${KEY:+-H "Authorization: ApiKey $KEY"} -d "$1"
}

if [ -z "$RELAY" ]; then
  RELAY=$(hub_resolve '{"pointer":{"type":"vesselCapability","shape":"federation_probe"}}' \
    | jq -r '.content.vessels[]?.libp2p_multiaddr[]? // empty' | head -1 | sed 's#/p2p-circuit.*##')
  [ -n "$RELAY" ] || { echo "[spoke-federate] ERROR: could not auto-derive RELAY_MULTIADDR from $HUB — pass RELAY_MULTIADDR=<addr>"; exit 1; }
  echo "[spoke-federate] derived relay from hub ingress: $RELAY"
fi

# FED_SUBSTRATE_ID must be unique in the hub namespace — a collision would
# interleave two substrates' capability mirrors under one identity.
taken=$(hub_resolve '{"pointer":{"type":"vesselRegistry"}}' \
  | jq -r '.content.vessels[]?.vesselId // empty' | grep -c "@${SID}\$" || true)
[ "${taken:-0}" -eq 0 ] || { echo "[spoke-federate] ERROR: FED_SUBSTRATE_ID '$SID' already present in hub registry — pick a unique id"; exit 1; }

cexec "
  upsert() { grep -q \"^\$1=\" /etc/substrate/env 2>/dev/null \
    && sed -i \"s|^\$1=.*|\$1=\\\"\$2\\\"|\" /etc/substrate/env \
    || echo \"\$1=\\\"\$2\\\"\" >> /etc/substrate/env; }
  upsert FED_SUBSTRATE_ID '$SID'
  # FED_VESSEL_ID seeds the libp2p keypair — it MUST be substrate-unique or
  # every spoke derives the identical peer id and fights over the reservation.
  upsert FED_VESSEL_ID 'federation-transport-vessel@$SID'
  upsert RELAY_MULTIADDR '$RELAY'
  upsert HUB_DISCOVERY_URL '$HUB'
"

"$VESSEL_CTL" install federation-transport-vessel --container "$C"
cexec 'systemctl restart federation-transport-vessel.service' || true

h=""
for _ in $(seq 1 30); do
  h=$(cexec 'curl -sm 2 http://127.0.0.1:8401/health 2>/dev/null' || true)
  [ -n "$h" ] && break
  sleep 2
done
if [ -n "$h" ]; then
  echo "[spoke-federate] transport up: $(echo "$h" | head -c 300)"
  echo "[spoke-federate] this substrate now mirrors its local registry into $HUB as <vessel>@$SID"
else
  echo "[spoke-federate] WARNING: transport health not answering yet — check: docker exec $C journalctl -u federation-transport-vessel -n 50"
  exit 1
fi
