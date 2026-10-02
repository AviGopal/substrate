#!/usr/bin/env bash
# gen-cluster-fixture.sh — generate a hub + spoke fixture FROM the launch manifest.
#
# The fixture the setup instructions are tested against: one hub and one spoke on
# one host, each a byte-identical copy of the root docker-compose.yml plus its own
# .env, joined by one container network. Nothing about how the image runs is
# declared here — ports, volumes, grace, privilege and healthcheck all come from
# the copied manifest, so the fixture cannot drift from it. The only additions are
# the ones a co-located pair needs and a real deployment does not: a shared
# network with a fixed address per node (compose override) and container-network
# addresses in the .env files.
#
# It is NOT a production topology. A real hub and spoke live on different hosts
# (law 11: a vessel belongs where its data lives); co-locating them tests the
# configuration surface, not placement.
#
# USAGE
#   gen-cluster-fixture.sh [--out <dir>] [options]
#
#   --out <dir>            where to write hub/ and spoke/ (default ./cluster-fixture)
#   --hub-name <n>         SUBSTRATE_NAME of the hub   (default cluster-hub)
#   --spoke-name <n>       SUBSTRATE_NAME of the spoke (default cluster-spoke)
#   --hub-prefix <p>       SUBSTRATE_PORT_PREFIX of the hub   (default 20)
#   --spoke-prefix <p>     SUBSTRATE_PORT_PREFIX of the spoke (default 21)
#   --network <name>       the shared container network (default substrate-cluster-net)
#   --subnet <a.b.c.0/24>  its subnet (default 10.213.7.0/24); the hub is pinned at
#                          .10 and the spoke at .11. A pinned IPv4 is what the hub's
#                          relay announces (/ip4/<address>), so it must be a literal
#                          address, never a container name.
#   --roles                describe the hub by role instead of PROFILE=hub: the role
#                          groups and vessels of this checkout's hub composition,
#                          for an image whose inventory predates the profiles. Chosen
#                          automatically when the hub's image (SUBSTRATE_IMAGE from
#                          --hub-env, else the manifest's default) has no hub
#                          profile; units that image's inventory does not name are
#                          dropped with a warning, since naming one is a boot FATAL.
#   --join <discovery-url> generate ONLY the spoke, joined to an existing hub at this
#                          discovery URL (as reachable from inside the spoke
#                          container) — no hub, no shared network
#   --hub-env K=V          add an input to the hub's .env   (repeatable)
#   --spoke-env K=V        add an input to the spoke's .env (repeatable), e.g.
#                          PROFILE=compute or ENABLED_VESSELS=… to test a selection
#
# The generated .env files are mode 600. Provider keys are never read from this
# host's configuration: pass one with --hub-env, or export it in the shell that
# runs `docker compose up` (the manifest reads the process environment first).
#
# The launch sequence for the generated fixture is printed at the end. Teardown is
# `docker compose down -v` in each directory: the fixture's names are distinct
# from any real fleet's, and the default name `substrate` is refused.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$HERE/../../docker-compose.yml"
OUT="./cluster-fixture"
HUB_NAME="cluster-hub"; SPOKE_NAME="cluster-spoke"
HUB_PREFIX=20; SPOKE_PREFIX=21
NETWORK="substrate-cluster-net"
SUBNET="10.213.7.0/24"
ROLES=0; JOIN=""
HUB_EXTRA=(); SPOKE_EXTRA=()

die() { echo "[gen-cluster-fixture] ERROR: $*" >&2; exit 1; }
usage() { sed -n '2,50p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit "${1:-2}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --out)          OUT="${2:-}"; shift 2 ;;
    --hub-name)     HUB_NAME="${2:-}"; shift 2 ;;
    --spoke-name)   SPOKE_NAME="${2:-}"; shift 2 ;;
    --hub-prefix)   HUB_PREFIX="${2:-}"; shift 2 ;;
    --spoke-prefix) SPOKE_PREFIX="${2:-}"; shift 2 ;;
    --network)      NETWORK="${2:-}"; shift 2 ;;
    --subnet)       SUBNET="${2:-}"; shift 2 ;;
    --roles)        ROLES=1; shift ;;
    --join)         JOIN="${2:-}"; shift 2 ;;
    --hub-env)      HUB_EXTRA+=("${2:-}"); shift 2 ;;
    --spoke-env)    SPOKE_EXTRA+=("${2:-}"); shift 2 ;;
    -h|--help)      usage 0 ;;
    *) echo "[gen-cluster-fixture] unknown argument '$1'" >&2; usage 2 ;;
  esac
done

[ -r "$MANIFEST" ] || die "launch manifest not found at $MANIFEST"
for n in "$HUB_NAME" "$SPOKE_NAME"; do
  [ "$n" != substrate ] || die "the fixture may not use the default name 'substrate' — its teardown (down -v) would destroy a real fleet's volumes"
  case "$n" in [!a-z0-9]*|*[!a-z0-9_-]*) die "name '$n' must be lowercase letters, digits, '-' or '_' (it is also the compose project name)" ;; esac
done
[ "$HUB_NAME" != "$SPOKE_NAME" ] || die "hub and spoke need different names"
for p in "$HUB_PREFIX" "$SPOKE_PREFIX"; do
  case "$p" in ''|*[!0-9]*) die "port prefix '$p' is not a number" ;; esac
done
[ -n "$JOIN" ] || [ "$HUB_PREFIX" != "$SPOKE_PREFIX" ] || die "hub and spoke need different port prefixes"
for kv in ${HUB_EXTRA[@]+"${HUB_EXTRA[@]}"} ${SPOKE_EXTRA[@]+"${SPOKE_EXTRA[@]}"}; do
  case "$kv" in [A-Z_]*=*) ;; *) die "--hub-env/--spoke-env take NAME=value (got '$kv')" ;; esac
done

case "$SUBNET" in
  *.*.*.0/24) _net="${SUBNET%.0/24}" ;;
  *) die "--subnet must be an IPv4 /24 written a.b.c.0/24 (got '$SUBNET')" ;;
esac
case "$_net" in *[!0-9.]*) die "--subnet '$SUBNET' is not an IPv4 network" ;; esac
HUB_IP="$_net.10"; SPOKE_IP="$_net.11"

HUB_C="$HUB_NAME-live"; SPOKE_C="$SPOKE_NAME-live"

# The hub's image and its fleet inventory, read from the image itself so the
# selection written below is one that image can boot. Unreadable (no engine, or
# the image not pulled) means unchecked, and is said so.
HUB_IMAGE="ghcr.io/avigopal/substrate:dev"
for kv in ${HUB_EXTRA[@]+"${HUB_EXTRA[@]}"}; do
  case "$kv" in SUBSTRATE_IMAGE=*) HUB_IMAGE="${kv#SUBSTRATE_IMAGE=}" ;; esac
done
IMG_INV=""
if [ -z "$JOIN" ] && command -v docker >/dev/null 2>&1 && docker image inspect "$HUB_IMAGE" >/dev/null 2>&1; then
  IMG_INV="$(docker run --rm --entrypoint cat "$HUB_IMAGE" /usr/local/share/substrate/vessels.inventory.json 2>/dev/null || true)"
fi
if [ -z "$JOIN" ] && [ -z "$IMG_INV" ]; then
  echo "[gen-cluster-fixture] note: could not read $HUB_IMAGE's inventory (not pulled?) — the hub selection is unchecked against it" >&2
fi
if [ -z "$JOIN" ] && [ "$ROLES" != 1 ] && [ -n "$IMG_INV" ] \
   && ! printf '%s' "$IMG_INV" | jq -e '(.profiles.hub // .composed_profiles.hub) != null' >/dev/null 2>&1; then
  echo "[gen-cluster-fixture] $HUB_IMAGE has no hub profile — describing the hub by role (--roles)" >&2
  ROLES=1
fi

# write_node <dir> <address|""> — the manifest copy and, when the pair shares a
# network, the override that attaches the node to it at a fixed address. The
# .env is written by the caller.
write_node() {
  local d="$1" ip="$2"
  mkdir -p "$d"
  cp "$MANIFEST" "$d/docker-compose.yml"
  cmp -s "$MANIFEST" "$d/docker-compose.yml" || die "copy of the manifest in $d differs from the source"
  if [ -n "$ip" ]; then
    cat > "$d/docker-compose.override.yml" <<YAML
# Fixture-only: attach this node to the network its peer is on, at a fixed
# address, so each reaches the other by container name or address. Everything
# else comes from docker-compose.yml.
services:
  substrate:
    networks:
      cluster:
        ipv4_address: $ip
networks:
  cluster:
    name: $NETWORK
    external: true
YAML
  fi
}

# write_env <file> <lines...> then the extras.
write_env() {
  local f="$1"; shift
  ( umask 077; : > "$f" )
  local line
  for line in "$@"; do printf '%s\n' "$line" >> "$f"; done
}

mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

if [ -z "$JOIN" ]; then
  write_node "$OUT/hub" "$HUB_IP"
  hub_sel=("PROFILE=hub")
  if [ "$ROLES" = 1 ]; then
    # The hub composition, read from this checkout's inventory rather than copied.
    INV="$HERE/vessels.inventory.json"
    command -v jq >/dev/null 2>&1 || die "--roles reads $INV with jq, which is not installed"
    _roles="$(jq -er '.composed_profiles.hub.roles | join(",")' "$INV" 2>/dev/null)" \
      || die "--roles: $INV has no composed_profiles.hub.roles"
    _units="$(jq -r '(.composed_profiles.hub.vessels // []) | join(",")' "$INV")"
    if [ -n "$IMG_INV" ] && [ -n "$_units" ]; then
      _known=""; _dropped=""
      for u in $(printf '%s' "$_units" | tr ',' ' '); do
        if printf '%s' "$IMG_INV" | jq -e --arg u "$u" 'any(.vessels[]; .unit == $u)' >/dev/null 2>&1; then
          _known="${_known:+$_known,}$u"
        else
          _dropped="$_dropped $u"
        fi
      done
      [ -z "$_dropped" ] || echo "[gen-cluster-fixture] WARNING: $HUB_IMAGE does not ship:$_dropped — left out of the hub selection" >&2
      _units="$_known"
    fi
    hub_sel=("ENABLED_ROLES=$_roles")
    [ -z "$_units" ] || hub_sel+=("ENABLED_EXTRA_VESSELS=$_units")
  fi
  write_env "$OUT/hub/.env" \
    "# Generated by scripts/substrate/gen-cluster-fixture.sh — the fixture hub." \
    "SUBSTRATE_NAME=$HUB_NAME" \
    "SUBSTRATE_PORT_PREFIX=$HUB_PREFIX" \
    "# One compose project per fixture node, whatever the directory is called." \
    "COMPOSE_PROJECT_NAME=$HUB_C" \
    "${hub_sel[@]}" \
    "# The hub's fixed address on the shared network. The relay announces it as" \
    "# /ip4/$HUB_IP, which takes a literal address, never a container name." \
    "PUBLIC_IP=$HUB_IP" \
    "# A spoke on the shared network dials the hub's CONTAINER ports, never a host" \
    "# port and never loopback, so the advertised URLs and the relay's announced" \
    "# port name them outright instead of the prefix-derived host ports." \
    "DISCOVERY_PUBLIC_URL=http://$HUB_C:8100" \
    "IDENTITY_PUBLIC_URL=http://$HUB_C:8101" \
    "RELAY_ANNOUNCE_PORT=30333" \
    ${HUB_EXTRA[@]+"${HUB_EXTRA[@]}"}
  JOIN_URL="http://$HUB_C:8100"
  spoke_ip="$SPOKE_IP"
else
  JOIN_URL="$JOIN"
  spoke_ip=""
fi

write_node "$OUT/spoke" "$spoke_ip"
spoke_lines=(
  "# Generated by scripts/substrate/gen-cluster-fixture.sh — the fixture spoke."
  "SUBSTRATE_NAME=$SPOKE_NAME"
  "SUBSTRATE_PORT_PREFIX=$SPOKE_PREFIX"
  "COMPOSE_PROJECT_NAME=$SPOKE_C"
  "# The join pair. METABOB_API_KEY is minted BY THE HUB after it boots; the launch"
  "# sequence appends it."
  "DISCOVERY_ENDPOINT=$JOIN_URL"
)
if [ -z "$JOIN" ]; then
  # The hub is reached on its CONTAINER ports over the shared network, which is
  # not the prefix-encoded host block a derivation could read an offset from, so
  # its sibling endpoints are named rather than inferred.
  spoke_lines+=(
    "ACTIVITY_API_ENDPOINT=http://$HUB_C:8080"
    "IDENTITY_VESSEL_URL=http://$HUB_C:8101"
    "# The spoke advertises its vessels at its fixed address on the shared network."
    "PUBLIC_IP=$SPOKE_IP"
    "DISCOVERY_PUBLIC_URL=http://$SPOKE_C:8100"
    "IDENTITY_PUBLIC_URL=http://$HUB_C:8101"
  )
fi
write_env "$OUT/spoke/.env" "${spoke_lines[@]}" ${SPOKE_EXTRA[@]+"${SPOKE_EXTRA[@]}"}

echo "[gen-cluster-fixture] wrote $OUT (manifest copies are byte-identical to $MANIFEST)"
echo
echo "Launch (a provider key for the hub: export ANTHROPIC_API_KEY=… or --hub-env):"
if [ -z "$JOIN" ] && [ "$ROLES" != 1 ]; then
  echo "  (PROFILE=hub needs an image whose inventory defines the hub composition; regenerate with --roles otherwise)"
fi
if [ -z "$JOIN" ]; then
  cat <<STEPS
  docker network create --subnet $SUBNET $NETWORK   # once; both nodes attach to it
  cd $OUT/hub   && docker compose up -d
  docker exec $HUB_C substrate-status --wait usable
  K=\$(docker exec $HUB_C substrate-key issue $SPOKE_NAME) && echo "METABOB_API_KEY=\$K" >> $OUT/spoke/.env
  cd $OUT/spoke && docker compose up -d
  docker exec $SPOKE_C substrate-status --wait served

Teardown (fixture volumes only):
  cd $OUT/spoke && docker compose down -v
  cd $OUT/hub   && docker compose down -v
  docker network rm $NETWORK
STEPS
else
  cat <<STEPS
  echo "METABOB_API_KEY=<a key issued by the hub at $JOIN>" >> $OUT/spoke/.env
  cd $OUT/spoke && docker compose up -d
  docker exec $SPOKE_C substrate-status --wait served

Teardown (fixture volumes only):
  cd $OUT/spoke && docker compose down -v
STEPS
fi
