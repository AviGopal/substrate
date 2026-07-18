#!/usr/bin/env bash
# deploy-hub-pull.sh — redeploy the HUB by PULLING the prebuilt image from ghcr
# instead of cloning + building on the VM (deploy-hub.sh's 20-30 min path).
#
# WHY: build-substrate-image.yml publishes ghcr.io/<owner>/substrate:{dev,<sha>}
# on every push to dev. Once that image exists, a hub update is a ~2 min pull +
# container swap — no repo on the VM, no bun/make toolchain, no on-VM build. The
# learning state (Thompson posteriors, trace store, seeded identity) lives in the
# named volumes substrate-surreal + substrate-workspace and is PRESERVED across
# the swap; only the code image changes. The host-side libp2p relay is left
# running untouched (its key file + multiaddr stay stable).
#
# Usage:
#   GHCR_TOKEN=<pat-with-read:packages>  GHCR_USER=<gh-user>  SSH_KEY=~/.ssh/syzygy_deploy \
#     ANTHROPIC_API_KEY=sk-ant-...  bash deploy-hub-pull.sh root@138.197.116.56 138.197.116.56
#
# GHCR_TOKEN needs the `read:packages` scope (the image is private — it bakes
# vessel source). A classic PAT with only `repo` scope is NOT enough. Get one via
# `gh auth refresh -s read:packages` then `gh auth token`, or a fine-grained PAT.
set -euo pipefail

TARGET="${1:?usage: deploy-hub-pull.sh user@vm-ip public-ip}"
PUBLIC_IP="${2:?usage: deploy-hub-pull.sh user@vm-ip public-ip}"
OWNER="${GHCR_OWNER:-avigopal}"                  # ghcr namespace (lowercase)
IMAGE="${IMAGE:-ghcr.io/${OWNER}/substrate:dev}"
GHCR_USER="${GHCR_USER:?set GHCR_USER (github username for ghcr login)}"
GHCR_TOKEN="${GHCR_TOKEN:?set GHCR_TOKEN (PAT with read:packages)}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(jq -r '.providers.anthropic.apiKey // empty' "$HOME/.metabob/config.json" 2>/dev/null || true)}"
[ -n "$ANTHROPIC_API_KEY" ] || { echo "ERROR: set ANTHROPIC_API_KEY"; exit 1; }
SSH_KEY="${SSH_KEY:-}"
SSH=(ssh -o StrictHostKeyChecking=accept-new); [ -n "$SSH_KEY" ] && SSH+=(-i "$SSH_KEY")

echo "[deploy-hub-pull] pulling $IMAGE onto $TARGET and swapping the hub container…"
"${SSH[@]}" "$TARGET" \
  IMAGE="$IMAGE" GHCR_USER="$GHCR_USER" GHCR_TOKEN="$GHCR_TOKEN" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" PUBLIC_IP="$PUBLIC_IP" \
  'bash -s' <<'REMOTE'
set -euo pipefail
command -v docker >/dev/null || { echo "[vm] installing docker…"; curl -fsSL https://get.docker.com | sh; }

# 1. Authenticate to ghcr (private package) and pull the new image.
echo "[vm] docker login ghcr.io as $GHCR_USER…"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
echo "[vm] pulling $IMAGE…"
OLD_ID=$(docker image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null || echo none)
docker pull "$IMAGE"
NEW_ID=$(docker image inspect "$IMAGE" --format '{{.Id}}')
echo "[vm] image ${OLD_ID:7:12} -> ${NEW_ID:7:12}"
# Alias to the legacy tag so any tooling that references metabob/substrate:dev still resolves.
docker tag "$IMAGE" metabob/substrate:dev

# 2. Preserve learning state: the named volumes are NOT touched. Only swap the container.
docker volume create substrate-surreal   >/dev/null 2>&1 || true
docker volume create substrate-workspace >/dev/null 2>&1 || true
echo "[vm] stopping old hub container (volumes preserved)…"
docker rm -f substrate-live >/dev/null 2>&1 || true

# 3. Re-run the HUB subset with the exact same flags deploy-hub.sh uses.
# The hub role enables federation-transport-vessel (the data-plane egress on
# 8401 that hub discovery forwards federated resolves to), but the vessel dies
# without RELAY_MULTIADDR — leaving the hub advertising spoke rows it cannot
# dial (forward_failed on every federated shape). The host-side relay's
# multiaddr is stable across swaps; read it from the relay log and thread it
# (plus a substrate id and the hub's own discovery) into the container.
RELAY_MULTIADDR="${RELAY_MULTIADDR:-$(grep -oE '/ip4/[^ "]*p2p/[A-Za-z0-9]+' "$HOME/relay.log" 2>/dev/null | tail -1 || true)}"
[ -n "$RELAY_MULTIADDR" ] && echo "[vm] relay multiaddr: $RELAY_MULTIADDR" \
  || echo "[vm] WARNING: no relay multiaddr found — federation egress will stay down (hub cannot dial spoke vessels)"
docker run -d --name substrate-live --privileged \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ENABLED_ROLES=hub -e SUBSTRATE_BIND_HOST=0.0.0.0 \
  -e PUBLIC_IP="$PUBLIC_IP" -e FED_PUBLIC_IP="$PUBLIC_IP" \
  -e RELAY_MULTIADDR="$RELAY_MULTIADDR" \
  -e FED_SUBSTRATE_ID="${FED_SUBSTRATE_ID:-syzygy-hub}" \
  -e HUB_DISCOVERY_URL="http://localhost:8100" \
  -p 18080:8080 -p 18100:8100 -p 18101:8101 -p 18210:8210 \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  --tmpfs /run --tmpfs /run/lock "$IMAGE"
docker logout ghcr.io >/dev/null 2>&1 || true

# 4. Wait for the control plane. Identity is already seeded in the volume; the
#    boot identity-seeder is mint-on-first-boot and no-ops when the org exists.
echo "[vm] waiting for the control plane…"
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:18100/health 2>/dev/null && break; sleep 3; done

# 4b. Enable the federation egress. The unit ships in the image with role
#     "transport" (in the hub role-group) but is marked manifest:true in
#     vessels.inventory.json, so apply-inventory never enables it — without this
#     the hub's discovery advertises federated rows at 127.0.0.1:8401 that
#     nothing serves, and every cross-substrate resolve dies with forward_failed.
if [ -n "$RELAY_MULTIADDR" ]; then
  echo "[vm] enabling federation-transport-vessel (hub egress on :8401)…"
  docker exec substrate-live systemctl enable --now federation-transport-vessel \
    || echo "[vm] WARNING: federation egress failed to start — cross-substrate resolves will forward_fail"
else
  echo "[vm] WARNING: no RELAY_MULTIADDR — skipping federation egress; hub cannot dial spokes"
fi

echo "[vm] === HUB status ==="
echo -n "[vm] discovery:    "; curl -s http://localhost:18100/health | head -c 140; echo
echo -n "[vm] activity-api: "; curl -s http://localhost:18080/health | head -c 140; echo
echo -n "[vm] trace store:  "; curl -s http://localhost:18080/metrics/db 2>/dev/null \
  | grep -oE '"traceStore":\{[^}]*\}' || echo '(metrics/db needs auth — check post-boot)'
echo
REMOTE

echo "[deploy-hub-pull] DONE. Hub at http://${TARGET#*@}:18100 (discovery) / :18080 (activity-api)."
echo "[deploy-hub-pull] Learning-state volumes preserved; host relay left running (multiaddr unchanged)."
