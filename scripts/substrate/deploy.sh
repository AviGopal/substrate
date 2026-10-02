#!/usr/bin/env bash
# deploy.sh — run the launch manifest on another host.
#
# The same thing the install page does, over ssh: copy the manifest and a .env
# to the target, then `docker compose up -d` there and wait for the verdict.
# Every node kind (standalone, hub, spoke, surface, compute) is the same deploy;
# the .env says which one it is. Nothing is derived here — the target's compose
# interpolates the manifest and the image derives everything else.
#
# USAGE
#   deploy.sh --env-file <file> [options] user@host
#
#   --env-file <file>   REQUIRED. The install inputs for the target (see
#                       scripts/substrate/.env.example). Installed as <dir>/.env,
#                       mode 600. Never defaulted: a developer's own .env is not
#                       silently shipped to another machine.
#   --dir <dir>         Target directory, relative to the remote home unless
#                       absolute. Default: substrate-deploy.
#   --wait <level>      Verdict level to wait for: live | seeded | served |
#                       usable | connected. Default: usable (served suits a
#                       keyless spoke, which has no LLM arm of its own).
#   --ship-image        Stream the image the manifest names from THIS host
#                       (docker save | ssh docker load) instead of pulling it on
#                       the target. For an image that exists only locally.
#   --adopt             Accept replacing a container the manifest did not create
#                       even when its launch identity (role, selection, anchor)
#                       differs from the .env. Without it such a difference stops
#                       the deploy before anything is touched.
#   --accept-ports      Accept a change in which host ports the node exposes
#                       beyond the local host. Without it, replacing a container
#                       whose non-loopback published ports differ from the new
#                       ones stops the deploy (narrow them with *_PUBLISH_IP).
#   --skip-port-check   Proceed when the target has no tool (ss, netstat, lsof)
#                       to list listening ports. Without it that is a refusal:
#                       a check that cannot run is not a pass.
#   --import-host-env <K1,K2,…>
#                       On the target, copy each named key from /etc/environment
#                       into the .env when the .env does not set it. The values
#                       never leave the target. For a host that keeps provider
#                       keys there.
#
#   SSH_KEY=<path>       identity file for ssh (host keys: accept-new)
#   COMPOSE="<cmd>"      compose command on the target (default: docker compose)
#   GHCR_USER/GHCR_TOKEN registry login on the target before pulling; optional,
#                        the published package pulls anonymously.
#   STOP_TIMEOUT=<s>     drain allowance when replacing a running container
#                        (default 360: vessels drain to 240s, SurrealDB flushes
#                        for up to 90s). Passed explicitly because an engine-level
#                        stop does not read the manifest's grace period on every
#                        compose implementation.
#
# WHAT IT REFUSES, before stopping anything or replacing the declaration on the
# target (the new manifest + .env are staged in <dir>/.incoming and moved into
# place only after every check passes; a refusal leaves <dir> as it was):
#   - a manifest + .env that do not interpolate (`compose config` fails)
#   - a vessel selection the target's image does not know (apply-inventory dry
#     run, against the fleet inventory the node's volume holds when it has one)
#   - replacing a non-manifest container whose launch identity differs (--adopt)
#   - a change in the host ports exposed beyond the local host (--accept-ports)
#   - a host port the new container would publish that something else holds
#   - a port check that cannot run (--skip-port-check)
#
# The target needs ssh access; a container engine is installed via
# get.docker.com when none is present.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$HERE/../../docker-compose.yml"
ENV_FILE=""
DIR="substrate-deploy"
WAIT_LEVEL="usable"
SHIP=0
ADOPT=0
ACCEPT_PORTS=0
SKIP_PORT_CHECK=0
IMPORT_KEYS=""
TARGET=""

log() { echo "[deploy] $*" >&2; }
die() { log "ERROR: $*"; exit 1; }
usage() { sed -n '2,64p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit "${1:-2}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file)        ENV_FILE="${2:-}"; shift 2 ;;
    --dir)             DIR="${2:-}"; shift 2 ;;
    --wait)            WAIT_LEVEL="${2:-}"; shift 2 ;;
    --ship-image)      SHIP=1; shift ;;
    --adopt)           ADOPT=1; shift ;;
    --accept-ports)    ACCEPT_PORTS=1; shift ;;
    --skip-port-check) SKIP_PORT_CHECK=1; shift ;;
    --import-host-env) IMPORT_KEYS="${2:-}"; shift 2 ;;
    -h|--help)         usage 0 ;;
    -*)                log "unknown option '$1'"; usage 2 ;;
    *)                 [ -z "$TARGET" ] || { log "more than one target given"; usage 2; }; TARGET="$1"; shift ;;
  esac
done
[ -n "$TARGET" ]   || { log "no target (user@host)"; usage 2; }
[ -n "$ENV_FILE" ] || { log "--env-file is required"; usage 2; }
[ -r "$ENV_FILE" ] || die "cannot read env file '$ENV_FILE'"
[ -r "$MANIFEST" ] || die "launch manifest not found at $MANIFEST"
[ -n "$DIR" ]      || die "--dir must not be empty"
case "$WAIT_LEVEL" in live|seeded|served|usable|connected) ;; *) die "--wait must be one of live|seeded|served|usable|connected (got '$WAIT_LEVEL')" ;; esac
case "$IMPORT_KEYS" in *[!A-Za-z0-9_,]*) die "--import-host-env takes a comma-separated list of variable names (got '$IMPORT_KEYS')" ;; esac

COMPOSE="${COMPOSE:-docker compose}"
STOP_TIMEOUT="${STOP_TIMEOUT:-360}"
case "$STOP_TIMEOUT" in ''|*[!0-9]*) die "STOP_TIMEOUT must be a number of seconds" ;; esac
SSH=(ssh -o StrictHostKeyChecking=accept-new); [ -n "${SSH_KEY:-}" ] && SSH+=(-i "$SSH_KEY")

# ── 1. Interpolate locally first: a malformed .env fails here, not on the target.
# The target resolves the manifest from its .env alone, so the local check does
# too: every variable the manifest names is unset for it. Otherwise an exported
# SUBSTRATE_IMAGE (for one) would resolve — and ship — a different image than
# the one the target looks for.
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
chmod 700 "$STAGE"
cp "$MANIFEST" "$STAGE/docker-compose.yml"
( umask 077; cp "$ENV_FILE" "$STAGE/.env" )
UNSET_ARGS=()
for v in $(grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*' "$MANIFEST" | cut -c3- | sort -u); do UNSET_ARGS+=(-u "$v"); done
if $COMPOSE version >/dev/null 2>&1; then
  LOCAL_CFG="$(cd "$STAGE" && env "${UNSET_ARGS[@]}" $COMPOSE config 2>/dev/null)" \
    || die "the manifest does not interpolate with $ENV_FILE (run '$COMPOSE config' beside a copy to see why)"
  IMAGE_LOCAL="$(printf '%s\n' "$LOCAL_CFG" | sed -nE 's/^ +image: *//p' | head -1 | tr -d "\"'")"
else
  [ "$SHIP" = 1 ] && die "--ship-image needs '$COMPOSE' on this host to resolve which image the manifest names"
  log "'$COMPOSE' not on this host — interpolation is checked on the target only"
  IMAGE_LOCAL=""
fi

# ── 2. Optionally stream the image (no registry involved). Loading an image
# changes no container and no declaration.
if [ "$SHIP" = 1 ]; then
  [ -n "$IMAGE_LOCAL" ] || die "could not resolve the manifest's image locally"
  docker image inspect "$IMAGE_LOCAL" >/dev/null 2>&1 \
    || die "$IMAGE_LOCAL is not present on this host (build it: make -C scripts/substrate build)"
  "${SSH[@]}" "$TARGET" 'command -v docker >/dev/null 2>&1 || { curl -fsSL https://get.docker.com | sh; }' </dev/null
  log "shipping $IMAGE_LOCAL -> $TARGET (docker save | ssh docker load)…"
  docker save "$IMAGE_LOCAL" | gzip | "${SSH[@]}" "$TARGET" 'gunzip | docker load'
fi

# ── 3. Stage the declaration on the target: the manifest and the .env, nothing
# else, in <dir>/.incoming. The live <dir>/docker-compose.yml and .env are not
# touched until every check below passes.
QDIR="$(printf '%q' "$DIR")"
log "staging the manifest and .env at $TARGET:$DIR/.incoming"
"${SSH[@]}" "$TARGET" "mkdir -p $QDIR && chmod 700 $QDIR && rm -rf $QDIR/.incoming && mkdir -m 700 $QDIR/.incoming" </dev/null
"${SSH[@]}" "$TARGET" "cat > $QDIR/.incoming/docker-compose.yml" < "$STAGE/docker-compose.yml"
"${SSH[@]}" "$TARGET" "umask 077 && cat > $QDIR/.incoming/.env && chmod 600 $QDIR/.incoming/.env" < "$STAGE/.env"

# ── 4. On the target: preflight the staged pair, commit it, replace, launch, verdict.
REMOTE_ENV=$(printf '%q ' DIR="$DIR" COMPOSE="$COMPOSE" WAIT_LEVEL="$WAIT_LEVEL" SHIP="$SHIP" \
  ADOPT="$ADOPT" ACCEPT_PORTS="$ACCEPT_PORTS" SKIP_PORT_CHECK="$SKIP_PORT_CHECK" IMPORT_KEYS="$IMPORT_KEYS" \
  STOP_TIMEOUT="$STOP_TIMEOUT" GHCR_USER="${GHCR_USER:-}" GHCR_TOKEN="${GHCR_TOKEN:-}")
"${SSH[@]}" "$TARGET" "env $REMOTE_ENV bash -s" <<'REMOTE'
set -euo pipefail
say() { echo "[deploy@$(uname -n 2>/dev/null)] $*" >&2; }
die() { say "ERROR: $*"; exit 1; }

command -v docker >/dev/null 2>&1 || { say "no container engine — installing Docker"; curl -fsSL https://get.docker.com | sh; }
cd "$DIR"
LIVE="$PWD"
STAGED="$LIVE/.incoming"
committed=0
# A refusal anywhere below removes the staged pair and leaves the live one as it was.
trap '[ "$committed" = 1 ] || { rm -rf "$STAGED"; say "stopped before commit — $LIVE/docker-compose.yml and .env are unchanged"; }' EXIT
[ -f "$STAGED/docker-compose.yml" ] && [ -f "$STAGED/.env" ] || die "staged declaration missing in $STAGED"
$COMPOSE version >/dev/null 2>&1 || die "'$COMPOSE' is not available on this host"

# Keys this host keeps in /etc/environment, copied into the staged .env only
# where the .env leaves them unset.
if [ -n "$IMPORT_KEYS" ]; then
  imported=""
  for k in $(printf '%s' "$IMPORT_KEYS" | tr ',' ' '); do
    if grep -qE "^${k}=." "$STAGED/.env"; then continue; fi
    v="$(grep -E "^${k}=" /etc/environment 2>/dev/null | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true)"
    [ -n "$v" ] || continue
    printf '%s=%s\n' "$k" "$v" >> "$STAGED/.env"; imported="$imported $k"
  done
  [ -z "$imported" ] || say "imported from /etc/environment:$imported"
fi

# Interpolate the STAGED pair. The project name is pinned only for this
# read-only check; the launch below runs in the live directory.
cfg="$(cd "$STAGED" && $COMPOSE -p substrate-deploy-preflight config 2>/dev/null)" \
  || die "'$COMPOSE config' failed on the staged manifest + .env — they do not interpolate here"
C="$(printf '%s\n' "$cfg" | sed -nE 's/^ +container_name: *//p' | head -1 | tr -d "\"'")"
IMG="$(printf '%s\n' "$cfg" | sed -nE 's/^ +image: *//p' | head -1 | tr -d "\"'")"
WS="$(printf '%s\n' "$cfg" | awk '/^  substrate-workspace:/{f=1;next} f&&/^ +name:/{sub(/^ +name: */,"");print;exit}' | tr -d "\"'")"
[ -n "$C" ] && [ -n "$IMG" ] || die "the manifest named no container_name or image"
cfg_env() { printf '%s\n' "$cfg" | sed -nE "s/^ +$1: *//p" | head -1 | sed -E "s/^'(.*)'$/\1/; s/^\"(.*)\"$/\1/"; }

# "<host-ip> <host-port>" per published port, from either `compose config`
# form: the short `- [ip:]host:container` (podman-compose) or the long form's
# `host_ip:` / `published:` keys (docker compose). No ip prints as '*'.
published_ports() {
  printf '%s\n' "$cfg" | tr -d "\"'" | awk '
    /^ +- / { ip = "*" }
    /^ +- ([0-9.]+:)?[0-9]+:[0-9]+(\/[a-z]+)?$/ {
      s = $0; sub(/^ +- /, "", s); sub(/\/[a-z]+$/, "", s)
      n = split(s, a, ":"); print (n == 3 ? a[1] : "*"), a[n-1]; next }
    /^ +host_ip: / { s = $0; sub(/^ +host_ip: */, "", s); ip = s }
    /^ +published: / { s = $0; sub(/^ +published: */, "", s); print ip, s }'
}
# The same shape for a container that exists, running or stopped.
container_ports() {
  { docker inspect -f '{{range $k, $v := .HostConfig.PortBindings}}{{range $v}}{{.HostIp}} {{.HostPort}}{{println}}{{end}}{{end}}' "$1" 2>/dev/null || true; } \
    | awk 'NF == 1 { print "*", $1; next } NF == 2 { print $1, $2 }'
}
# Host ports reachable beyond this host: every binding not on loopback.
exposed() { awk '$1 !~ /^127\./ && $1 != "::1" && $1 != "localhost" { print $2 }' | sort -u; }

if [ -n "$GHCR_TOKEN" ] && [ -n "$GHCR_USER" ]; then
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi
if [ "$SHIP" != 1 ]; then
  say "pulling $IMG"
  docker pull "$IMG" >/dev/null
fi
docker image inspect "$IMG" >/dev/null 2>&1 || die "image $IMG is not present after the pull"

# Preflight: the selection must resolve on THIS image. A profile or vessel name
# the image does not know is a boot-time FATAL; finding it here keeps the running
# container up instead of replacing it with one that cannot boot. At boot the
# selector prefers the fleet inventory kept in the workspace volume over the
# image's copy, so an existing volume is mounted read-only to check that one.
vol_args=()
if [ -n "$WS" ] && docker volume inspect "$WS" >/dev/null 2>&1; then vol_args=(-v "$WS:/workspace:ro"); fi
sel_out="$(docker run --rm ${vol_args[@]+"${vol_args[@]}"} --entrypoint env "$IMG" DRY_RUN=1 \
  PROFILE="$(cfg_env PROFILE)" ENABLED_VESSELS="$(cfg_env ENABLED_VESSELS)" \
  ENABLED_ROLES="$(cfg_env ENABLED_ROLES)" ENABLED_EXTRA_VESSELS="$(cfg_env ENABLED_EXTRA_VESSELS)" \
  DISABLED_VESSELS="$(cfg_env DISABLED_VESSELS)" /usr/local/bin/apply-inventory 2>&1)" || {
  printf '%s\n' "$sel_out" | tail -5 >&2
  die "the vessel selection in .env does not resolve on $IMG — nothing was stopped"
}

exists=0; replace=0
if docker inspect "$C" >/dev/null 2>&1; then
  exists=1
  owned="$(docker inspect -f '{{index .Config.Labels "substrate.launch-manifest"}}' "$C" 2>/dev/null || true)"
  if [ "$owned" != 1 ]; then
    old="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$C")"
    diffs=""
    for n in PROFILE ENABLED_ROLES ENABLED_VESSELS ENABLED_EXTRA_VESSELS DISABLED_VESSELS \
             DISCOVERY_ENDPOINT HUB_DISCOVERY_URL ACTIVITY_API_ENDPOINT IDENTITY_VESSEL_URL \
             PEER_DISCOVERY_ENDPOINTS FED_SUBSTRATE_ID RELAY_MULTIADDR PUBLIC_IP; do
      o="$(printf '%s\n' "$old" | sed -n "s/^$n=//p" | head -1)"; m="$(cfg_env "$n")"
      [ "$o" = "$m" ] || diffs="$diffs
  $n: container='$o' manifest='$m'"
    done
    if [ -n "$diffs" ]; then
      say "$C was not created from the manifest; its launch identity differs from .env:$diffs"
      [ "$ADOPT" = 1 ] || die "put the container's values in .env (the names above), or pass --adopt to accept the change — nothing was stopped"
    fi
    replace=1
  fi
fi

want_all="$(published_ports)"
[ -n "$want_all" ] || die "could not read the published ports from '$COMPOSE config'"

# Preflight: what the node exposes beyond this host is an operator decision.
# A replacement that would publish a different set of non-loopback ports than
# the container it replaces stops here unless that change was accepted.
if [ "$exists" = 1 ]; then
  old_exp="$(container_ports "$C" | exposed)"
  new_exp="$(printf '%s\n' "$want_all" | exposed)"
  if [ "$old_exp" != "$new_exp" ]; then
    added="$(comm -13 <(printf '%s\n' "$old_exp") <(printf '%s\n' "$new_exp") | tr '\n' ' ')"
    removed="$(comm -23 <(printf '%s\n' "$old_exp") <(printf '%s\n' "$new_exp") | tr '\n' ' ')"
    say "the host ports $C exposes beyond this host would change: added [ ${added}] removed [ ${removed}]"
    [ "$ACCEPT_PORTS" = 1 ] || die "keep a port on this host with <VESSEL>_PUBLISH_IP=127.0.0.1 in .env, or pass --accept-ports — nothing was stopped"
  fi
fi

# Preflight: every host port the new container publishes must be free, apart
# from the ones the container being replaced holds now. A bind failure after the
# old container is gone would leave the node down.
want="$(printf '%s\n' "$want_all" | awk '{print $2}' | sort -u)"
held="$(container_ports "$C" | awk '{print $2}' | sort -u)"
listening=""; lister=""
if command -v ss >/dev/null 2>&1; then
  lister=ss; listening="$(ss -ltnH 2>/dev/null | awk '{print $4}')"
elif command -v netstat >/dev/null 2>&1; then
  lister=netstat; listening="$(netstat -ltn 2>/dev/null | awk 'NR > 2 {print $4}')"
elif command -v lsof >/dev/null 2>&1; then
  lister=lsof; listening="$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 {print $9}')"
fi
# Ports other containers publish, which a rootless engine may hold without a
# listener the tools above can see.
others="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | awk -v c="$C" '$1 != c' | grep -oE ':[0-9]+->' | tr -d ':>-' || true)"
listening="$listening
$others"
if [ -z "$lister" ]; then
  if [ "$SKIP_PORT_CHECK" = 1 ]; then
    say "WARNING: no ss, netstat or lsof here — only ports other containers publish were checked (--skip-port-check)"
  else
    die "no ss, netstat or lsof on this host, so the host-port check cannot run — install one, or pass --skip-port-check; nothing was stopped"
  fi
fi
listening="$(printf '%s\n' "$listening" | sed -E 's/.*[:.]([0-9]+)$/\1/' | grep -E '^[0-9]+$' | sort -u || true)"
busy=""
for p in $want; do
  if grep -qx "$p" <<<"$listening" && ! grep -qx "$p" <<<"$held"; then busy="$busy $p"; fi
done
[ -z "$busy" ] || die "host port(s) already held by something else:$busy — nothing was stopped (set SUBSTRATE_PORT_PREFIX or RELAY_PORT in .env)"

# Every check passed: the staged pair becomes the declaration.
mv -f "$STAGED/docker-compose.yml" "$LIVE/docker-compose.yml"
mv -f "$STAGED/.env" "$LIVE/.env"
chmod 600 "$LIVE/.env"
rm -rf "$STAGED"
committed=1

if [ "$replace" = 1 ]; then
  say "draining $C (up to ${STOP_TIMEOUT}s; volumes kept) to replace it with the manifest's container"
  docker stop -t "$STOP_TIMEOUT" "$C" >/dev/null
  docker rm "$C" >/dev/null
fi

say "$COMPOSE up -d  (container $C)"
$COMPOSE up -d
docker logout ghcr.io >/dev/null 2>&1 || true

if ! docker exec "$C" sh -c 'command -v substrate-status' >/dev/null 2>&1; then
  say "ERROR: $IMG has no substrate-status — the readiness verdict is unknown, and unknown never passes."
  say "  The container is up. Diagnostic only: docker exec $C substrate-ready"
  exit 3
fi
docker exec "$C" substrate-status --wait "$WAIT_LEVEL"
REMOTE
log "done — $TARGET:$DIR holds the manifest and .env; re-run this command to upgrade or change inputs"
