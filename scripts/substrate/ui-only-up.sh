#!/usr/bin/env bash
# ui-only-up.sh — boot a UI-ONLY federated spoke: one human surface plus the
# minimum a substrate needs to hold its own registry, and nothing else.
#
# WHAT THIS IS FOR
#   A machine that should show a human the substrate, not compute for it. Every
#   shape the surface needs but does not serve — goal_execution, goalWalkState,
#   activity/trace shapes, identity, LLM resolution — is resolved on the hub
#   through discovery fan-out and the federation transport. See
#   openspec/changes/human-surface-stack/federation.md.
#
# USAGE
#   ui-only-up.sh --hub http://<hub-host>:18100 --api-key <hub-issued-key> \
#                 [--name <container>] [--port-offset <n>] [--git-pat <pat>]
#
#   DRY_RUN=1 ui-only-up.sh --hub ... --api-key ...      # print the plan, touch nothing
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
# WHY human-surface-vessel IS NOT IN THAT LIST
#   It is a MANIFEST vessel ("manifest": true in vessels.inventory.json), and
#   apply-inventory's manageable_units() skips manifest entries entirely — they
#   are never masked and never selected. It is installed after readiness with
#   vessel-ctl, from the manifest. That install needs the super-repo clone at
#   /workspace/git/super-repo (its manifest workdir), which is why
#   git-push-setup.service is in the unit list below and not optional.
#
# WHY A GIT CREDENTIAL IS MANDATORY
#   The surface's manifest workdir is $REPO_ROOT/repos/human-surface-vessel
#   inside the super-repo clone. The super-repo is PRIVATE, so an anonymous
#   clone 401s. setup-git-push.sh configures the credential helper only when
#   SUBSTRATE_GIT_PAT is non-empty — GITHUB_TOKEN alone never engages it. With
#   no PAT the clone fails and the script falls back to the baked image seed,
#   which carries scripts/ ONLY and no repos/. The surface then has no workdir
#   and the install cannot proceed. Refusing up front beats failing at step 4
#   with a confusing "workdir missing".
#
# NOTE ON AN ALREADY-RUNNING SUBSTRATE
#   This script refuses if its target container name already exists, and refuses
#   if any host port it would publish is already listening. It never stops,
#   recreates, or reconfigures an existing container. On a host that already
#   runs another substrate, pass a distinct --name AND a --port-offset.
set -euo pipefail

HUB=""
API_KEY=""
NAME="substrate-ui"
PORT_OFFSET=""
GIT_PAT="${SUBSTRATE_GIT_PAT:-}"
DRY_RUN="${DRY_RUN:-0}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE="ghcr.io/avigopal/substrate"
TAG="dev"

# Every host port run-live publishes (base values; the offset is added below).
BASE_PORTS="18080 18090 18100 18101 18210 18250 18260 18270 18310"
SURFACE_BASE_PORT=18310

usage() {
  cat >&2 <<'USAGE'
ui-only-up.sh — boot a UI-ONLY federated spoke (one human surface + the minimum
a substrate needs to hold its own registry; everything else resolves on the hub).

  ui-only-up.sh --hub <url> --api-key <key> [--name <container>]
                [--port-offset <n>] [--git-pat <pat>]

  --hub <url>          REQUIRED. The HUB's discovery endpoint, e.g.
                       http://<hub-host>:18100. Supplying it with no explicit
                       ENABLED_ROLES is what engages the federated-spoke path.
  --api-key <key>      REQUIRED. A HUB-ISSUED key. A locally minted key is not
                       valid on the hub and every hub-facing call 401s.
  --git-pat <pat>      REQUIRED (or SUBSTRATE_GIT_PAT in the environment).
                       Read access to the private super-repo, whose clone is
                       the human surface's manifest workdir.
  --name <container>   Container name. Default: substrate-ui. Must NOT be an
                       existing container — this script refuses rather than
                       touch one.
  --port-offset <n>    Added to every published host port (0 = defaults). Use it
                       whenever another substrate already holds 18xxx on this host.

  DRY_RUN=1            Print the plan AND the exact docker command, then exit
                       without executing anything.

Full behaviour: openspec/changes/human-surface-stack/federation.md
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
    *) echo "[ui-only-up] ERROR: unknown argument '$1'" >&2; usage 2 ;;
  esac
done

fail() { echo "[ui-only-up] ERROR: $*" >&2; echo >&2; usage 2; }
die()  { echo "[ui-only-up] ERROR: $*" >&2; exit 1; }

[ -n "$HUB" ]     || fail "--hub <hub discovery endpoint> is required."
[ -n "$API_KEY" ] || fail "--api-key <hub-issued key> is required. A locally minted key is rejected by the hub."
[ -n "$NAME" ]    || fail "--name must not be empty."
case "$HUB" in http://*|https://*) : ;; *) fail "--hub must be a URL, e.g. http://<hub-host>:18100 (got '$HUB')." ;; esac
if [ -n "$PORT_OFFSET" ]; then
  case "$PORT_OFFSET" in ''|*[!0-9]*) fail "--port-offset must be a non-negative integer (got '$PORT_OFFSET')." ;; esac
fi
OFFSET="${PORT_OFFSET:-0}"

if [ -z "$GIT_PAT" ]; then
  cat >&2 <<'EOF'
[ui-only-up] ERROR: no git credential. Pass --git-pat <pat> or export SUBSTRATE_GIT_PAT.

[ui-only-up] Why this is fatal and not a warning — the causal chain:
[ui-only-up]   the human surface's manifest workdir is
[ui-only-up]     /workspace/git/super-repo/repos/human-surface-vessel
[ui-only-up]   the super-repo is PRIVATE, so an anonymous clone 401s;
[ui-only-up]   setup-git-push.sh arms the git credential helper ONLY when
[ui-only-up]   SUBSTRATE_GIT_PAT is non-empty (GITHUB_TOKEN alone does not);
[ui-only-up]   with no helper the clone fails and falls back to the baked image
[ui-only-up]   seed, which contains scripts/ and NO repos/;
[ui-only-up]   so the surface has no workdir and cannot be installed at all.
EOF
  exit 1
fi

# ── The minimal unit set ─────────────────────────────────────────────────────
# Derived by reading vessels.inventory.json, not guessed. Each line says why it
# is here; everything else in the inventory is deliberately absent.
#
#   surrealdb / valkey                 role store — the local registry's backing
#                                      store. Without them discovery has nowhere
#                                      to keep the rows this spoke registers.
#   discovery-vessel                   role registry — the fixed point. It is
#                                      also the fan-out point: PEER_DISCOVERY_
#                                      ENDPOINTS defaults to HUB_DISCOVERY_URL,
#                                      so a shape with no local producer is
#                                      looked up on the hub.
#   git-push-setup                     role seed — establishes /workspace/git/
#                                      super-repo, the manifest workdir the
#                                      human surface runs out of. LOAD-BEARING.
#   substrate-ready                    role infra — the readiness gate `make up`
#                                      and substrate-ready.sh poll.
#   journald-stdout-forwarder          role infra — makes `docker logs` useful.
#   self-recovery.timer                role infra — restarts the surface if it
#                                      dies (the manifest sets self_recovery).
#   substrate-pull-sync.timer          role infra — pulls substrate-authored
#                                      commits into the in-container clones.
#
# Deliberately EXCLUDED, with the reason:
#   identity-vessel        role control — the hub is the single validator; the
#                          Makefile points IDENTITY_VESSEL_URL at it.
#   activity-api           role api — the trace store lives on the hub.
#   identity-seeder        would seed a LOCAL identity-vessel that is not running.
#   bootstrap-seeder,
#   substrate-active-scripts-seed,
#   concept-db(-seeder)    seed into / are the trace-and-knowledge plane the hub
#                          owns; running them here duplicates hub state.
#   light-dispatch-healthcheck.timer   its target vessel is not running, so it
#                          would record infrastructure absence as arm quality —
#                          the boredom-vessel failure mode, exactly.
#   every other compute/ui/autonomy/transport unit.
#
# federation-transport-vessel is absent for the same reason as the human
# surface: it is a manifest vessel, and entrypoint.sh auto-installs and
# boot-enables it whenever HUB_DISCOVERY_URL is set — which the spoke path sets.
UI_ONLY_VESSELS="surrealdb.service,valkey.service,discovery-vessel.service,git-push-setup.service,substrate-ready.service,journald-stdout-forwarder.service,self-recovery.timer,substrate-pull-sync.timer"

SURFACE_PORT=$(( OFFSET + SURFACE_BASE_PORT ))
SURFACE_URL="http://127.0.0.1:${SURFACE_PORT}"

# ── Secret hygiene ───────────────────────────────────────────────────────────
# `make -n run-live` prints the full docker command INCLUDING the values of
# every -e secret; the Makefile also auto-populates provider keys and a GitHub
# token from operator config. Anything this script echoes therefore goes through
# redact(). Both a name-based rule (VAR matching KEY|TOKEN|PAT|SECRET) and a
# value-shape rule (known credential prefixes) — the second catches a secret
# that arrives under a name the first does not match.
redact() {
  sed -E \
    -e 's/(-e [A-Za-z_]*(KEY|TOKEN|PAT|SECRET)[A-Za-z_]*=")[^"]+"/\1<redacted>"/g' \
    -e 's/(sk-ant-|sk-proj-|sk-|gho_|ghp_|ghu_|ghs_|github_pat_)[A-Za-z0-9_-]{8,}/\1<redacted>/g'
}

# The provider keys are blanked deliberately. A federated spoke inherits LLM
# capability from the hub (the Makefile even skips the provider-key precondition
# when a hub is set) and no LLM vessel is in the unit list, so passing the
# operator's real key would only copy a live secret into a second container for
# nothing. GITHUB_TOKEN is set to the same PAT so the credential helper's
# `${SUBSTRATE_GIT_PAT:-$GITHUB_TOKEN}` fallback stays consistent.
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
)
[ -n "$PORT_OFFSET" ] && MAKE_VARS+=("PORT_OFFSET=$PORT_OFFSET")

REDACTED_KEY="${API_KEY:0:4}…(${#API_KEY} chars)"
REDACTED_PAT="${GIT_PAT:0:4}…(${#GIT_PAT} chars)"

PUBLISHED=""
for p in $BASE_PORTS; do PUBLISHED="$PUBLISHED $(( OFFSET + p ))"; done
PUBLISHED="${PUBLISHED# }"

cat <<PLAN
[ui-only-up] PLAN
  container        : $NAME
  image            : $IMAGE:$TAG   (make up builds it only if MISSING — a stale
                     image is NOT rebuilt; preflight below checks its manifest)
  hub discovery    : $HUB
  hub api key      : $REDACTED_KEY
  git pat          : $REDACTED_PAT
  port offset      : $OFFSET
  published ports  : $PUBLISHED
  human surface    : $SURFACE_URL  (host $SURFACE_PORT -> container 8310)
  volumes          : ${NAME}-workspace, ${NAME}-surreal  (namespaced by LIVE_NAME)
  ENABLED_VESSELS  : $UI_ONLY_VESSELS
  auto by Makefile : ENABLED_ROLES=spoke, HUB_DISCOVERY_URL, ACTIVITY_API_ENDPOINT,
                     IDENTITY_VESSEL_URL (hub host), CONTAINER_DISCOVERY_ENDPOINT blanked
  auto by entrypoint: federation-transport-vessel installed + boot-enabled
  after readiness  : vessel-ctl install human-surface-vessel (manifest vessel, port 8310)

  steps:
    1. preflight: refuse on an existing container, an occupied host port, or an
       image whose baked manifest has no human-surface-vessel entry
    2. make -C scripts/substrate up  (creates + waits for readiness)
    3. verify /workspace/git/super-repo/repos/human-surface-vessel exists
    4. write the HOST=0.0.0.0 drop-in, BEFORE the install so first start is
       already correct. vessels.manifest.json now carries 0.0.0.0, but that only
       reaches a container through a REBUILT image; the drop-in makes an image
       whose baked manifest still pins 127.0.0.1 correct too. A loopback
       listener never answers a published port — -p $SURFACE_PORT would be dead.
    5. vessel-ctl install human-surface-vessel --container $NAME
       (its post_install builds ui/dist — gitignored, so it MUST be built here)
    6. ASSERT container running
    7. ASSERT ui/dist exists (the install's own exit status cannot prove it)
    8. ASSERT the surface answers /health FROM THE HOST on $SURFACE_PORT
    9. ASSERT the surface's shapes appear in the HUB's registry as
       <name>@<FED_SUBSTRATE_ID> — the only proof federation reached the hub
   10. report the federation transport, then a PASS/FAIL verdict block

  this script never stops, recreates, or reconfigures an existing container.
PLAN

echo
echo "[ui-only-up] the exact container creation command (\`make -n run-live\`, secrets redacted):"
echo "-------------------------------------------------------------------------------"
# `make up` execs this same recipe when the container does not yet exist. -n
# expands and prints without executing. Redacted on the way out.
make -n -C "$HERE" run-live "${MAKE_VARS[@]}" 2>&1 | redact
echo "-------------------------------------------------------------------------------"
echo

if [ "$DRY_RUN" = "1" ]; then
  echo "[ui-only-up] DRY_RUN=1 — nothing was executed. No container, image, volume,"
  echo "[ui-only-up] or file was created or changed."
  exit 0
fi

# ── 1. Preflight: refuse before touching anything ────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker not found on PATH."

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  cat >&2 <<EOF
[ui-only-up] ERROR: a container named '$NAME' already exists.
[ui-only-up] This script will not stop, recreate, or reconfigure it — a running
[ui-only-up] substrate holds learning state in its volumes.
[ui-only-up] Choose a different name:   --name <other> --port-offset <n>
[ui-only-up] Or, if you truly mean to replace it, do so deliberately yourself.
EOF
  exit 1
fi

# Port collision. Refusing here beats a half-created container: `docker run`
# fails on the FIRST conflicting -p, leaving a created-but-dead container that
# then trips the name check on the next attempt.
CONFLICTS=""
if command -v ss >/dev/null 2>&1; then
  LISTENING="$(ss -ltn 2>/dev/null | awk 'NR>1{print $4}' | sed -E 's/.*[:.]([0-9]+)$/\1/' | sort -un)"
  for p in $PUBLISHED; do
    if echo "$LISTENING" | grep -qx "$p"; then CONFLICTS="$CONFLICTS $p"; fi
  done
else
  echo "[ui-only-up] WARNING: 'ss' not found — skipping the host-port collision check."
fi
if [ -n "$CONFLICTS" ]; then
  cat >&2 <<EOF
[ui-only-up] ERROR: host port(s) already listening:$CONFLICTS
[ui-only-up] With --port-offset $OFFSET this launch would publish:$PUBLISHED
[ui-only-up] Another substrate almost certainly holds them. Pick an offset that
[ui-only-up] clears the whole block, e.g. --port-offset $(( OFFSET + 1000 )).
[ui-only-up] Occupants:
EOF
  for p in $CONFLICTS; do ss -ltnp 2>/dev/null | grep -E "[:.]$p " >&2 || true; done
  exit 1
fi

# The image is only built when MISSING, so a stale :dev is silently reused. The
# surface is a manifest vessel: if the baked manifest predates it, `vessel-ctl
# install` fails at step 5 with "vessel not in manifest" after a full boot.
if ! docker image inspect "$IMAGE:$TAG" >/dev/null 2>&1; then
  echo "[ui-only-up] image $IMAGE:$TAG absent — 'make up' will build it."
elif ! docker run --rm --entrypoint sh "$IMAGE:$TAG" -c \
      'jq -e ".vessels[]|select(.name==\"human-surface-vessel\")" /usr/local/share/substrate/vessels.manifest.json >/dev/null 2>&1'; then
  cat >&2 <<EOF
[ui-only-up] ERROR: $IMAGE:$TAG has no human-surface-vessel in its baked manifest
[ui-only-up]   (/usr/local/share/substrate/vessels.manifest.json).
[ui-only-up] 'make up' builds the image only when it is MISSING, so this stale
[ui-only-up] one would be reused and 'vessel-ctl install' would fail with
[ui-only-up] "vessel not in manifest" only AFTER a full boot. Rebuild first:
[ui-only-up]
[ui-only-up]   docker build -f Dockerfile.substrate --target base \\
[ui-only-up]     -t $IMAGE:$TAG .
[ui-only-up]
[ui-only-up] --target base is load-bearing: without it the obsidian stage builds
[ui-only-up] and :dev silently becomes the obsidian image. Do NOT use 'make build'
[ui-only-up] where host bun is unavailable — validate-build runs bun on the host.
EOF
  exit 1
else
  echo "[ui-only-up] image preflight OK — baked manifest carries human-surface-vessel."
fi

# A named volume outlives its container. entrypoint.sh seeds the fleet files
# from the image only when ABSENT, and vessel-ctl reads the volume copy FIRST —
# so a surviving workspace volume pins an old manifest that the image preflight
# above cannot see. Not fatal (the volume may be a deliberate resume), but it is
# the one way the two manifests diverge.
if docker volume inspect "${NAME}-workspace" >/dev/null 2>&1; then
  echo "[ui-only-up] WARNING: volume '${NAME}-workspace' already exists — its"
  echo "[ui-only-up]   /workspace/substrate/fleet/ manifest will be used instead of the"
  echo "[ui-only-up]   image's, and will NOT be re-seeded. If the install fails with"
  echo "[ui-only-up]   'vessel not in manifest', that stale copy is why."
fi

# ── 2. Boot ──────────────────────────────────────────────────────────────────
# `make up` ends in substrate-doctor.sh WITHOUT a `|| true`, and the doctor is
# only partly selection-aware: it checks the seeded key against a LOCAL
# activity-api and compares the registry against a full-fleet floor. On a
# UI-only spoke both are legitimately absent, so the doctor exits 1 and, under
# `set -e`, would abort this script BEFORE the surface is ever installed.
# A doctor failure here is therefore a WARNING, not a stop. The container
# actually being up is the condition we gate on; the asserts below are real.
echo "[ui-only-up] booting '$NAME' as a UI-only federated spoke…"
BOOT_RC=0
# The REAL run is piped through redact() for the same reason the DRY_RUN echo is.
# It previously was not, and that is the whole shape of the defect: the gate was
# built on the path being rehearsed and omitted from the path that actually runs,
# so a real boot printed the git credential and the API key in plaintext to any
# log, tee, or CI capture. PIPESTATUS keeps make's exit code across the pipe —
# `$?` after a pipeline reports redact's status, which is always 0.
make -C "$HERE" up "${MAKE_VARS[@]}" 2>&1 | redact
BOOT_RC=${PIPESTATUS[0]}

if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "[ui-only-up] ERROR: '$NAME' is not running after boot (make up exit $BOOT_RC)." >&2
  docker logs --tail 60 "$NAME" >&2 2>&1 || true
  exit 1
fi
if [ "$BOOT_RC" != 0 ]; then
  echo "[ui-only-up] WARNING: 'make up' exited $BOOT_RC — expected on a trimmed fleet:"
  echo "[ui-only-up]   substrate-doctor checks the seeded key against a LOCAL activity-api"
  echo "[ui-only-up]   and the registry against a full-fleet floor; neither applies here."
  echo "[ui-only-up]   Continuing. The asserts below are the ones that matter."
fi

# ── 3. The manifest workdir must exist before the install ────────────────────
WORKDIR=/workspace/git/super-repo/repos/human-surface-vessel
if ! docker exec "$NAME" test -d "$WORKDIR"; then
  cat >&2 <<EOF
[ui-only-up] ERROR: $WORKDIR is missing in '$NAME'.
[ui-only-up] The human-surface-vessel manifest entry runs out of the super-repo
[ui-only-up] clone (workdir \$REPO_ROOT/repos/human-surface-vessel), which
[ui-only-up] git-push-setup.service establishes at boot. It did not.
[ui-only-up] What is actually there:
EOF
  docker exec "$NAME" ls /workspace/git/super-repo 2>&1 | sed 's/^/[ui-only-up]   /' >&2 || true
  echo "[ui-only-up] Only scripts/ present means the PAT clone failed and the baked" >&2
  echo "[ui-only-up] image seed was used instead. The journal says which:" >&2
  docker exec "$NAME" journalctl -u git-push-setup -n 40 --no-pager 2>&1 | sed 's/^/[ui-only-up]   /' >&2 || true
  exit 1
fi

# ── 4. Un-pin the loopback bind BEFORE first start ───────────────────────────
# vessels.manifest.json carries "HOST": "127.0.0.1" for this vessel, and
# render-unit.sh emits those env lines AFTER EnvironmentFile=/etc/substrate/env,
# so the manifest value wins. A 127.0.0.1 listener does not accept the DNAT'd
# traffic a `-p` publish delivers from the container's bridge IP — the host port
# mapping would exist and be dead. stateful-ui-vessel sets HOST=0.0.0.0 for
# exactly this reason.
#
# The manifest has been corrected to 0.0.0.0, but that only reaches a container
# through a REBUILT image (entrypoint seeds /workspace/substrate/fleet/ from the
# image, and only when absent). This drop-in makes the launch correct on a
# stale image too. It parses after the main unit, so it wins on the same
# variable, and it is idempotent. Registration is unaffected: the discovery
# payload uses SELF_ENDPOINT = http://127.0.0.1:$PORT, a constant independent of
# HOST.
echo "[ui-only-up] pinning the surface to HOST=0.0.0.0 (drop-in) before install…"
docker exec "$NAME" mkdir -p /etc/systemd/system/human-surface-vessel.service.d
docker exec "$NAME" bash -c \
  'printf "[Service]\nEnvironment=HOST=0.0.0.0\n" > /etc/systemd/system/human-surface-vessel.service.d/host.conf'

# ── 5. Install the surface (manifest vessel — never selected by inventory) ───
#
# The install is NOT allowed to abort this script under `set -e`. If it fails,
# the asserts below still run and the verdict block still prints — a bare
# non-zero exit with no diagnostics is the outcome this script exists to avoid.
# The likeliest failure is "vessel not in manifest" on a container whose
# /workspace volume survived an earlier image: vessel-ctl reads the volume copy
# at /workspace/substrate/fleet/ BEFORE the image copy, and entrypoint.sh seeds
# that copy only when absent — so an old volume pins an old manifest and the
# image preflight above (which reads the image copy) cannot see it. The volume
# warning at boot time is the hint for that case.
echo "[ui-only-up] installing human-surface-vessel from the manifest…"
INSTALL_RC=0
"$HERE/vessel-ctl.sh" install human-surface-vessel --container "$NAME" || INSTALL_RC=$?
if [ "$INSTALL_RC" != 0 ]; then
  echo "[ui-only-up] ERROR: vessel-ctl install exited $INSTALL_RC." >&2
  echo "[ui-only-up] Manifest actually in force inside the container (volume copy wins):" >&2
  docker exec "$NAME" sh -c \
    'for m in /workspace/substrate/fleet/vessels.manifest.json /usr/local/share/substrate/vessels.manifest.json; do
       [ -f "$m" ] && echo "$m: $(jq -r "[.vessels[].name]|join(\",\")" "$m" 2>/dev/null | tr -d "\n" | cut -c1-300)";
     done' 2>&1 | sed 's/^/[ui-only-up]   /' >&2 || true
  echo "[ui-only-up] Continuing to the asserts so the verdict block still reports." >&2
fi
docker exec "$NAME" systemctl daemon-reload || true
docker exec "$NAME" systemctl restart human-surface-vessel || true

# ── ASSERTS ──────────────────────────────────────────────────────────────────
PASS_RUNNING=FAIL; PASS_DIST=FAIL; PASS_HEALTH=FAIL; PASS_HUB=FAIL; PASS_FED=FAIL

# 6. running
docker ps --format '{{.Names}}' | grep -qx "$NAME" && PASS_RUNNING=PASS

# 7. ui/dist — the server serves the surface from ui/dist, which is gitignored
# and built by the manifest's post_install hook. vessel-ctl SWALLOWS that hook's
# output AND its exit status, so `install` reports ok:true whether or not the
# build succeeded — a vessel that boots, answers /health, and serves nothing.
BUILD_LOG=/workspace/human-surface-ui-build.log
if docker exec "$NAME" test -d "$WORKDIR/ui/dist"; then
  PASS_DIST=PASS
  echo "[ui-only-up] ui/dist present — the surface has something to serve."
  if docker exec "$NAME" grep -q UI_BUILD_FAILED "$BUILD_LOG" 2>/dev/null; then
    echo "[ui-only-up] WARNING: $BUILD_LOG ends in UI_BUILD_FAILED although ui/dist exists —"
    echo "[ui-only-up] the dist you are serving is STALE. Read the log before trusting it."
  fi
else
  echo "[ui-only-up] ASSERT FAILED: $WORKDIR/ui/dist is missing." >&2
  echo "[ui-only-up] vessel-ctl swallowed the build failure; the hook's log is the evidence:" >&2
  docker exec "$NAME" tail -40 "$BUILD_LOG" 2>&1 | sed 's/^/[ui-only-up]   /' >&2 \
    || echo "[ui-only-up]   (no log — the hook never ran)" >&2
fi

# 8. host-side /health. In-container 127.0.0.1 would pass even with the loopback
# pin in place, which is precisely the defect — so the HOST port is the gate.
echo "[ui-only-up] waiting for $SURFACE_URL/health (up to 90s)…"
HEALTH_BODY=""
for _ in $(seq 1 45); do
  if HEALTH_BODY="$(curl -sf -m 3 "$SURFACE_URL/health" 2>/dev/null)"; then
    PASS_HEALTH=PASS; break
  fi
  sleep 2
done
if [ "$PASS_HEALTH" = PASS ]; then
  echo "[ui-only-up] host health: $HEALTH_BODY"
else
  cat >&2 <<EOF
[ui-only-up] ASSERT FAILED: $SURFACE_URL/health did not answer from the HOST.
[ui-only-up] In-container listener (a 127.0.0.1 bind here is the loopback-pin bug —
[ui-only-up] a published port cannot reach it):
EOF
  docker exec "$NAME" sh -c 'ss -ltnp 2>/dev/null | grep 8310 || echo "  (nothing listening on 8310)"' 2>&1 \
    | sed 's/^/[ui-only-up]   /' >&2
  echo "[ui-only-up] in-container health (proves server-up vs bind-wrong):" >&2
  docker exec "$NAME" curl -sm 3 http://127.0.0.1:8310/health 2>&1 | sed 's/^/[ui-only-up]   /' >&2 || true
  echo "[ui-only-up] effective HOST for the unit:" >&2
  docker exec "$NAME" systemctl show human-surface-vessel -p Environment 2>&1 | sed 's/^/[ui-only-up]   /' >&2 || true
  echo "[ui-only-up] journal:" >&2
  docker exec "$NAME" journalctl -u human-surface-vessel -n 40 --no-pager 2>&1 | sed 's/^/[ui-only-up]   /' >&2 || true
fi

# 9. HUB registry. Local registration proves nothing about federation: the
# capability mirror is what carries the spoke's rows to the hub, and it appears
# there as <vesselName>@<FED_SUBSTRATE_ID>. Read the id from the container we
# just booted rather than assuming it — gen-env generates and persists it.
FED_ID="$(docker exec "$NAME" bash -lc 'source /etc/substrate/env 2>/dev/null; echo "${FED_SUBSTRATE_ID:-}"' 2>/dev/null | tr -d '\r')"
HUB_ROWS=""
if [ -z "$FED_ID" ]; then
  echo "[ui-only-up] ASSERT FAILED: FED_SUBSTRATE_ID is empty in $NAME:/etc/substrate/env —" >&2
  echo "[ui-only-up] the container never entered the federated-spoke path." >&2
else
  echo "[ui-only-up] federation substrate id: $FED_ID"
  echo "[ui-only-up] polling the HUB registry for the surface (up to 120s — the mirror is not instant)…"
  for _ in $(seq 1 40); do
    HUB_ROWS="$(curl -s -m 8 -X POST "${HUB%/}/resolve" \
      -H 'Content-Type: application/json' \
      -H "Authorization: ApiKey $API_KEY" \
      -d '{"pointer":{"type":"vesselRegistry"}}' 2>/dev/null \
      | jq -r '.content.vessels[]? | [.vesselId, ((.shapes//[])|join(","))] | @tsv' 2>/dev/null || true)"
    if printf '%s\n' "$HUB_ROWS" \
         | awk -F'\t' -v id="@$FED_ID" '$1 ~ /human-surface/ && index($1, id) && $2 ~ /uiPanel_write/ {found=1} END{exit !found}'; then
      PASS_HUB=PASS; break
    fi
    sleep 3
  done
fi
if [ "$PASS_HUB" = PASS ]; then
  echo "[ui-only-up] hub row found:"
  printf '%s\n' "$HUB_ROWS" | awk -F'\t' -v id="@$FED_ID" '$1 ~ /human-surface/ && index($1,id) {print "  " $1 "  shapes: " $2}'
elif [ -n "$FED_ID" ]; then
  cat >&2 <<EOF
[ui-only-up] ASSERT FAILED: no hub registry row matching '*human-surface*@$FED_ID'
[ui-only-up] carrying the shape uiPanel_write.
[ui-only-up] The surface may be registered LOCALLY and still be invisible to the
[ui-only-up] hub — that is exactly what this assert exists to catch.
[ui-only-up] Vessel ids the hub actually returned:
EOF
  if [ -n "$HUB_ROWS" ]; then
    printf '%s\n' "$HUB_ROWS" | awk -F'\t' '{print "[ui-only-up]   " $1}' >&2
  else
    echo "[ui-only-up]   (none — the resolve returned nothing parseable. Raw:)" >&2
    curl -s -m 8 -o - -w '\n[ui-only-up]   HTTP %{http_code}\n' -X POST "${HUB%/}/resolve" \
      -H 'Content-Type: application/json' -H "Authorization: ApiKey $API_KEY" \
      -d '{"pointer":{"type":"vesselRegistry"}}' 2>&1 | head -20 | sed 's/^/[ui-only-up]   /' >&2 || true
    echo "[ui-only-up]   A 401 here means the key is not hub-issued." >&2
  fi
  echo "[ui-only-up] federation transport journal:" >&2
  docker exec "$NAME" journalctl -u federation-transport-vessel -n 40 --no-pager 2>&1 \
    | sed 's/^/[ui-only-up]   /' >&2 || true
fi

# 10. transport health — reported, and part of the verdict. A green unit proves
# nothing (the transport swallows peer faults by design); a /p2p-circuit
# multiaddr is the real signal.
FED_HEALTH="$(docker exec "$NAME" curl -sm 5 http://127.0.0.1:8401/health 2>/dev/null || true)"
if printf '%s' "$FED_HEALTH" | grep -q 'p2p-circuit'; then PASS_FED=PASS; fi
echo "[ui-only-up] federation transport health: ${FED_HEALTH:-(no answer)}"

# ── VERDICT ──────────────────────────────────────────────────────────────────
OVERALL=PASS
for v in "$PASS_RUNNING" "$PASS_DIST" "$PASS_HEALTH" "$PASS_HUB"; do
  [ "$v" = PASS ] || OVERALL=FAIL
done

cat <<VERDICT

===============================================================================
[ui-only-up] VERDICT — UI-only federated spoke '$NAME'
===============================================================================
  $PASS_RUNNING  container running
  $PASS_DIST  ui/dist built (the surface has something to serve)
  $PASS_HEALTH  surface answers /health FROM THE HOST on $SURFACE_PORT
  $PASS_HUB  surface shapes present in the HUB registry as *@$FED_ID
  $PASS_FED  federation transport holds a /p2p-circuit multiaddr  (advisory)

  surface        : $SURFACE_URL
  hub            : $HUB
  substrate id   : ${FED_ID:-<unset>}
  published ports:$PUBLISHED

  OVERALL: $OVERALL
  (the transport line is advisory — the hub-registry assert is the one that
   proves federation actually reached the hub)

  Deeper verification, incl. resolving a shape this spoke does NOT serve:
  openspec/changes/human-surface-stack/federation.md
===============================================================================
VERDICT

[ "$OVERALL" = PASS ] || exit 1
