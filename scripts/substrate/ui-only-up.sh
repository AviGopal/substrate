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
#                 [--name <container>] [--port-offset <n>]
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
# NOTE ON AN ALREADY-RUNNING SUBSTRATE
#   This script refuses if its target container name already exists. It never
#   stops, recreates, or reconfigures an existing container. On a host that
#   already runs substrate-live, pass a distinct --name AND a --port-offset so
#   the published host ports do not collide.
set -euo pipefail

HUB=""
API_KEY=""
NAME="substrate-ui"
PORT_OFFSET=""
DRY_RUN="${DRY_RUN:-0}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<'USAGE'
ui-only-up.sh — boot a UI-ONLY federated spoke (one human surface + the minimum
a substrate needs to hold its own registry; everything else resolves on the hub).

  ui-only-up.sh --hub <url> --api-key <key> [--name <container>] [--port-offset <n>]

  --hub <url>          REQUIRED. The HUB's discovery endpoint, e.g.
                       http://<hub-host>:18100. Supplying it with no explicit
                       ENABLED_ROLES is what engages the federated-spoke path.
  --api-key <key>      REQUIRED. A HUB-ISSUED key. A locally minted key is not
                       valid on the hub and every hub-facing call 401s.
  --name <container>   Container name. Default: substrate-ui. Must NOT be an
                       existing container — this script refuses rather than
                       touch one.
  --port-offset <n>    Added to every published host port (0 = defaults). Use it
                       whenever another substrate already holds 18xxx on this host.

  DRY_RUN=1            Print the plan and exit without executing anything.

Full behaviour: openspec/changes/human-surface-stack/federation.md
USAGE
  exit "${1:-2}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --hub)         HUB="${2:-}"; shift 2 ;;
    --api-key)     API_KEY="${2:-}"; shift 2 ;;
    --name)        NAME="${2:-}"; shift 2 ;;
    --port-offset) PORT_OFFSET="${2:-}"; shift 2 ;;
    -h|--help)     usage 0 ;;
    *) echo "[ui-only-up] ERROR: unknown argument '$1'" >&2; usage 2 ;;
  esac
done

fail() { echo "[ui-only-up] ERROR: $*" >&2; echo >&2; usage 2; }

[ -n "$HUB" ]     || fail "--hub <hub discovery endpoint> is required."
[ -n "$API_KEY" ] || fail "--api-key <hub-issued key> is required. A locally minted key is rejected by the hub."
[ -n "$NAME" ]    || fail "--name must not be empty."
case "$HUB" in http://*|https://*) : ;; *) fail "--hub must be a URL, e.g. http://<hub-host>:18100 (got '$HUB')." ;; esac
if [ -n "$PORT_OFFSET" ]; then
  case "$PORT_OFFSET" in ''|*[!0-9]*) fail "--port-offset must be a non-negative integer (got '$PORT_OFFSET')." ;; esac
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

REDACTED="${API_KEY:0:4}…(${#API_KEY} chars)"

cat <<PLAN
[ui-only-up] PLAN
  container        : $NAME
  image tag        : dev (make up builds it if missing)
  hub discovery    : $HUB
  hub api key      : $REDACTED
  port offset      : ${PORT_OFFSET:-0}   (human surface published on $(( ${PORT_OFFSET:-0} + 18310 )) -> 8310)
  ENABLED_VESSELS  : $UI_ONLY_VESSELS
  auto by Makefile : ENABLED_ROLES=spoke, HUB_DISCOVERY_URL, ACTIVITY_API_ENDPOINT,
                     IDENTITY_VESSEL_URL (hub host), CONTAINER_DISCOVERY_ENDPOINT blanked
  auto by entrypoint: federation-transport-vessel installed + boot-enabled
  after readiness  : vessel-ctl install human-surface-vessel (manifest vessel, port 8310)

  steps:
    1. refuse if a container named '$NAME' already exists
    2. make -C scripts/substrate up  (creates + waits for readiness)
    3. verify /workspace/git/super-repo/repos/human-surface-vessel exists
    4. vessel-ctl install human-surface-vessel --container $NAME
       (its post_install builds ui/dist — gitignored, so it MUST be built here)
    5. assert ui/dist exists; the install's own exit status cannot prove it
    6. report the surface health and the federation transport health

  this script never stops, recreates, or reconfigures an existing container.
PLAN

if [ "$DRY_RUN" = "1" ]; then
  echo "[ui-only-up] DRY_RUN=1 — nothing was executed."
  exit 0
fi

# ── 1. Refuse to touch anything that already exists ──────────────────────────
command -v docker >/dev/null 2>&1 || { echo "[ui-only-up] ERROR: docker not found on PATH." >&2; exit 1; }
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

# ── 2. Boot ──────────────────────────────────────────────────────────────────
# `make up` ends in substrate-doctor.sh WITHOUT a `|| true`, and the doctor is
# only partly selection-aware: it checks the seeded key against a LOCAL
# activity-api and compares the registry against a full-fleet floor. On a
# UI-only spoke both are legitimately absent, so the doctor exits 1 and, under
# `set -e`, would abort this script BEFORE the surface is ever installed.
# A doctor failure here is therefore a WARNING, not a stop. The container
# actually being up is the condition we gate on; steps 3-6 are the real checks.
echo "[ui-only-up] booting '$NAME' as a UI-only federated spoke…"
BOOT_RC=0
make -C "$HERE" up \
  LIVE_NAME="$NAME" \
  ${PORT_OFFSET:+PORT_OFFSET="$PORT_OFFSET"} \
  API_KEY="$API_KEY" \
  DISCOVERY_ENDPOINT="$HUB" \
  ENABLED_VESSELS="$UI_ONLY_VESSELS" || BOOT_RC=$?

if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "[ui-only-up] ERROR: '$NAME' is not running after boot (make up exit $BOOT_RC)." >&2
  echo "[ui-only-up] docker logs $NAME" >&2
  exit 1
fi
if [ "$BOOT_RC" != 0 ]; then
  echo "[ui-only-up] WARNING: 'make up' exited $BOOT_RC — expected on a trimmed fleet:"
  echo "[ui-only-up]   substrate-doctor checks the seeded key against a LOCAL activity-api"
  echo "[ui-only-up]   and the registry against a full-fleet floor; neither applies here."
  echo "[ui-only-up]   Continuing. The checks below are the ones that matter."
fi

# ── 3. The manifest workdir must exist before the install ────────────────────
WORKDIR=/workspace/git/super-repo/repos/human-surface-vessel
if ! docker exec "$NAME" test -d "$WORKDIR"; then
  cat >&2 <<EOF
[ui-only-up] ERROR: $WORKDIR is missing in '$NAME'.
[ui-only-up] The human-surface-vessel manifest entry runs out of the super-repo
[ui-only-up] clone (workdir \$REPO_ROOT/repos/human-surface-vessel), which
[ui-only-up] git-push-setup.service establishes at boot. It did not.
[ui-only-up] Two causes, in order of likelihood:
[ui-only-up]   1. repos/human-surface-vessel has not landed on the super-repo's
[ui-only-up]      dev branch yet — the clone is correct, the vessel just isn't in
[ui-only-up]      it. Check with: docker exec $NAME ls /workspace/git/super-repo/repos
[ui-only-up]   2. git-push-setup.service never established the clone (no network
[ui-only-up]      or no git credential in the container):
[ui-only-up]      docker exec $NAME journalctl -u git-push-setup -n 50
EOF
  exit 1
fi

# ── 4. Install the surface (manifest vessel — never selected by inventory) ───
echo "[ui-only-up] installing human-surface-vessel from the manifest…"
"$HERE/vessel-ctl.sh" install human-surface-vessel --container "$NAME"

# ── 5. Assert the UI actually got built ──────────────────────────────────────
# The server serves the surface from ui/dist, which is gitignored and is built
# by the manifest's post_install hook. vessel-ctl SWALLOWS that hook's output
# AND its exit status, so `install` reports ok:true whether or not the build
# succeeded — a vessel that boots, answers /health, and serves nothing.
# This assertion is the only real gate.
BUILD_LOG=/workspace/human-surface-ui-build.log
if docker exec "$NAME" test -d "$WORKDIR/ui/dist"; then
  echo "[ui-only-up] ui/dist present — the surface has something to serve."
else
  cat >&2 <<EOF
[ui-only-up] ERROR: $WORKDIR/ui/dist is missing.
[ui-only-up] The UI build did not produce output, and vessel-ctl swallowed the
[ui-only-up] failure — the vessel will answer /health and serve NO UI.
[ui-only-up] The hook's own log is the evidence:
[ui-only-up]   docker exec $NAME cat $BUILD_LOG
[ui-only-up] Last lines:
EOF
  docker exec "$NAME" tail -30 "$BUILD_LOG" >&2 2>/dev/null || echo "  (no log — the hook never ran)" >&2
  exit 1
fi
if docker exec "$NAME" grep -q UI_BUILD_FAILED "$BUILD_LOG" 2>/dev/null; then
  echo "[ui-only-up] WARNING: $BUILD_LOG ends in UI_BUILD_FAILED although ui/dist exists —"
  echo "[ui-only-up] the dist you are serving is STALE. Read the log before trusting it."
fi

# ── 6. Report ────────────────────────────────────────────────────────────────
echo "[ui-only-up] surface health (in-container 127.0.0.1:8310):"
docker exec "$NAME" curl -sm 5 http://127.0.0.1:8310/health || echo "  (no answer — docker exec $NAME journalctl -u human-surface-vessel -n 50)"
echo
echo "[ui-only-up] federation transport health (in-container 127.0.0.1:8401):"
docker exec "$NAME" curl -sm 5 http://127.0.0.1:8401/health || echo "  (no answer — docker exec $NAME journalctl -u federation-transport-vessel -n 50)"
echo
echo "[ui-only-up] host port: http://localhost:$(( ${PORT_OFFSET:-0} + 18310 ))/"
echo "[ui-only-up] verify federation: openspec/changes/human-surface-stack/federation.md"
