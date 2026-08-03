#!/usr/bin/env bash
# deploy-hub.sh — deploy the shared-namespace HUB to a VM by PULLING the repo and
# building THERE (no local image ship). The hub runs the control plane + store + relay
# (ENABLED_ROLES=hub → surrealdb, valkey, discovery, identity, activity-api, seed, infra),
# seeds the single shared org (so every spoke that registers with a hub-issued key lands
# in the same namespace), and stands up the libp2p relay for NAT traversal.
#
# WHY pull-the-repo: dogfoods the 3-step bootstrap (clone → secrets → start), avoids a
# multi-GB `docker save | ssh` transfer, and lets the VM self-update with `git pull`.
#
# Usage:
#   GITHUB_PAT=ghp_xxx  ANTHROPIC_API_KEY=sk-ant-xxx  SSH_KEY=~/.ssh/syzygy_deploy \
#     bash deploy-hub.sh root@138.197.116.56 138.197.116.56
#
# The PAT needs `repo` scope (to clone the private super-repo + submodules). It is used
# transiently on the VM (insteadOf rewrite for the clone) and scrubbed from git config
# after. VM needs ssh access; git + docker are auto-installed if absent.
set -euo pipefail

TARGET="${1:?usage: deploy-hub.sh user@vm-ip public-ip}"
PUBLIC_IP="${2:?usage: deploy-hub.sh user@vm-ip public-ip}"
REPO="${REPO:-AviGopal/substrate}"
BRANCH="${BRANCH:-dev}"
PAT="${GITHUB_PAT:?set GITHUB_PAT (repo scope) — needed to clone the private repo + submodules}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(jq -r '.providers.anthropic.apiKey // empty' "$HOME/.metabob/config.json" 2>/dev/null || true)}"
[ -n "$ANTHROPIC_API_KEY" ] || { echo "ERROR: set ANTHROPIC_API_KEY"; exit 1; }
SSH_KEY="${SSH_KEY:-}"
SSH=(ssh -o StrictHostKeyChecking=accept-new); [ -n "$SSH_KEY" ] && SSH+=(-i "$SSH_KEY")
# The image tag `make build` produces (Makefile: IMAGE:=ghcr.io/avigopal/substrate,
# TAG:=dev). Build and run MUST reference the same tag, so it flows through to the
# remote docker run below.
IMAGE="${IMAGE:-ghcr.io/avigopal/substrate:dev}"

echo "[deploy-hub] pulling $REPO@$BRANCH on $TARGET and building the hub there…"
"${SSH[@]}" "$TARGET" \
  PAT="$PAT" REPO="$REPO" BRANCH="$BRANCH" IMAGE="$IMAGE" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" PUBLIC_IP="$PUBLIC_IP" \
  'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq || true
command -v git    >/dev/null || apt-get install -y -qq git
command -v make   >/dev/null || apt-get install -y -qq make          # fresh Ubuntu lacks make
command -v jq     >/dev/null || apt-get install -y -qq jq
command -v unzip  >/dev/null || apt-get install -y -qq unzip          # bun's installer needs unzip
command -v docker >/dev/null || { curl -fsSL https://get.docker.com | sh; }

# Token rewrite so HTTPS-form submodule URLs (https://github.com/...) clone with the PAT.
# (The git@github.com: rewrite is kept as a harmless fallback for any legacy SSH-form URL.)
REW="url.https://x-access-token:${PAT}@github.com/.insteadOf"
# Idempotency: a prior run that died before its scrub leaves multiple values;
# plain `git config` then fails "cannot overwrite multiple values". Clear first
# (also scrub any stale-token variant of the same key).
git config --global --unset-all "$REW" 2>/dev/null || true
for k in $(git config --global --list --name-only 2>/dev/null | grep -iE "^url\..*x-access-token.*\.insteadof$" | sort -u); do
  git config --global --unset-all "$k" 2>/dev/null || true
done
git config --global "$REW" "git@github.com:"
git config --global --add "$REW" "https://github.com/"

DIR="$HOME/substrate"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH" -q
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" pull --ff-only -q origin "$BRANCH"
else
  git clone --branch "$BRANCH" -q \
    "https://x-access-token:${PAT}@github.com/${REPO}.git" "$DIR"
fi
cd "$DIR"
# Init all submodules from the explicit path list (recursive-init aborts the whole run
# on any single failure, so we init each recorded path independently).
SUB_PATHS=$(git config -f .gitmodules --get-regexp '\.path$' | awk '{print $2}')
git submodule update --init $SUB_PATHS 2>/dev/null || true
# LOUD staleness check: a masked submodule-update failure bakes STALE vessel
# source into the image (the hub shipped a discovery-vessel from weeks ago and
# silently dropped the libp2p contract fields, 2026-07-02). '+' = checked-out
# commit differs from the pointer this super-repo commit records.
STALE=$(git submodule status $SUB_PATHS 2>/dev/null | grep '^+' || true)
if [ -n "$STALE" ]; then
  echo "[vm] WARNING: submodules NOT at recorded pointers (stale source will be baked):"
  echo "$STALE"
fi
# Repair submodules whose working tree didn't materialize (checked-out commit but empty
# tree — a checkout anomaly seen on fresh clones); reset --hard restores the files.
git submodule foreach 'git reset --hard HEAD >/dev/null 2>&1 || true' >/dev/null 2>&1 || true

# bun is needed by the Makefile's validate-build (host side); the image itself bundles bun.
export PATH="$HOME/.bun/bin:$PATH"
command -v bun >/dev/null || { curl -fsSL https://bun.sh/install | bash; export PATH="$HOME/.bun/bin:$PATH"; }

echo "[vm] building the substrate image (first run: 20-30 min)…"
make -C scripts/substrate build

echo "[vm] starting the HUB subset (control plane + store + relay-ready)…"
docker volume create substrate-surreal   >/dev/null 2>&1 || true
docker volume create substrate-workspace >/dev/null 2>&1 || true
docker rm -f substrate-live >/dev/null 2>&1 || true
# Federation egress env: the hub role runs federation-transport-vessel (:8401),
# which dies without RELAY_MULTIADDR and leaves hub discovery advertising spoke
# rows it cannot dial. The relay key file keeps the multiaddr stable, so a prior
# deploy's relay.log is authoritative; on the very first deploy (no relay yet)
# this stays empty — re-run the deploy once the relay is up to enable egress.
RELAY_MULTIADDR="${RELAY_MULTIADDR:-$(grep -oE '/ip4/[^ "]*p2p/[A-Za-z0-9]+' "$HOME/relay.log" 2>/dev/null | tail -1 || true)}"
[ -n "$RELAY_MULTIADDR" ] && echo "[vm] relay multiaddr: $RELAY_MULTIADDR" \
  || echo "[vm] WARNING: no relay.log yet — hub federation egress disabled until a re-deploy after the relay starts"
# Published ports. 18080/18100/18101/18210 are the federation contract (trace
# store, discovery, identity, goal dispatch). 18090 (development-vessel) and
# 18260 (concept-db) are published because a SPOKE reaches them over the host
# network: the spoke masks its own concept-db (DISABLED_VESSELS) and resolves
# memoryNote/compose_lesson/reach_gate_lesson against the hub. Without these two
# the spoke's drafter reads no lessons and its recipe goal-generator (which is
# fail-open on concept-db) mints nothing — silently, with no error anywhere.
docker run -d --name substrate-live --privileged \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ENABLED_ROLES=hub -e ENABLED_EXTRA_VESSELS="${ENABLED_EXTRA_VESSELS:-development-vessel.service}" -e SUBSTRATE_BIND_HOST=0.0.0.0 \
  -e SUBSTRATE_ROOT="${SUBSTRATE_ROOT:-/workspace/git/super-repo}" \
  -e PUBLIC_IP="$PUBLIC_IP" -e FED_PUBLIC_IP="$PUBLIC_IP" \
  -e RELAY_MULTIADDR="$RELAY_MULTIADDR" \
  -e FED_SUBSTRATE_ID="${FED_SUBSTRATE_ID:-syzygy-hub}" \
  -e HUB_DISCOVERY_URL="http://localhost:8100" \
  -p 18080:8080 -p 18100:8100 -p 18101:8101 -p 18210:8210 \
  -p 18090:8090 -p 18260:8260 \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  --tmpfs /run --tmpfs /run/lock "$IMAGE"

# Scrub the token from persistent git config now that the clone/build is done.
git config --global --unset-all "$REW" 2>/dev/null || true

echo "[vm] waiting for the control plane…"
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:18100/health 2>/dev/null && break; sleep 3; done
echo "[vm] seeding the shared org (identity authority for the namespace)…"
docker exec substrate-live bash -c 'set -a; source /etc/substrate/env 2>/dev/null; set +a; bun /vessels/seed-identity.ts' 2>&1 | grep -iE 'issued|org|key' | head -3 || true

# Relay for NAT traversal: run it from the cloned federation-relay dir under nohup
# (the VM has the public IP → it's the natural relay anchor). PUBLIC_IP is honored.
export PATH="$HOME/.bun/bin:$PATH"
command -v bun >/dev/null || { curl -fsSL https://bun.sh/install | bash; export PATH="$HOME/.bun/bin:$PATH"; }
cd "$DIR/scripts/substrate/federation-relay"
bun install >/dev/null 2>&1 || bun install
# Stable identity: always use the SAME persisted key file so the relay's peer-id
# survives restarts (a fresh/hand key mints a divergent id → stale relay.log →
# undialable circuits). Prefer a managed systemd unit; NEVER pkill+clobber a relay
# already serving :30333 (that races the port and can diverge the peer-id).
RELAY_KEY_FILE="${RELAY_KEY_FILE:-$HOME/substrate-fed/relay-key.pb}"
if command -v systemctl >/dev/null 2>&1 && systemctl is-enabled --quiet federation-relay.service 2>/dev/null; then
  systemctl start federation-relay.service 2>/dev/null || true
elif ! ss -ltn 2>/dev/null | grep -q ':30333 '; then
  PUBLIC_IP="$PUBLIC_IP" RELAY_KEY_FILE="$RELAY_KEY_FILE" nohup bun relay.ts > "$HOME/relay.log" 2>&1 &
fi
sleep 6

echo "[vm] === HUB status ==="
echo -n "[vm] discovery: "; curl -s http://localhost:18100/health | head -c 120; echo
echo -n "[vm] activity-api: "; curl -s http://localhost:18080/health | head -c 120; echo
grep RELAY_MULTIADDR "$HOME/relay.log" | tail -1 || echo "[vm] relay multiaddr pending — check ~/relay.log"
REMOTE

echo "[deploy-hub] DONE. Hub at http://${TARGET#*@}:18100 (discovery) / :18080 (activity-api)."
echo "[deploy-hub] Open the VM firewall: 18080, 18100, 18101, 18210 (TCP) + 30333/tcp (relay)."
echo "[deploy-hub] Use the printed RELAY_MULTIADDR as RELAY_MULTIADDR for spoke sidecars."
