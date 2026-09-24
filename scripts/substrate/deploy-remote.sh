#!/usr/bin/env bash
# deploy-remote.sh — DEPRECATED. Use deploy.sh (setup commands: README § Installation).
#
# Kept so an existing invocation keeps working. It translates this script's
# environment inputs into an .env and runs deploy.sh with the image shipped from
# this host, which is what this script always did:
#
#   deploy.sh --env-file <generated .env> --ship-image user@host
#
# The same node: a full substrate publishing the same seven ports beyond the
# host — 18080, 18090, 18100, 18210, 18250, 18260, 18270. The manifest's other
# ports are published on 127.0.0.1 only.
#
# Inputs it still reads (from the environment only — ~/.metabob is no longer
# consulted): the provider keys, IMAGE (-> SUBSTRATE_IMAGE), SSH_KEY,
# PEER_DISCOVERY + FEDERATION_SIGNING_SECRET (-> the discovery peering inputs,
# now declared at launch instead of edited into the running container), and
# RUN_RELAY=1 with PUBLIC_IP. RUN_RELAY used to start a relay as a host process
# beside the container; the relay now runs inside the container, which the hub
# role group turns on, so RUN_RELAY=1 becomes ENABLED_ROLES=full,hub (every
# vessel, plus the relay and the hub's self-anchoring) with the relay on host
# port 30333 as before.
# ADOPT=1 and ACCEPT_PORTS=1 pass deploy.sh's --adopt and --accept-ports after
# you have read the difference it reports.
set -euo pipefail
TARGET="${1:?usage: deploy-remote.sh user@host   (deprecated — see deploy.sh --help)}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "[deploy-remote] ERROR: set ANTHROPIC_API_KEY (as this script always required; ~/.metabob is no longer read)" >&2; exit 1; }
ENVF="$(mktemp)"; trap 'rm -f "$ENVF"' EXIT; chmod 600 "$ENVF"
add() { if [ -n "${2:-}" ]; then printf '%s=%s\n' "$1" "$2" >> "$ENVF"; fi; }
for k in ANTHROPIC_API_KEY OPENAI_API_KEY OPENAI_BASE_URL LLM_DEFAULT_MODEL GOOGLE_API_KEY GROQ_API_KEY \
         MISTRAL_API_KEY CHUTES_API_KEY OPENROUTER_API_KEY API_KEY_SECRET ALLOW_INSECURE_API_KEY_SECRET; do
  add "$k" "${!k:-}"
done
add SUBSTRATE_IMAGE "${IMAGE:-}"
# The ports this node never published stay on the host.
for v in IDENTITY HUMAN_SURFACE; do add "${v}_PUBLISH_IP" 127.0.0.1; done
if [ "${RUN_RELAY:-0}" = 1 ]; then
  [ -n "${PUBLIC_IP:-}" ] || { echo "[deploy-remote] ERROR: RUN_RELAY=1 needs PUBLIC_IP=<vm public ipv4>" >&2; exit 1; }
  add ENABLED_ROLES full,hub
  add PUBLIC_IP "$PUBLIC_IP"
  add RELAY_PORT 30333
else
  add RELAY_PUBLISH_IP 127.0.0.1
fi
if [ -n "${PEER_DISCOVERY:-}" ]; then
  add PEER_DISCOVERY_ENDPOINTS "http://${PEER_DISCOVERY}"
  add MAX_PEER_DEPTH 1
  add FEDERATION_PEER_AUTH_MODE hmac
  add FEDERATION_SIGNING_SECRET "${FEDERATION_SIGNING_SECRET:-}"
fi
ARGS=(--env-file "$ENVF" --ship-image)
[ "${ADOPT:-0}" = 1 ] && ARGS+=(--adopt)
[ "${ACCEPT_PORTS:-0}" = 1 ] && ARGS+=(--accept-ports)
echo "[deploy-remote] DEPRECATED — running deploy.sh ${ARGS[*]} $TARGET" >&2
"$HERE/deploy.sh" "${ARGS[@]}" "$TARGET"   # not exec: the trap removes the generated .env
