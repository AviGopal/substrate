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

echo "[deploy-hub] pulling $REPO@$BRANCH on $TARGET and building the hub there…"
"${SSH[@]}" "$TARGET" \
  PAT="$PAT" REPO="$REPO" BRANCH="$BRANCH" \
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

# Token rewrite so SSH-form submodule URLs (git@github.com:...) clone over HTTPS+PAT.
REW="url.https://x-access-token:${PAT}@github.com/.insteadOf"
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
# Init all submodules EXCEPT metabob-mcp (different org — MetabobProject — the PAT can't
# reach it, and it's not needed for any hub/compute vessel). Recursive-init aborts the
# whole run on that one failure, so we init the explicit path list instead.
SUB_PATHS=$(git config -f .gitmodules --get-regexp '\.path$' | awk '{print $2}' | grep -v 'metabob-mcp')
git submodule update --init $SUB_PATHS 2>/dev/null || true
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
docker run -d --name substrate-live --privileged \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ENABLED_ROLES=hub -e SUBSTRATE_BIND_HOST=0.0.0.0 \
  -e PUBLIC_IP="$PUBLIC_IP" -e FED_PUBLIC_IP="$PUBLIC_IP" \
  -p 18080:8080 -p 18100:8100 -p 18101:8101 -p 18210:8210 -p 30333:30333 \
  -v substrate-workspace:/workspace -v substrate-surreal:/var/lib/surrealdb \
  --tmpfs /run --tmpfs /run/lock metabob/substrate:dev

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
pkill -f 'bun relay.ts' 2>/dev/null || true; sleep 1
PUBLIC_IP="$PUBLIC_IP" RELAY_KEY_FILE="$HOME/relay-key.pb" nohup bun relay.ts > "$HOME/relay.log" 2>&1 &
sleep 6

echo "[vm] === HUB status ==="
echo -n "[vm] discovery: "; curl -s http://localhost:18100/health | head -c 120; echo
echo -n "[vm] activity-api: "; curl -s http://localhost:18080/health | head -c 120; echo
grep RELAY_MULTIADDR "$HOME/relay.log" | tail -1 || echo "[vm] relay multiaddr pending — check ~/relay.log"
REMOTE

echo "[deploy-hub] DONE. Hub at http://${TARGET#*@}:18100 (discovery) / :18080 (activity-api)."
echo "[deploy-hub] Open the VM firewall: 18080, 18100, 18101, 18210 (TCP) + 30333/tcp (relay)."
echo "[deploy-hub] Use the printed RELAY_MULTIADDR as RELAY_MULTIADDR for spoke sidecars."
