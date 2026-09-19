#!/usr/bin/env bash
# dojo-up.sh — boot a UI-ONLY federated spoke: the Training Dojo surface plus
# the minimum a substrate needs to hold its own registry, and nothing else.
#
# Forked from ui-only-up.sh (which does the identical thing for
# human-surface-vessel) rather than parameterizing that script: the vessel
# name, its port, and its manifest entry are hardcoded in enough places there
# (the vessel-ctl install call, the image-manifest preflight, the workdir
# path, the systemd unit/drop-in names, the ui/dist build-log path, and the
# hub-registry assert) that threading a flag through all of them would have
# been a bigger, riskier diff than a second file with the same shape. The
# spoke-boot machinery itself (roles=spoke, hub derivation, discovery wait
# loop, port-offset/collision handling) is untouched from that script — none
# of it is human-surface-specific, so none of it needed to change here.
#
# WHAT THIS IS FOR
#   A machine that should show a human the substrate's dojo — lessons,
#   trace/log, tables, diff history — not compute for it. Every shape the
#   surface needs but does not serve — goal_execution, goalWalkState,
#   activity/trace shapes, identity, LLM resolution — is resolved on the hub
#   through discovery fan-out and the federation transport, exactly as
#   documented for human-surface-vessel in
#   openspec/changes/human-surface-stack/federation.md (that document
#   predates this vessel; its account of the spoke-boot mechanism applies
#   here unchanged — only the vessel installed at the end differs).
#
# USAGE
#   dojo-up.sh                                           # everything from config
#   dojo-up.sh --hub http://<hub-host>:18100 --api-key <hub-issued-key> \
#              [--name <container>] [--port-offset <n>] [--git-pat <pat>]
#
#   DRY_RUN=1 dojo-up.sh                                 # print the plan, touch nothing
#
#   With no flags, hub / api-key / git-pat are read from
#   ~/.metabob/config.json (.metabob.hubDiscovery or .metabob.endpoint,
#   .metabob.apiKey, .metabob.gitPat) and from `gh auth token` — the same
#   config every other tool in this tree reads, ui-only-up.sh included.
#
#   --hub        the HUB's discovery endpoint. Supplying it with NO explicit
#                ENABLED_ROLES is what flips the Makefile into the federated-spoke
#                path: ENABLED_ROLES := spoke, HUB_DISCOVERY_URL derived, hub
#                activity-api/identity endpoints derived from the same host, and
#                CONTAINER_DISCOVERY_ENDPOINT deliberately BLANKED so local
#                vessels still register with THIS substrate's own registry.
#                All of that derivation happens in the Makefile — this script
#                never re-derives any of it in bash.
#   --api-key    a HUB-ISSUED key. A locally minted key is not valid on the hub.
#   --git-pat    a GitHub PAT with read access to the super-repo. REQUIRED —
#                see "WHY A GIT CREDENTIAL IS MANDATORY" below.
#
# WHY ENABLED_VESSELS AND NOT A ROLE
#   apply-inventory.sh SUBTRACTS: the image bakes the full enable list and the
#   inventory selection trims it. Precedence is ENABLED_VESSELS (explicit
#   allow-list, wins outright) > ENABLED_ROLES > all. So the explicit list below
#   overrides the auto-set `ENABLED_ROLES := spoke` — intended: the spoke role
#   group still carries the whole compute fleet, which is exactly what a UI-only
#   box must not run.
#
# WHY training-dojo-vessel IS NOT IN THAT LIST
#   It is a MANIFEST vessel ("manifest": true in vessels.inventory.json), and
#   apply-inventory's manageable_units() skips manifest entries entirely — they
#   are never masked and never selected. It is installed after readiness with
#   vessel-ctl, from the manifest. That install needs the super-repo clone at
#   /workspace/git/super-repo (its manifest workdir), which is why
#   git-push-setup.service is in the unit list below and not optional.
#
# WHY A GIT CREDENTIAL IS MANDATORY
#   The dojo's manifest workdir is $REPO_ROOT/repos/training-dojo-vessel
#   inside the super-repo clone. The super-repo is PRIVATE, so an anonymous
#   clone 401s. setup-git-push.sh configures the credential helper only when
#   SUBSTRATE_GIT_PAT is non-empty — GITHUB_TOKEN alone never engages it. With
#   no PAT the clone fails and the script falls back to the baked image seed,
#   which carries scripts/ ONLY and no repos/. The dojo then has no workdir
#   and the install cannot proceed. Refusing up front beats failing at step 4
#   with a confusing "workdir missing".
#
# NOTE ON AN ALREADY-RUNNING SUBSTRATE
#   This script refuses if its target container name already exists, and refuses
#   if any host port it would publish is already listening. It never stops,
#   recreates, or reconfigures an existing container. On a host that already
#   runs a substrate — including a human-surface-vessel deployment from
#   ui-only-up.sh — pass a distinct --name AND a --port-offset (the DEFAULT
#   --name already differs from ui-only-up.sh's, so the two can usually run
#   side by side on one host with just distinct port offsets).
set -euo pipefail

HUB=""
API_KEY=""
NAME="substrate-dojo"
PORT_OFFSET=""
GIT_PAT="${SUBSTRATE_GIT_PAT:-}"
DRY_RUN="${DRY_RUN:-0}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE="ghcr.io/avigopal/substrate"
TAG="dev"

# Every host port run-live publishes (base values; the offset is added below).
# 18320, not 18310 — training-dojo-vessel's own port (vessels.manifest.json).
BASE_PORTS="18080 18090 18100 18101 18210 18250 18260 18270 18320"
SURFACE_BASE_PORT=18320

usage() {
  cat >&2 <<'USAGE'
dojo-up.sh — boot a UI-ONLY federated spoke (the Training Dojo surface + the
minimum a substrate needs to hold its own registry; everything else resolves
on the hub).

  dojo-up.sh [--hub <url>] [--api-key <key>] [--name <container>]
             [--port-offset <n>] [--git-pat <pat>]

With no flags all three credentials come from ~/.metabob/config.json and
`gh auth token`. Pass a flag only to override what config already says.

  --hub <url>          The HUB's discovery endpoint, e.g. http://<host>:18100.
                       Default: .metabob.hubDiscovery, else .metabob.endpoint.
                       Supplying it with no explicit ENABLED_ROLES is what
                       engages the federated-spoke path.
  --api-key <key>      A HUB-ISSUED key. Default: .metabob.apiKey. A locally
                       minted key is not valid on the hub and every hub-facing
                       call 401s.
  --git-pat <pat>      Read access to the private super-repo, whose clone is
                       the dojo's manifest workdir. Default:
                       $SUBSTRATE_GIT_PAT, else .metabob.gitPat, else
                       `gh auth token`.
  --name <container>   Container name. Default: substrate-dojo. Must NOT be an
                       existing container — this script refuses rather than
                       touch one.
  --port-offset <n>    Added to every published host port (0 = defaults). Use it
                       whenever another substrate already holds 18xxx on this host
                       (including a human-surface-vessel deployment from
                       ui-only-up.sh, if it is running with offset 0 too).
  DRY_RUN=1            Print the plan AND the exact docker command, then exit
                       without executing anything.

Full spoke-boot behaviour (shared with human-surface-vessel's identical
mechanism): openspec/changes/human-surface-stack/federation.md
USAGE
  exit "${1:-2}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --hub)         HUB="${2:-}"; shift 2 ;;
    --api-key)     API_KEY="${2:-}"; shift 2 ;;
    --git-pat)     GIT_PAT="${2:-}"; shift 2 ;;
    --name)        NAME="${2:-}"; shift 2 ;;
    --port-offset) PORT_OFFSET="${2:-}"; shift 2 ;;
    -h|--help)     usage 0 ;;
    *) echo "[dojo-up] ERROR: unknown argument '$1'" >&2; usage 2 ;;
  esac
done

fail() { echo "[dojo-up] ERROR: $*" >&2; echo >&2; usage 2; }
die()  { echo "[dojo-up] ERROR: $*" >&2; exit 1; }

# ── Defaults from the config file every other tool already reads ─────────────
CONFIG_FILE="${METABOB_CONFIG:-$HOME/.metabob/config.json}"
cfg() {
  [ -r "$CONFIG_FILE" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0
  jq -r "$1 // empty" "$CONFIG_FILE" 2>/dev/null || true
}
CFG_SOURCE=""
if [ -z "$HUB" ]; then
  HUB="$(cfg '.metabob.hubDiscovery')"
  [ -z "$HUB" ] && HUB="$(cfg '.metabob.endpoint')"
  [ -n "$HUB" ] && CFG_SOURCE="$CFG_SOURCE hub"
fi
if [ -z "$API_KEY" ]; then
  API_KEY="$(cfg '.metabob.apiKey')"
  [ -n "$API_KEY" ] && CFG_SOURCE="$CFG_SOURCE api-key"
fi
if [ -z "$GIT_PAT" ]; then
  GIT_PAT="$(cfg '.metabob.gitPat')"
  [ -z "$GIT_PAT" ] && GIT_PAT="$(gh auth token 2>/dev/null || true)"
  [ -n "$GIT_PAT" ] && CFG_SOURCE="$CFG_SOURCE git-pat"
fi
[ -n "$CFG_SOURCE" ] && echo "[dojo-up] filled from $CONFIG_FILE / gh:$CFG_SOURCE" >&2

[ -n "$HUB" ]     || fail "no hub. Pass --hub <url>, or set .metabob.endpoint in $CONFIG_FILE."
[ -n "$API_KEY" ] || fail "no api key. Pass --api-key <hub-issued key>, or set .metabob.apiKey in $CONFIG_FILE. A locally minted key is rejected by the hub."
[ -n "$NAME" ]    || fail "--name must not be empty."
case "$HUB" in http://*|https://*) : ;; *) fail "--hub must be a URL, e.g. http://<hub-host>:18100 (got '$HUB')." ;; esac
if [ -n "$PORT_OFFSET" ]; then
  case "$PORT_OFFSET" in ''|*[!0-9]*) fail "--port-offset must be a non-negative integer (got '$PORT_OFFSET')." ;; esac
fi
OFFSET="${PORT_OFFSET:-0}"

if [ -z "$GIT_PAT" ]; then
  cat >&2 <<'EOF'
[dojo-up] ERROR: no git credential. Pass --git-pat <pat>, export SUBSTRATE_GIT_PAT,
[dojo-up] set .metabob.gitPat in the config file, or run `gh auth login` (this
[dojo-up] script reads `gh auth token` when nothing else supplies one).

[dojo-up] Why this is fatal and not a warning — the causal chain:
[dojo-up]   the dojo's manifest workdir is
[dojo-up]     /workspace/git/super-repo/repos/training-dojo-vessel
[dojo-up]   the super-repo is PRIVATE, so an anonymous clone 401s;
[dojo-up]   setup-git-push.sh arms the git credential helper ONLY when
[dojo-up]   SUBSTRATE_GIT_PAT is non-empty (GITHUB_TOKEN alone does not);
[dojo-up]   with no helper the clone fails and falls back to the baked image
[dojo-up]   seed, which contains scripts/ and NO repos/;
[dojo-up]   so the dojo has no workdir and cannot be installed at all.
EOF
  exit 1
fi

# ── The minimal unit set ─────────────────────────────────────────────────────
# Identical to ui-only-up.sh's — this is generic UI-only-spoke infrastructure,
# not human-surface-specific. See that script's equivalent comment block for
# the per-unit rationale; not repeated here verbatim to avoid the two drifting
# out of sync in prose while staying in sync in behaviour.
UI_ONLY_VESSELS="surrealdb.service,valkey.service,discovery-vessel.service,git-push-setup.service,substrate-ready.service,journald-stdout-forwarder.service,self-recovery.timer,self-recovery.service,substrate-pull-sync.timer,substrate-pull-sync.service"

SURFACE_PORT=$(( OFFSET + SURFACE_BASE_PORT ))
SURFACE_URL="http://127.0.0.1:${SURFACE_PORT}"

# ── Secret hygiene ───────────────────────────────────────────────────────────
redact() {
  sed -E \
    -e 's/(-e [A-Za-z_]*(KEY|TOKEN|PAT|SECRET)[A-Za-z_]*=")[^"]+"/\1<redacted>"/g' \
    -e 's/(sk-ant-|sk-proj-|sk-|gho_|ghp_|ghu_|ghs_|github_pat_)[A-Za-z0-9_-]{8,}/\1<redacted>/g'
}

MAKE_VARS=(
  "LIVE_NAME=$NAME"
  "API_KEY=$API_KEY"
  "DISCOVERY_ENDPOINT=$HUB"
  "ENABLED_VESSELS=$UI_ONLY_VESSELS"
  "SUBSTRATE_GIT_PAT=$GIT_PAT"
  "GITHUB_TOKEN=$GIT_PAT"
  "ANTHROPIC_API_KEY="
  "OPENAI_API_KEY="
  "GOOGLE_API_KEY="
  "GROQ_API_KEY="
  "MISTRAL_API_KEY="
  "OPENROUTER_API_KEY="
  "CHUTES_API_KEY="
  "RUNPOD_API_KEY="
  "RUNPOD_ENDPOINT_ID="
)
[ -n "$PORT_OFFSET" ] && MAKE_VARS+=("PORT_OFFSET=$PORT_OFFSET")

for passthru in IDENTITY_VESSEL_URL IDENTITY_ENDPOINT ACTIVITY_API_ENDPOINT PEER_DISCOVERY_ENDPOINTS; do
  [ -n "${!passthru:-}" ] && MAKE_VARS+=("$passthru=${!passthru}")
done

REDACTED_KEY="${API_KEY:0:4}…(${#API_KEY} chars)"
REDACTED_PAT="${GIT_PAT:0:4}…(${#GIT_PAT} chars)"

PUBLISHED=""
for p in $BASE_PORTS; do PUBLISHED="$PUBLISHED $(( OFFSET + p ))"; done
PUBLISHED="${PUBLISHED# }"

cat <<PLAN
[dojo-up] PLAN
  container        : $NAME
  image            : $IMAGE:$TAG   (make up builds it only if MISSING — a stale
                     image is NOT rebuilt; preflight below checks its manifest)
  hub discovery    : $HUB
  hub api key      : $REDACTED_KEY
  git pat          : $REDACTED_PAT
  port offset      : $OFFSET
  published ports  : $PUBLISHED
  training dojo    : $SURFACE_URL  (host $SURFACE_PORT -> container 8320)
  volumes          : ${NAME}-workspace, ${NAME}-surreal  (namespaced by LIVE_NAME)
  ENABLED_VESSELS  : $UI_ONLY_VESSELS
  auto by Makefile : ENABLED_ROLES=spoke, HUB_DISCOVERY_URL, ACTIVITY_API_ENDPOINT,
                     IDENTITY_VESSEL_URL (hub host), CONTAINER_DISCOVERY_ENDPOINT blanked
  auto by entrypoint: federation-transport-vessel installed + boot-enabled
  after readiness  : vessel-ctl install training-dojo-vessel (manifest vessel, port 8320)

  steps:
    1. preflight: refuse on an existing container, an occupied host port, or an
       image whose baked manifest has no training-dojo-vessel entry
    2. make -C scripts/substrate up  (creates + waits for readiness)
    3. verify /workspace/git/super-repo/repos/training-dojo-vessel exists
    4. write the HOST=0.0.0.0 drop-in, BEFORE the install so first start is
       already correct (same loopback-pin fix as human-surface-vessel's).
    5. vessel-ctl install training-dojo-vessel --container $NAME
       (its post_install builds ui/dist — gitignored, so it MUST be built here)
    6. ASSERT container running
    7. ASSERT ui/dist exists (the install's own exit status cannot prove it)
    8. ASSERT the dojo answers /health FROM THE HOST on $SURFACE_PORT
    9. ASSERT the dojo's shapes appear in the HUB's registry as
       <name>@<FED_SUBSTRATE_ID> — the only proof federation reached the hub
   10. report the federation transport, then a PASS/FAIL verdict block

  this script never stops, recreates, or reconfigures an existing container.
PLAN

echo
echo "[dojo-up] the exact container creation command (\`make -n run-live\`, secrets redacted):"
echo "-------------------------------------------------------------------------------"
make -n -C "$HERE" run-live "${MAKE_VARS[@]}" 2>&1 | redact
echo "-------------------------------------------------------------------------------"
echo

if [ "$DRY_RUN" = "1" ]; then
  echo "[dojo-up] DRY_RUN=1 — nothing was executed. No container, image, volume,"
  echo "[dojo-up] or file was created or changed."
  exit 0
fi

# ── 1. Preflight: refuse before touching anything ────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker not found on PATH."

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  cat >&2 <<EOF
[dojo-up] ERROR: a container named '$NAME' already exists.
[dojo-up] This script will not stop, recreate, or reconfigure it — a running
[dojo-up] substrate holds learning state in its volumes.
[dojo-up] Choose a different name:   --name <other> --port-offset <n>
[dojo-up] Or, if you truly mean to replace it, do so deliberately yourself.
EOF
  exit 1
fi

CONFLICTS=""
if command -v ss >/dev/null 2>&1; then
  LISTENING="$(ss -ltn 2>/dev/null | awk 'NR>1{print $4}' | sed -E 's/.*[:.]([0-9]+)$/\1/' | sort -un)"
  for p in $PUBLISHED; do
    if echo "$LISTENING" | grep -qx "$p"; then CONFLICTS="$CONFLICTS $p"; fi
  done
else
  echo "[dojo-up] WARNING: 'ss' not found — skipping the host-port collision check."
fi
if [ -n "$CONFLICTS" ]; then
  cat >&2 <<EOF
[dojo-up] ERROR: host port(s) already listening:$CONFLICTS
[dojo-up] With --port-offset $OFFSET this launch would publish:$PUBLISHED
[dojo-up] Another substrate almost certainly holds them (a human-surface-vessel
[dojo-up] deployment from ui-only-up.sh included). Pick an offset that clears
[dojo-up] the whole block, e.g. --port-offset $(( OFFSET + 1000 )).
[dojo-up] Occupants:
EOF
  for p in $CONFLICTS; do ss -ltnp 2>/dev/null | grep -E "[:.]$p " >&2 || true; done
  exit 1
fi

if ! docker image inspect "$IMAGE:$TAG" >/dev/null 2>&1; then
  echo "[dojo-up] image $IMAGE:$TAG absent — 'make up' will build it."
elif ! docker run --rm --entrypoint sh "$IMAGE:$TAG" -c \
      'jq -e ".vessels[]|select(.name==\"training-dojo-vessel\")" /usr/local/share/substrate/vessels.manifest.json >/dev/null 2>&1'; then
  cat >&2 <<EOF
[dojo-up] ERROR: $IMAGE:$TAG has no training-dojo-vessel in its baked manifest
[dojo-up]   (/usr/local/share/substrate/vessels.manifest.json).
[dojo-up] 'make up' builds the image only when it is MISSING, so this stale
[dojo-up] one would be reused and 'vessel-ctl install' would fail with
[dojo-up] "vessel not in manifest" only AFTER a full boot. Rebuild first:
[dojo-up]
[dojo-up]   docker build -f Dockerfile.substrate --target base \\
[dojo-up]     -t $IMAGE:$TAG .
[dojo-up]
[dojo-up] --target base is load-bearing: without it the obsidian stage builds
[dojo-up] and :dev silently becomes the obsidian image. Do NOT use 'make build'
[dojo-up] where host bun is unavailable — validate-build runs bun on the host.
EOF
  exit 1
else
  echo "[dojo-up] image preflight OK — baked manifest carries training-dojo-vessel."
fi

if docker volume inspect "${NAME}-workspace" >/dev/null 2>&1; then
  echo "[dojo-up] WARNING: volume '${NAME}-workspace' already exists — its"
  echo "[dojo-up]   /workspace/substrate/fleet/ manifest will be used instead of the"
  echo "[dojo-up]   image's, and will NOT be re-seeded. If the install fails with"
  echo "[dojo-up]   'vessel not in manifest', that stale copy is why."
fi

# ── 2. Boot ──────────────────────────────────────────────────────────────────
echo "[dojo-up] booting '$NAME' as a UI-only federated spoke…"
BOOT_RC=0
make -C "$HERE" up "${MAKE_VARS[@]}" 2>&1 | redact || true
BOOT_RC=${PIPESTATUS[0]}

if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "[dojo-up] ERROR: '$NAME' is not running after boot (make up exit $BOOT_RC)." >&2
  docker logs --tail 60 "$NAME" >&2 2>&1 || true
  exit 1
fi
if [ "$BOOT_RC" != 0 ]; then
  echo "[dojo-up] WARNING: 'make up' exited $BOOT_RC — expected on a trimmed fleet:"
  echo "[dojo-up]   substrate-doctor checks the seeded key against a LOCAL activity-api"
  echo "[dojo-up]   and the registry against a full-fleet floor; neither applies here."
  echo "[dojo-up]   Continuing. The asserts below are the ones that matter."
fi

# ── 3. The manifest workdir must exist before the install ────────────────────
WORKDIR=/workspace/git/super-repo/repos/training-dojo-vessel
if ! docker exec "$NAME" test -d "$WORKDIR"; then
  cat >&2 <<EOF
[dojo-up] ERROR: $WORKDIR is missing in '$NAME'.
[dojo-up] The training-dojo-vessel manifest entry runs out of the super-repo
[dojo-up] clone (workdir \$REPO_ROOT/repos/training-dojo-vessel), which
[dojo-up] git-push-setup.service establishes at boot. It did not.
[dojo-up] What is actually there:
EOF
  docker exec "$NAME" ls /workspace/git/super-repo 2>&1 | sed 's/^/[dojo-up]   /' >&2 || true
  echo "[dojo-up] Only scripts/ present means the PAT clone failed and the baked" >&2
  echo "[dojo-up] image seed was used instead. The journal says which:" >&2
  docker exec "$NAME" journalctl -u git-push-setup -n 40 --no-pager 2>&1 | sed 's/^/[dojo-up]   /' >&2 || true
  exit 1
fi

# ── 4. Un-pin the loopback bind BEFORE first start ───────────────────────────
echo "[dojo-up] pinning the dojo to HOST=0.0.0.0 (drop-in) before install…"
docker exec "$NAME" mkdir -p /etc/systemd/system/training-dojo-vessel.service.d
docker exec "$NAME" bash -c \
  'printf "[Service]\nEnvironment=HOST=0.0.0.0\n" > /etc/systemd/system/training-dojo-vessel.service.d/host.conf'

# ── 5. Install the dojo (manifest vessel — never selected by inventory) ──────
echo "[dojo-up] installing training-dojo-vessel from the manifest…"
INSTALL_RC=0
"$HERE/vessel-ctl.sh" install training-dojo-vessel --container "$NAME" || INSTALL_RC=$?
if [ "$INSTALL_RC" != 0 ]; then
  echo "[dojo-up] ERROR: vessel-ctl install exited $INSTALL_RC." >&2
  echo "[dojo-up] Manifest actually in force inside the container (volume copy wins):" >&2
  docker exec "$NAME" sh -c \
    'for m in /workspace/substrate/fleet/vessels.manifest.json /usr/local/share/substrate/vessels.manifest.json; do
       [ -f "$m" ] && echo "$m: $(jq -r "[.vessels[].name]|join(\",\")" "$m" 2>/dev/null | tr -d "\n" | cut -c1-300)";
     done' 2>&1 | sed 's/^/[dojo-up]   /' >&2 || true
  echo "[dojo-up] Continuing to the asserts so the verdict block still reports." >&2
fi
docker exec "$NAME" systemctl daemon-reload || true
docker exec "$NAME" systemctl restart training-dojo-vessel || true

# ── ASSERTS ──────────────────────────────────────────────────────────────────
PASS_RUNNING=FAIL; PASS_DIST=FAIL; PASS_HEALTH=FAIL; PASS_HUB=FAIL; PASS_FED=FAIL

docker ps --format '{{.Names}}' | grep -qx "$NAME" && PASS_RUNNING=PASS

BUILD_LOG=/workspace/training-dojo-ui-build.log
if docker exec "$NAME" test -d "$WORKDIR/ui/dist"; then
  PASS_DIST=PASS
  echo "[dojo-up] ui/dist present — the dojo has something to serve."
  if docker exec "$NAME" grep -q UI_BUILD_FAILED "$BUILD_LOG" 2>/dev/null; then
    echo "[dojo-up] WARNING: $BUILD_LOG ends in UI_BUILD_FAILED although ui/dist exists —"
    echo "[dojo-up] the dist you are serving is STALE. Read the log before trusting it."
  fi
else
  echo "[dojo-up] ASSERT FAILED: $WORKDIR/ui/dist is missing." >&2
  echo "[dojo-up] vessel-ctl swallowed the build failure; the hook's log is the evidence:" >&2
  docker exec "$NAME" tail -40 "$BUILD_LOG" 2>&1 | sed 's/^/[dojo-up]   /' >&2 \
    || echo "[dojo-up]   (no log — the hook never ran)" >&2
fi

echo "[dojo-up] waiting for $SURFACE_URL/health (up to 90s)…"
HEALTH_BODY=""
for _ in $(seq 1 45); do
  if HEALTH_BODY="$(curl -sf -m 3 "$SURFACE_URL/health" 2>/dev/null)"; then
    PASS_HEALTH=PASS; break
  fi
  sleep 2
done
if [ "$PASS_HEALTH" = PASS ]; then
  echo "[dojo-up] host health: $HEALTH_BODY"
else
  cat >&2 <<EOF
[dojo-up] ASSERT FAILED: $SURFACE_URL/health did not answer from the HOST.
[dojo-up] In-container listener (a 127.0.0.1 bind here is the loopback-pin bug —
[dojo-up] a published port cannot reach it):
EOF
  docker exec "$NAME" sh -c 'ss -ltnp 2>/dev/null | grep 8320 || echo "  (nothing listening on 8320)"' 2>&1 \
    | sed 's/^/[dojo-up]   /' >&2
  echo "[dojo-up] in-container health (proves server-up vs bind-wrong):" >&2
  docker exec "$NAME" curl -sm 3 http://127.0.0.1:8320/health 2>&1 | sed 's/^/[dojo-up]   /' >&2 || true
  echo "[dojo-up] effective HOST for the unit:" >&2
  docker exec "$NAME" systemctl show training-dojo-vessel -p Environment 2>&1 | sed 's/^/[dojo-up]   /' >&2 || true
  echo "[dojo-up] journal:" >&2
  docker exec "$NAME" journalctl -u training-dojo-vessel -n 40 --no-pager 2>&1 | sed 's/^/[dojo-up]   /' >&2 || true
fi

FED_ID="$(docker exec "$NAME" bash -lc 'source /etc/substrate/env 2>/dev/null; echo "${FED_SUBSTRATE_ID:-}"' 2>/dev/null | tr -d '\r')"
HUB_ROWS=""
if [ -z "$FED_ID" ]; then
  echo "[dojo-up] ASSERT FAILED: FED_SUBSTRATE_ID is empty in $NAME:/etc/substrate/env —" >&2
  echo "[dojo-up] the container never entered the federated-spoke path." >&2
else
  echo "[dojo-up] federation substrate id: $FED_ID"
  echo "[dojo-up] polling the HUB registry for the dojo (up to 120s — the mirror is not instant)…"
  for _ in $(seq 1 40); do
    HUB_ROWS="$(curl -s -m 8 -X POST "${HUB%/}/resolve" \
      -H 'Content-Type: application/json' \
      -H "Authorization: ApiKey $API_KEY" \
      -d '{"pointer":{"type":"vesselRegistry"}}' 2>/dev/null \
      | jq -r '.content.vessels[]? | [.vesselId, ((.shapes//[])|join(","))] | @tsv' 2>/dev/null || true)"
    if printf '%s\n' "$HUB_ROWS" \
         | awk -F'\t' -v id="@$FED_ID" '$1 ~ /training-dojo/ && index($1, id) && $2 ~ /uiPanel_write/ {found=1} END{exit !found}'; then
      PASS_HUB=PASS; break
    fi
    sleep 3
  done
fi
if [ "$PASS_HUB" = PASS ]; then
  echo "[dojo-up] hub row found:"
  printf '%s\n' "$HUB_ROWS" | awk -F'\t' -v id="@$FED_ID" '$1 ~ /training-dojo/ && index($1,id) {print "  " $1 "  shapes: " $2}'
elif [ -n "$FED_ID" ]; then
  cat >&2 <<EOF
[dojo-up] ASSERT FAILED: no hub registry row matching '*training-dojo*@$FED_ID'
[dojo-up] carrying the shape uiPanel_write.
[dojo-up] The dojo may be registered LOCALLY and still be invisible to the
[dojo-up] hub — that is exactly what this assert exists to catch.
[dojo-up] Vessel ids the hub actually returned:
EOF
  if [ -n "$HUB_ROWS" ]; then
    printf '%s\n' "$HUB_ROWS" | awk -F'\t' '{print "[dojo-up]   " $1}' >&2
  else
    echo "[dojo-up]   (none — the resolve returned nothing parseable. Raw:)" >&2
    curl -s -m 8 -o - -w '\n[dojo-up]   HTTP %{http_code}\n' -X POST "${HUB%/}/resolve" \
      -H 'Content-Type: application/json' -H "Authorization: ApiKey $API_KEY" \
      -d '{"pointer":{"type":"vesselRegistry"}}' 2>&1 | head -20 | sed 's/^/[dojo-up]   /' >&2 || true
    echo "[dojo-up]   A 401 here means the key is not hub-issued." >&2
  fi
  echo "[dojo-up] federation transport journal:" >&2
  docker exec "$NAME" journalctl -u federation-transport-vessel -n 40 --no-pager 2>&1 \
    | sed 's/^/[dojo-up]   /' >&2 || true
fi

FED_HEALTH="$(docker exec "$NAME" curl -sm 5 http://127.0.0.1:8401/health 2>/dev/null || true)"
if printf '%s' "$FED_HEALTH" | grep -q 'p2p-circuit'; then PASS_FED=PASS; fi
echo "[dojo-up] federation transport health: ${FED_HEALTH:-(no answer)}"

# ── VERDICT ──────────────────────────────────────────────────────────────────
OVERALL=PASS
for v in "$PASS_RUNNING" "$PASS_DIST" "$PASS_HEALTH" "$PASS_HUB"; do
  [ "$v" = PASS ] || OVERALL=FAIL
done

cat <<VERDICT

===============================================================================
[dojo-up] VERDICT — UI-only federated spoke '$NAME'
===============================================================================
  $PASS_RUNNING  container running
  $PASS_DIST  ui/dist built (the dojo has something to serve)
  $PASS_HEALTH  dojo answers /health FROM THE HOST on $SURFACE_PORT
  $PASS_HUB  dojo shapes present in the HUB registry as *@$FED_ID
  $PASS_FED  federation transport holds a /p2p-circuit multiaddr  (advisory)

  dojo           : $SURFACE_URL
  hub            : $HUB
  substrate id   : ${FED_ID:-<unset>}
  published ports:$PUBLISHED

  OVERALL: $OVERALL
  (the transport line is advisory — the hub-registry assert is the one that
   proves federation actually reached the hub)

  Deeper verification, incl. resolving a shape this spoke does NOT serve
  (shared mechanism, human-surface-vessel's own account of it):
  openspec/changes/human-surface-stack/federation.md
===============================================================================
VERDICT

[ "$OVERALL" = PASS ] || exit 1
