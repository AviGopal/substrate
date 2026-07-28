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
  API_KEY_SECRET="${API_KEY_SECRET:-}" ALLOW_INSECURE_API_KEY_SECRET="${ALLOW_INSECURE_API_KEY_SECRET:-}" \
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
# The log can go stale (a relay restarted by hand with a different key file
# leaves relay.log describing a dead peer id — observed: log said …PkEY… while
# the live relay was …J9Jd…, so every circuit addr the hub advertised was
# undialable). Restart the relay from the original clone with the PINNED key
# file and a fresh log so identity, log, and process always agree; clients
# (sidecars, spoke transports) re-reserve and re-register on their own loops.
# NEVER pkill + respawn a relay already serving :30333: a hand-restart with a
# different key file mints a DIVERGENT peer-id (observed: relay.log/env pinned
# …PkEY… while the live relay was …J9Jd…), leaving every advertised circuit addr
# undialable — and it races the port with any systemd-managed relay. Instead:
# prefer the managed unit; if a relay is already listening, LEAVE IT and read its
# live multiaddr; only hand-start (with the PINNED key file it persisted) when
# nothing serves the port. Clients re-reserve on their own loops.
RELAY_KEY_FILE="${RELAY_KEY_FILE:-$HOME/substrate-fed/relay-key.pb}"
if command -v systemctl >/dev/null 2>&1 && systemctl is-enabled --quiet federation-relay.service 2>/dev/null; then
  echo "[vm] ensuring managed federation-relay.service is up (stable persistent key)…"
  systemctl start federation-relay.service 2>/dev/null || true; sleep 3
  RELAY_MULTIADDR="${RELAY_MULTIADDR:-$(journalctl -u federation-relay.service --no-pager 2>/dev/null | grep -oE '/ip4/[^ "]*p2p/[A-Za-z0-9]+' | tail -1)}"
elif ss -ltn 2>/dev/null | grep -q ':30333 '; then
  echo "[vm] a relay is already serving :30333 — leaving it untouched, reading its live multiaddr…"
else
  echo "[vm] no relay on :30333 — hand-starting once with the pinned key file…"
  export PATH="$HOME/.bun/bin:$PATH"
  RELAY_DIR="$HOME/substrate-fed/federation-relay"; [ -d "$RELAY_DIR" ] || RELAY_DIR="$HOME/substrate/scripts/substrate/federation-relay"
  [ -d "$RELAY_DIR" ] && ( cd "$RELAY_DIR" && PUBLIC_IP="$PUBLIC_IP" RELAY_KEY_FILE="$RELAY_KEY_FILE" nohup bun relay.ts > "$HOME/relay.log" 2>&1 & )
  sleep 6
fi
RELAY_MULTIADDR="${RELAY_MULTIADDR:-$(grep -oE '/ip4/[^ "]*p2p/[A-Za-z0-9]+' "$HOME/relay.log" 2>/dev/null | tail -1 || true)}"
[ -n "$RELAY_MULTIADDR" ] && echo "[vm] relay multiaddr: $RELAY_MULTIADDR" \
  || echo "[vm] WARNING: no relay multiaddr found — federation egress will stay down (hub cannot dial spoke vessels)"
# LLM provider keys live on the VM host's /etc/environment (never in the image).
# Thread them into the container so gen-env round-trips them into
# /etc/substrate/env — the llm-resolver siblings (google/chutes/openrouter arms)
# ExecCondition on their key being present and silently skip otherwise, which is
# how two container swaps quietly killed the hub's non-anthropic LLM capacity.
LLM_KEY_ARGS=""
for k in GOOGLE_API_KEY GROQ_API_KEY MISTRAL_API_KEY CHUTES_API_KEY OPENROUTER_API_KEY SUBSTRATE_GIT_PAT; do
  v=$(grep -E "^${k}=" /etc/environment 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
  [ -n "$v" ] && LLM_KEY_ARGS="$LLM_KEY_ARGS -e ${k}=${v}"
done
[ -n "$LLM_KEY_ARGS" ] && echo "[vm] threading host LLM keys into the container: $(echo "$LLM_KEY_ARGS" | grep -oE '[A-Z_]+=' | tr -d = | tr '\n' ' ')"
# API key signing secret: pass a strong API_KEY_SECRET to ROTATE (gen-env persists
# it to /workspace/.substrate-secrets; already-issued keys signed with the old
# secret stop validating — re-issue them). Pass ALLOW_INSECURE_API_KEY_SECRET=1
# instead to keep an existing deployment's legacy default and preserve its keys.
# Neither set + an existing datastore on the legacy default → gen-env fails closed.
SECRET_ARGS=""
[ -n "${API_KEY_SECRET:-}" ]                 && SECRET_ARGS="$SECRET_ARGS -e API_KEY_SECRET=${API_KEY_SECRET}"
[ -n "${ALLOW_INSECURE_API_KEY_SECRET:-}" ]  && SECRET_ARGS="$SECRET_ARGS -e ALLOW_INSECURE_API_KEY_SECRET=${ALLOW_INSECURE_API_KEY_SECRET}"
[ -n "$SECRET_ARGS" ] && echo "[vm] threading API_KEY_SECRET handling: $(echo "$SECRET_ARGS" | grep -oE '[A-Z_]+=' | tr -d = | tr '\n' ' ')"
# shellcheck disable=SC2086
docker run -d --name substrate-live --privileged \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  $LLM_KEY_ARGS \
  $SECRET_ARGS \
  -e ENABLED_ROLES=hub -e SUBSTRATE_BIND_HOST=0.0.0.0 \
  -e SUBSTRATE_ROOT="${SUBSTRATE_ROOT:-/workspace/git/super-repo}" \
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

# 4b. Install + enable the federation egress. The unit is referenced by
#     vessels.inventory.json (role transport, manifest:true — so apply-inventory
#     never manages it) and the image does NOT ship the unit file; without it
#     the hub's discovery advertises federated rows at 127.0.0.1:8401 that
#     nothing serves, and every cross-substrate resolve dies with forward_failed.
#     The unit runs the transport server from the workspace super-repo clone.
if [ -n "$RELAY_MULTIADDR" ]; then
  echo "[vm] installing + enabling federation-transport-vessel (hub egress on :8401)…"
  docker exec -i substrate-live sh -c 'cat > /etc/systemd/system/federation-transport-vessel.service' <<'UNIT'
[Unit]
Description=libp2p reachability + cross-substrate resolve-over-http + /health sensing surface.
After=network.target discovery-vessel.service federation-relay.service

[Service]
Type=simple
EnvironmentFile=/etc/substrate/env
EnvironmentFile=-/workspace/.substrate-secrets
Environment=FED_HEALTH_PORT=8401
Environment=DISCOVERY_URL=http://127.0.0.1:8100
WorkingDirectory=/workspace/git/super-repo/scripts/substrate/federation-relay
ExecStart=/root/.bun/bin/bun /workspace/git/super-repo/scripts/substrate/federation-relay/federation-transport-server.ts
ExecStopPost=-/usr/local/bin/discovery-deregister federation-transport-vessel
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT
  docker exec substrate-live systemctl daemon-reload
  docker exec substrate-live systemctl enable --now federation-transport-vessel \
    || echo "[vm] WARNING: federation egress failed to start — cross-substrate resolves will forward_fail"
else
  echo "[vm] WARNING: no RELAY_MULTIADDR — skipping federation egress; hub cannot dial spokes"
fi

# 4c. Enable the multi-provider LLM resolver ON THE HUB. It is a role=compute
#     vessel, so ENABLED_ROLES=hub masks it — but the hub carries the provider
#     keys (google/groq/mistral/chutes/openrouter, threaded above) and should
#     serve them as resolver arms. Unmask + enable so the hub runs LLM compute
#     from its own /etc/environment secrets (not only the anthropic haiku/opus
#     arms). Idempotent; survives future rolls because this runs every deploy.
if grep -qE '^(GOOGLE|GROQ|MISTRAL|CHUTES|OPENROUTER)_API_KEY=' /etc/environment 2>/dev/null; then
  echo "[vm] enabling multi-provider llm-resolver-vessel on the hub…"
  docker exec substrate-live systemctl unmask llm-resolver-vessel.service >/dev/null 2>&1 || true
  docker exec substrate-live systemctl daemon-reload
  docker exec substrate-live systemctl enable --now llm-resolver-vessel.service \
    || echo "[vm] WARNING: llm-resolver-vessel failed to start — hub LLM compute stays anthropic-only"
fi

echo "[vm] === HUB status ==="
echo -n "[vm] discovery:    "; curl -s http://localhost:18100/health | head -c 140; echo
echo -n "[vm] llm-resolver: "; docker exec substrate-live systemctl is-active llm-resolver-vessel.service 2>/dev/null;
echo -n "[vm] activity-api: "; curl -s http://localhost:18080/health | head -c 140; echo
echo -n "[vm] trace store:  "; curl -s http://localhost:18080/metrics/db 2>/dev/null \
  | grep -oE '"traceStore":\{[^}]*\}' || echo '(metrics/db needs auth — check post-boot)'
echo
REMOTE

echo "[deploy-hub-pull] DONE. Hub at http://${TARGET#*@}:18100 (discovery) / :18080 (activity-api)."
echo "[deploy-hub-pull] Learning-state volumes preserved; host relay left running (multiaddr unchanged)."
