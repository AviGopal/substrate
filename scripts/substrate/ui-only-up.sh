#!/usr/bin/env bash
# ui-only-up.sh — DEPRECATED. A human's local window onto a network is sequence D
# of README § Installation: the launch manifest with PROFILE=surface and the join
# pair. This wrapper prints that sequence for the inputs given, writes the .env it
# describes beside a copy of the manifest, and runs it.
#
# USAGE
#   ui-only-up.sh --hub <discovery-url> --api-key <hub-issued key>
#                 [--name <n>] [--port-offset <n>] [--dir <dir>] [--adopt]
#   DRY_RUN=1 ui-only-up.sh …    print the sequence and the .env (key redacted),
#                                create nothing
#
#   --hub          the hub's discovery endpoint, e.g. http://<hub-host>:18100
#                  (or DISCOVERY_ENDPOINT in the environment)
#   --api-key      a key issued BY THE HUB (or METABOB_API_KEY in the environment)
#   --name         SUBSTRATE_NAME of this node (default substrate-ui): container
#                  <n>-live, volumes <n>-workspace and <n>-surreal
#   --port-offset  deprecated; a multiple of 1000, becomes SUBSTRATE_PORT_PREFIX
#                  18 + n/1000. Use it whenever another substrate holds 18xxx here.
#   --dir          where the manifest copy and .env are kept
#                  (default ${XDG_STATE_HOME:-~/.local/state}/substrate/<n>)
#   --adopt        take over a node this script made before the manifest existed
#                  (container <n>, volumes <n>-workspace and <n>-surreal): drain
#                  and remove that container, then launch <n>-live from the
#                  manifest on the SAME volumes, so its state is kept
#
# Inputs come from these flags or their environment variables only. Client
# configuration files and CLI credential caches are no longer read, and the
# retired METABOB_CONFIG is not consulted: the client config location override is
# METABOB_CONFIG_PATH, used only by the connect step printed at the end. A git
# credential is not needed — a surface node lands no commits.
#
# It never stops, recreates or reconfigures a container it did not create: a
# container already named <n> (this script's former naming) or <n>-live that the
# manifest did not create is refused, as before — except the former <n> under
# --adopt, whose volumes the manifest's naming already matches.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$HERE/../../docker-compose.yml"
HUB="${DISCOVERY_ENDPOINT:-}"
API_KEY="${METABOB_API_KEY:-}"
NAME="substrate-ui"
PORT_OFFSET=""
DIR=""
DRY_RUN="${DRY_RUN:-0}"
COMPOSE="${COMPOSE:-docker compose}"
ADOPT=0
STOP_TIMEOUT="${STOP_TIMEOUT:-360}"

say()  { echo "[ui-only-up] $*" >&2; }
die()  { say "ERROR: $*"; exit 1; }
usage() { sed -n '2,36p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit "${1:-2}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --hub)         HUB="${2:-}"; shift 2 ;;
    --api-key)     API_KEY="${2:-}"; shift 2 ;;
    --name)        NAME="${2:-}"; shift 2 ;;
    --port-offset) PORT_OFFSET="${2:-}"; shift 2 ;;
    --dir)         DIR="${2:-}"; shift 2 ;;
    --adopt)       ADOPT=1; shift ;;
    --git-pat)     say "note: --git-pat is ignored — a surface node needs no git credential"; shift 2 ;;
    -h|--help)     usage 0 ;;
    *) say "unknown argument '$1'"; usage 2 ;;
  esac
done

say "DEPRECATED — this is README § Installation, sequence D (PROFILE=surface)."
[ -z "${METABOB_CONFIG:-}" ] || say "note: METABOB_CONFIG is retired and ignored; the override is METABOB_CONFIG_PATH"
[ -n "$HUB" ]     || die "no hub. Pass --hub <discovery-url> (the hub's :<prefix>100 endpoint)."
[ -n "$API_KEY" ] || die "no api key. Pass --api-key <key issued by the hub>: docker exec <hub-container> substrate-key issue <this-node>"
case "$HUB" in http://*|https://*) ;; *) die "--hub must be a URL, e.g. http://<hub-host>:18100 (got '$HUB')" ;; esac
case "$NAME" in [!A-Za-z0-9]*|*[!A-Za-z0-9_.-]*|"") die "--name '$NAME' must be letters, digits, '.', '_' or '-'" ;; esac
[ -r "$MANIFEST" ] || die "launch manifest not found at $MANIFEST"

PREFIX=""
if [ -n "$PORT_OFFSET" ]; then
  case "$PORT_OFFSET" in *[!0-9]*) die "--port-offset must be a non-negative integer (got '$PORT_OFFSET')" ;; esac
  [ $(( PORT_OFFSET % 1000 )) -eq 0 ] || die "--port-offset must be a multiple of 1000; SUBSTRATE_PORT_PREFIX replaces it"
  PREFIX=$(( 18 + PORT_OFFSET / 1000 ))
  say "note: --port-offset is deprecated; it becomes SUBSTRATE_PORT_PREFIX=$PREFIX"
fi
C="$NAME-live"
DIR="${DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/substrate/$NAME}"

ENV_LINES=(
  "SUBSTRATE_NAME=$NAME"
  "PROFILE=surface"
  "DISCOVERY_ENDPOINT=$HUB"
  "METABOB_API_KEY=$API_KEY"
)
[ -n "$PREFIX" ] && ENV_LINES+=("SUBSTRATE_PORT_PREFIX=$PREFIX")

cat >&2 <<PLAN
[ui-only-up] The sequence (README § Installation, D):
  mkdir -p $DIR && cd $DIR
  cp <checkout>/docker-compose.yml .    # or: docker run --rm --entrypoint substrate-manifest <image> > docker-compose.yml
  cat > .env <<'EOF'
$(printf '%s\n' "${ENV_LINES[@]}" | sed -E 's/^(METABOB_API_KEY=).{4}.*/\1<redacted>/; s/^/  /')
  EOF
  $COMPOSE up -d
  docker exec $C substrate-status --wait served
  docker exec $C substrate-connect > \${METABOB_CONFIG_PATH:-~/.metabob/config.json}   # optional: the cockpit
PLAN

if [ "$DRY_RUN" = 1 ]; then
  say "DRY_RUN=1 — nothing was created."
  exit 0
fi

# Refuse before touching anything: a container this script did not create keeps
# its state and its settings. The one exception is the former naming under
# --adopt: container <n> on volumes <n>-workspace/<n>-surreal, exactly the
# volumes SUBSTRATE_NAME=<n> names.
ADOPT_OLD=""
for existing in "$NAME" "$C"; do
  if docker inspect "$existing" >/dev/null 2>&1; then
    owned="$(docker inspect -f '{{index .Config.Labels "substrate.launch-manifest"}}' "$existing" 2>/dev/null || true)"
    if [ "$existing" = "$C" ] && [ "$owned" = 1 ]; then continue; fi
    if [ "$existing" = "$NAME" ] && [ "$owned" != 1 ] && [ "$ADOPT" = 1 ]; then
      for m in "/workspace=$NAME-workspace" "/var/lib/surrealdb=$NAME-surreal"; do
        have="$(docker inspect -f "{{range .Mounts}}{{if eq .Destination \"${m%%=*}\"}}{{.Name}}{{end}}{{end}}" "$NAME")"
        [ "$have" = "${m#*=}" ] || die "'$NAME' mounts '$have' at ${m%%=*}, not ${m#*=} — adopting it would not keep its state; it is left untouched."
      done
      ADOPT_OLD="$NAME"; continue
    fi
    if [ "$existing" = "$NAME" ]; then
      die "a container named '$existing' already exists and was not created from the manifest — it is left untouched. Adopt it onto the manifest, keeping its volumes: re-run with --adopt. Or choose another --name (and --port-offset)."
    fi
    die "a container named '$existing' already exists and was not created from the manifest — it is left untouched. Choose another --name (and --port-offset)."
  fi
done

mkdir -p "$DIR"; chmod 700 "$DIR"
cp "$MANIFEST" "$DIR/docker-compose.yml"
( umask 077; printf '%s\n' "# Written by ui-only-up.sh (deprecated): README § Installation, sequence D." "${ENV_LINES[@]}" > "$DIR/.env" )
cd "$DIR"

cfg="$($COMPOSE config 2>/dev/null)" || die "'$COMPOSE config' failed in $DIR"
IMG="$(printf '%s\n' "$cfg" | sed -nE 's/^ +image: *//p' | head -1 | tr -d "\"'")"
[ -n "$IMG" ] || die "'$COMPOSE config' in $DIR named no image"
docker image inspect "$IMG" >/dev/null 2>&1 || $COMPOSE pull
# The surface profile is a name in the image's inventory. An image that predates
# it would boot into a selection FATAL; refuse here instead, with nothing created.
docker run --rm --entrypoint jq "$IMG" -e '.profiles.surface' /usr/local/share/substrate/vessels.inventory.json >/dev/null 2>&1 \
  || die "$IMG predates the surface profile (its inventory has no .profiles.surface) — pull a newer image; nothing was created"

if [ -n "$ADOPT_OLD" ]; then
  say "adopting '$ADOPT_OLD': draining it (up to ${STOP_TIMEOUT}s), then launching $C from the manifest on its volumes"
  docker stop -t "$STOP_TIMEOUT" "$ADOPT_OLD" >/dev/null
  docker rm "$ADOPT_OLD" >/dev/null
fi
$COMPOSE up -d
if ! docker exec "$C" sh -c 'command -v substrate-status' >/dev/null 2>&1; then
  die "$IMG has no substrate-status — the readiness verdict is unknown, and unknown never passes"
fi
docker exec "$C" substrate-status --wait served
say "human surface: http://$(docker port "$C" 8310/tcp 2>/dev/null | head -1 | sed -E 's/^0\.0\.0\.0/localhost/')/"
