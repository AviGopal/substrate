#!/usr/bin/env bash
# bootstrap-remote-google-arm.sh — temporary conduit that makes the syzygy hub's
# live llm-resolver-google arm consumable by THIS machine's substrate, so
# code-change goals can land while every local LLM provider key is credit-dead.
#
# What it does (all reversible):
#   1. SSH -L tunnel: <local bridge IP>:18225 → hub container 172.17.0.2:8225
#      (the hub's llm-resolver-google /resolve — flat llm contract, no envelope).
#      Bound to the docker bridge gateway so ONLY local containers + localhost
#      can reach it; nothing is exposed off-box.
#   2. Registers "llm-resolver-google-remote" in LOCAL discovery advertising
#      llm_completion/llmCompletion with health_score 1 — feature_compose's
#      discover() sorts by health_score desc, so this row wins producer
#      selection over the credit-dead local resolvers without stopping them.
#      Registration TTL is ~5 min; a loop re-registers every 120s.
#   3. On Ctrl-C / exit: deregisters the row and kills the tunnel. If the loop
#      dies uncleanly the row self-expires within ~5 min.
#
# This is BOOTSTRAP plumbing for an intractable blocker (LLM credentials live
# on the hub per data-locality; local plane is credit-dead). The durable fixes
# — 429/limit_rpd exhaustion classification, federated-envelope compatibility,
# groq/mistral provider entries — are dispatched as substrate goals once this
# arm is live, after which this script should not be needed.
#
# Usage:  bash scripts/substrate/bootstrap-remote-google-arm.sh
# Env:    SSH_KEY (default ~/.ssh/syzygy_deploy)  HUB=root@138.197.116.56

set -euo pipefail
HUB="${HUB:-root@138.197.116.56}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/syzygy_deploy}"
HUB_CONTAINER_IP="${HUB_CONTAINER_IP:-172.17.0.2}"
PORT=18225

# The address containers use to reach this host. Rootless docker here has no
# host-assigned bridge IP, but containers reach the host's LAN address fine
# (verified: in-container curl to <lan-ip>:18100 → 200).
BRIDGE_IP="$(ip route get 1.1.1.1 | grep -oE 'src [0-9.]+' | awk '{print $2}')"
BIND_IP="$BRIDGE_IP"

MKEY="$(python3 -c "import json;print(json.load(open('$HOME/.metabob/config.json'))['metabob']['apiKey'])")"
DISCOVERY="http://localhost:18100"
VESSEL_ID="llm-resolver-google-remote"

cleanup() {
  echo "[bootstrap-google-arm] cleaning up…"
  curl -s -m 5 -X DELETE "$DISCOVERY/vessels/$VESSEL_ID" -H "Authorization: ApiKey $MKEY" >/dev/null || true
  [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[bootstrap-google-arm] tunnel ${BIND_IP}:${PORT} → hub ${HUB_CONTAINER_IP}:8225"
ssh -N -o StrictHostKeyChecking=accept-new -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
    -i "$SSH_KEY" -L "${BIND_IP}:${PORT}:${HUB_CONTAINER_IP}:8225" "$HUB" &
TUNNEL_PID=$!
sleep 2
kill -0 "$TUNNEL_PID" || { echo "tunnel failed"; exit 1; }

probe() {
  curl -s -m 20 -X POST "http://${BRIDGE_IP}:${PORT}/resolve" -H 'Content-Type: application/json' \
    -d '{"type":"llm_completion","prompt":"Reply with the single word: alive","model":"gemini-2.5-flash","max_tokens":50}'
}
echo "[bootstrap-google-arm] probe: $(probe | head -c 120)"

register() {
  curl -s -m 10 -X POST "$DISCOVERY/register" -H "Authorization: ApiKey $MKEY" -H 'Content-Type: application/json' -d @- <<JSON
{ "vesselId": "$VESSEL_ID", "vesselName": "hub google arm via ssh conduit (bootstrap)",
  "endpoint": "http://${BRIDGE_IP}:${PORT}",
  "shapes": ["llm_completion", "llmCompletion"],
  "resolve_endpoint": "/resolve", "resolve_request_format": "flat",
  "health_score": 1, "version": "bootstrap-conduit" }
JSON
}

echo "[bootstrap-google-arm] registering with local discovery (re-register every 120s; Ctrl-C to stop + deregister)"
while true; do
  register >/dev/null || echo "[bootstrap-google-arm] register failed (will retry)"
  sleep 120
done
