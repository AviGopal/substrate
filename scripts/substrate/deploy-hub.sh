#!/usr/bin/env bash
# deploy-hub.sh — DEPRECATED. Use deploy.sh with PROFILE=hub in the .env (setup
# commands: README § Installation).
#
# Kept so an existing invocation keeps working. It translates this script's
# inputs into an .env describing the same hub it always launched, and runs
# deploy.sh with it. The image is now PULLED on the target instead of built from
# a clone there; REPO, BRANCH and GITHUB_PAT therefore have no effect.
#
#   deploy-hub.sh user@host <public-ip>
#   == deploy.sh --env-file <generated .env> user@host
#
# The same hub: the `hub` role group plus the six compute vessels this script
# always ran (ENABLED_ROLES=hub + ENABLED_EXTRA_VESSELS — not PROFILE=hub, whose
# composition also carries the autonomy role and boredom), and the same six
# ports published beyond the host — 18080, 18090, 18100, 18101, 18210, 18260.
# The manifest's other ports are published on 127.0.0.1 only.
#
# The relay: a relay still running as a host process (managed unit or
# ~/relay.log) keeps being the one relay — its multiaddr is threaded in and the
# in-container relay is disabled. With none found, the relay runs in the
# container on host port 30333, where spokes already dial; deploy.sh then reports
# 30333 as newly published by the container, and ACCEPT_PORTS=1 accepts that.
#
# Environment inputs: the provider keys, IMAGE, FED_SUBSTRATE_ID (default
# hub-<public-ip>, as before), RELAY_MULTIADDR, ENABLED_EXTRA_VESSELS,
# SUBSTRATE_ROOT, API_KEY_SECRET, ALLOW_INSECURE_API_KEY_SECRET, SSH_KEY;
# ADOPT=1 and ACCEPT_PORTS=1 pass deploy.sh's --adopt and --accept-ports after
# you have read the difference it reports. ~/.metabob is no longer consulted.
set -euo pipefail
TARGET="${1:?usage: deploy-hub.sh user@host <public-ip>   (deprecated — see deploy.sh --help)}"
PUBLIC_IP="${2:?usage: deploy-hub.sh user@host <public-ip>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "[deploy-hub] ERROR: set ANTHROPIC_API_KEY (as this script always required; ~/.metabob is no longer read)" >&2; exit 1; }
for gone in REPO BRANCH GITHUB_PAT; do
  [ -z "${!gone:-}" ] || echo "[deploy-hub] note: $gone is ignored — the hub now runs the published image" >&2
done
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
         RELAY_MULTIADDR; do
  add "$k" "${!k:-}"
done
add SUBSTRATE_IMAGE "${IMAGE:-}"
add ENABLED_ROLES hub
# The compute vessels this hub has always run on top of the hub role group.
add ENABLED_EXTRA_VESSELS "${ENABLED_EXTRA_VESSELS:-goal-host-vessel.service,development-vessel.service,local-tools-vessel.service,ribosome-vessel.service,analysis-vessel.service,light-dispatch-vessel.service}"
add SUBSTRATE_BIND_HOST 0.0.0.0
add SUBSTRATE_ROOT "${SUBSTRATE_ROOT:-/workspace/git/super-repo}"
add PUBLIC_IP "$PUBLIC_IP"
add FED_PUBLIC_IP "$PUBLIC_IP"
add FED_SUBSTRATE_ID "${FED_SUBSTRATE_ID:-hub-$PUBLIC_IP}"
add HUB_DISCOVERY_URL "http://localhost:8100"
# The ports this hub never published stay on the host.
for v in ANALYSIS STATEFUL_UI HUMAN_SURFACE; do add "${v}_PUBLISH_IP" 127.0.0.1; done
if [ -n "${RELAY_MULTIADDR:-}" ]; then
  # A host relay that is still serving stays the one relay: an in-container relay
  # beside it would announce a second peer id while RELAY_MULTIADDR names the first.
  add DISABLED_VESSELS federation-relay.service
  add RELAY_PUBLISH_IP 127.0.0.1
else
  # No host relay: the in-container relay takes the port spokes already dial,
  # published and announced alike.
  add RELAY_PORT 30333
  echo "[deploy-hub] no host relay found — the relay runs in the container on host port 30333" >&2
fi
ARGS=(--env-file "$ENVF")
[ "${ADOPT:-0}" = 1 ] && ARGS+=(--adopt)
[ "${ACCEPT_PORTS:-0}" = 1 ] && ARGS+=(--accept-ports)
echo "[deploy-hub] DEPRECATED — running deploy.sh ${ARGS[*]} $TARGET" >&2
"$HERE/deploy.sh" "${ARGS[@]}" "$TARGET"   # not exec: the trap removes the generated .env
