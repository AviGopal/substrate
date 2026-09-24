#!/usr/bin/env bash
# deploy-hub-pull.sh — DEPRECATED. Use deploy.sh with PROFILE=hub in the .env
# (setup commands: README § Installation).
#
# Kept so an existing invocation keeps working. This script always pulled the
# published image; deploy.sh does the same from the launch manifest, so this is
# only a translation of its inputs into an .env describing the hub it launched:
#
#   deploy-hub-pull.sh user@host <public-ip>
#   == deploy.sh --env-file <generated .env> --import-host-env <provider keys> user@host
#
# The same hub: the `hub` role group with no extra vessels (the multi-provider
# LLM resolver this script used to unmask by hand is in that group now), the
# provider keys and git credential the host keeps in /etc/environment (copied on
# the host, never fetched here), and the same four ports published beyond the
# host — 18080, 18100, 18101, 18210. The manifest's other ports are published on
# 127.0.0.1 only.
#
# The relay: a relay still running as a host process (managed unit or
# ~/relay.log) keeps being the one relay — its multiaddr is threaded in and the
# in-container relay is disabled. With none found, the relay runs in the
# container on host port 30333, where spokes already dial; deploy.sh then reports
# 30333 as newly published by the container, and ACCEPT_PORTS=1 accepts that.
#
# Environment inputs:
#   ANTHROPIC_API_KEY (required, as before) and the other provider keys (else
#     taken from the host's /etc/environment where it has them); IMAGE or GHCR_OWNER; GHCR_USER +
#     GHCR_TOKEN (optional, the package pulls anonymously); FED_SUBSTRATE_ID
#     (the hub's existing id; no longer defaulted here); RELAY_MULTIADDR;
#     ENABLED_EXTRA_VESSELS; SUBSTRATE_ROOT; API_KEY_SECRET;
#     ALLOW_INSECURE_API_KEY_SECRET; SSH_KEY.
#   ADOPT=1         accept a launch-identity difference deploy.sh reports when it
#                   replaces the hub container made by the previous version of
#                   this script (expect FED_SUBSTRATE_ID, and DISABLED_VESSELS
#                   when a host relay is kept) — read the difference first.
#   ACCEPT_PORTS=1  accept a change in the ports the hub exposes.
# ~/.metabob is no longer consulted.
set -euo pipefail
TARGET="${1:?usage: deploy-hub-pull.sh user@host <public-ip>   (deprecated — see deploy.sh --help)}"
PUBLIC_IP="${2:?usage: deploy-hub-pull.sh user@host <public-ip>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "[deploy-hub-pull] ERROR: set ANTHROPIC_API_KEY (as this script always required; ~/.metabob is no longer read)" >&2; exit 1; }
SSH=(ssh -o StrictHostKeyChecking=accept-new); [ -n "${SSH_KEY:-}" ] && SSH+=(-i "$SSH_KEY")
if [ -z "${RELAY_MULTIADDR:-}" ]; then
  RELAY_MULTIADDR="$("${SSH[@]}" "$TARGET" \
    '{ journalctl -u federation-relay.service --no-pager 2>/dev/null; cat "$HOME/relay.log" 2>/dev/null; } \
       | grep -oE "/ip4/[^ \"]*p2p/[A-Za-z0-9]+" | tail -1' </dev/null 2>/dev/null || true)"
fi
ENVF="$(mktemp)"; trap 'rm -f "$ENVF"' EXIT; chmod 600 "$ENVF"
add() { if [ -n "${2:-}" ]; then printf '%s=%s\n' "$1" "$2" >> "$ENVF"; fi; }
for k in ANTHROPIC_API_KEY OPENAI_API_KEY OPENAI_BASE_URL LLM_DEFAULT_MODEL GOOGLE_API_KEY GROQ_API_KEY \
         MISTRAL_API_KEY CHUTES_API_KEY OPENROUTER_API_KEY API_KEY_SECRET ALLOW_INSECURE_API_KEY_SECRET \
         RELAY_MULTIADDR FED_SUBSTRATE_ID ENABLED_EXTRA_VESSELS; do
  add "$k" "${!k:-}"
done
add SUBSTRATE_IMAGE "${IMAGE:-ghcr.io/${GHCR_OWNER:-avigopal}/substrate:dev}"
add ENABLED_ROLES hub
add SUBSTRATE_BIND_HOST 0.0.0.0
add SUBSTRATE_ROOT "${SUBSTRATE_ROOT:-/workspace/git/super-repo}"
add PUBLIC_IP "$PUBLIC_IP"
add FED_PUBLIC_IP "$PUBLIC_IP"
add HUB_DISCOVERY_URL "http://localhost:8100"
# The ports this hub never published stay on the host.
for v in DEV_VESSEL ANALYSIS CONCEPT_DB STATEFUL_UI HUMAN_SURFACE; do add "${v}_PUBLISH_IP" 127.0.0.1; done
if [ -n "${RELAY_MULTIADDR:-}" ]; then
  # A host relay that is still serving stays the one relay: an in-container relay
  # beside it would announce a second peer id while RELAY_MULTIADDR names the first.
  add DISABLED_VESSELS federation-relay.service
  add RELAY_PUBLISH_IP 127.0.0.1
else
  # No host relay: the in-container relay takes the port spokes already dial,
  # published and announced alike.
  add RELAY_PORT 30333
  echo "[deploy-hub-pull] no host relay found — the relay runs in the container on host port 30333" >&2
fi
ARGS=(--env-file "$ENVF"
      --import-host-env GOOGLE_API_KEY,GROQ_API_KEY,MISTRAL_API_KEY,CHUTES_API_KEY,OPENROUTER_API_KEY,SUBSTRATE_GIT_PAT,SUBSTRATE_REPO_OWNER,RUNPOD_API_KEY,RUNPOD_ENDPOINT_ID,RUNPOD_MODELS,RUNPOD_COST_PER_MTOK)
[ "${ADOPT:-0}" = 1 ] && ARGS+=(--adopt)
[ "${ACCEPT_PORTS:-0}" = 1 ] && ARGS+=(--accept-ports)
echo "[deploy-hub-pull] DEPRECATED — running deploy.sh ${ARGS[*]} $TARGET" >&2
"$HERE/deploy.sh" "${ARGS[@]}" "$TARGET"   # not exec: the trap removes the generated .env
