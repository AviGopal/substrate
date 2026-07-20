#!/usr/bin/env bash
# deploy-remote.sh — the SIMPLE one-shot way to deploy the substrate onto a fresh
# remote VM and (optionally) stand up the public federation relay there.
#
# It ships the locally-built image over SSH (NO registry needed), runs it, seeds its
# identity, and optionally: (a) runs the libp2p relay on the VM (the VM has the public
# IP, so it's the natural relay anchor), and (b) peers the VM substrate to another
# substrate's discovery. A remote run does NOT need the repo cloned — the image bakes
# /vessels; state lives in portable named volumes (substrate-surreal, substrate-workspace).
#
# Usage (simplest — full substrate on the VM):
#   ANTHROPIC_API_KEY=sk-ant-...  bash deploy-remote.sh root@<vm-ip>
#
# With the public relay (recommended — makes the federation reachable from anywhere):
#   ANTHROPIC_API_KEY=...  PUBLIC_IP=<vm-public-ipv4>  RUN_RELAY=1  bash deploy-remote.sh root@<vm-ip>
#
# Also peer it to a substrate at <peer-ip>:18100 (shared HMAC secret):
#   ... PEER_DISCOVERY=<peer-ip>:18100  FEDERATION_SIGNING_SECRET=<hex>  bash deploy-remote.sh root@<vm-ip>
#
# Operator host needs: docker, ssh/scp, a built image (defaults to ghcr.io/avigopal/substrate:dev,
# what `make build` produces; builds it if missing). VM needs: ssh access (Docker + Bun auto-installed if absent).
# Open firewall: 18080-18270 (vessel APIs, as needed) + 30333/tcp (relay, if RUN_RELAY=1).
set -euo pipefail

TARGET="${1:?usage: deploy-remote.sh user@vm-ip   (set ANTHROPIC_API_KEY)}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${IMAGE:-ghcr.io/avigopal/substrate:dev}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(jq -r '.providers.anthropic.apiKey // empty' "$HOME/.metabob/config.json" 2>/dev/null || true)}"
PUBLIC_IP="${PUBLIC_IP:-}"                       # VM public IPv4 — required for RUN_RELAY
RUN_RELAY="${RUN_RELAY:-0}"
PEER_DISCOVERY="${PEER_DISCOVERY:-}"             # optional: a peer's discovery endpoint to federate with
FED_SECRET="${FEDERATION_SIGNING_SECRET:-}"

log(){ echo "[deploy-remote $(date -Iseconds)] $*" >&2; }
[ -n "$ANTHROPIC_API_KEY" ] || { log "ERROR: set ANTHROPIC_API_KEY (or put it in ~/.metabob/config.json)"; exit 1; }

# 0. Ensure the image exists locally (build only if missing — usually it's already built).
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  log "image $IMAGE not found locally — building (20-30 min)…"
  make -C "$REPO_ROOT/scripts/substrate" build
fi

# 1. Ship the image over SSH — no registry. ~4-6GB (gzip-streamed).
log "shipping $IMAGE → $TARGET  (docker save | ssh docker load)…"
docker save "$IMAGE" | gzip | ssh "$TARGET" 'gunzip | docker load'

# 2. Run + seed on the VM. (Env vars are set on the remote command line, before bash -s,
#    so the quoted heredoc below expands them on the REMOTE.)
log "running + seeding the substrate on $TARGET…"
ssh "$TARGET" \
    ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" IMAGE="$IMAGE" \
    PEER_DISCOVERY="$PEER_DISCOVERY" FED_SECRET="$FED_SECRET" \
    'bash -s' <<'REMOTE'
set -euo pipefail
command -v docker >/dev/null || { echo "[vm] installing docker…"; curl -fsSL https://get.docker.com | sh; }
docker volume create substrate-surreal   >/dev/null 2>&1 || true
docker volume create substrate-workspace >/dev/null 2>&1 || true
docker rm -f substrate-live >/dev/null 2>&1 || true
docker run -d --name substrate-live --privileged \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -p 18080:8080 -p 18090:8090 -p 18100:8100 -p 18210:8210 -p 18250:8250 -p 18260:8260 -p 18270:8270 \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  --tmpfs /run --tmpfs /run/lock "$IMAGE"
echo "[vm] waiting for the fleet to come up…"
for i in $(seq 1 40); do curl -sf -o /dev/null http://localhost:18080/health 2>/dev/null && break; sleep 2; done
echo "[vm] seeding identity…"
docker exec substrate-live bash -c 'set -a; source /etc/substrate/env 2>/dev/null; set +a; bun /vessels/seed-identity.ts' | grep -E 'issued API key|org created' | head -2
# Optional peering (only if a peer discovery endpoint was provided).
if [ -n "${PEER_DISCOVERY:-}" ]; then
  echo "[vm] peering to ${PEER_DISCOVERY}…"
  docker exec substrate-live bash -lc "
    f=/etc/substrate/env
    grep -v -E '^(PEER_DISCOVERY_ENDPOINTS|MAX_PEER_DEPTH|FEDERATION_PEER_AUTH_MODE|FEDERATION_SIGNING_SECRET)=' \$f > \$f.tmp && mv \$f.tmp \$f
    { echo 'PEER_DISCOVERY_ENDPOINTS=http://${PEER_DISCOVERY}'; echo 'MAX_PEER_DEPTH=1'; echo 'FEDERATION_PEER_AUTH_MODE=hmac'; ${FED_SECRET:+echo \"FEDERATION_SIGNING_SECRET=$FED_SECRET\";} } >> \$f
    systemctl restart discovery-vessel"
fi
echo '[vm] === health ==='; curl -s http://localhost:18080/health | head -c 200; echo
REMOTE

# 3. Optional: the public libp2p relay on the VM (it has the public IP).
if [ "$RUN_RELAY" = "1" ]; then
  [ -n "$PUBLIC_IP" ] || { log "RUN_RELAY=1 needs PUBLIC_IP=<vm public ipv4>"; exit 1; }
  log "deploying the libp2p relay on $TARGET (PUBLIC_IP=$PUBLIC_IP, TCP 30333)…"
  tar czf - -C "$REPO_ROOT/scripts/substrate" federation-relay \
    | ssh "$TARGET" 'mkdir -p ~/substrate-fed && tar xzf - -C ~/substrate-fed'
  ssh "$TARGET" PUBLIC_IP="$PUBLIC_IP" 'bash -s' <<'RELAY'
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
command -v bun >/dev/null || { echo "[vm] installing bun…"; curl -fsSL https://bun.sh/install | bash; export PATH="$HOME/.bun/bin:$PATH"; }
cd ~/substrate-fed/federation-relay
bun install >/dev/null 2>&1 || bun install
pkill -f 'bun relay.ts' 2>/dev/null || true; sleep 1
PUBLIC_IP="$PUBLIC_IP" RELAY_KEY_FILE="$HOME/substrate-fed/relay-key.pb" nohup bun relay.ts > "$HOME/substrate-fed/relay.log" 2>&1 &
sleep 5
echo "[vm] $(grep RELAY_MULTIADDR "$HOME/substrate-fed/relay.log" | tail -1)"
RELAY
  log "relay up — OPEN inbound TCP 30333 on the VM firewall. Use the printed RELAY_MULTIADDR as RELAY_MULTIADDR for peer vessels."
fi

log "DONE — substrate on the VM at http://${TARGET#*@}:18080 (open firewall ports 18080-18270 as needed)."
log "Future updates: re-run this script (state survives in the named volumes), or push the image to a registry once for one-line 'docker pull' updates."
