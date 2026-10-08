#!/usr/bin/env bash
# substrate-install.sh — print the one-command installer for this image.
#
#   docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | ANTHROPIC_API_KEY=sk-ant-… sh
#   docker run --rm --pull always ghcr.io/avigopal/substrate:dev install | SUBSTRATE_JOIN=<token from `substrate-key join` on the hub> sh
#
# STDOUT CARRIES ONLY A POSIX sh SCRIPT. It runs README § Installation's sequence and
# nothing else: write the launch manifest and a `.env` of install inputs into a fleet
# directory, `compose up -d`, wait for `seeded`, write the client config from
# substrate-connect, then wait for the requested level (default `usable`). It derives
# nothing the image derives (role, endpoints, key requirement, secrets); the image
# still judges every input at boot.
#
# Two facts are baked in at print time, so the emitted script cannot drift from the
# image that printed it:
#   - the launch manifest, byte for byte (the same file substrate-manifest prints);
#   - the input names: the install inputs and the manifest's provider-key section are
#     carried from the environment into `.env`; every other variable the manifest
#     interpolates is read from `.env` only and unset from the environment compose
#     sees, so an ambient shell variable (a GITHUB_TOKEN, a REDIS_URL) never configures
#     a fleet by accident.
#
# Exit status of the emitted script: 0 when the requested level passes; 20 when every
# step ran and the verdict is short of the requested level (the install acceptance run
# reads 20 as "a wait for a level", like a failed `substrate-status --wait`); anything
# else is a step that did not run.
set -euo pipefail

MANIFEST="${SUBSTRATE_MANIFEST:-/usr/local/share/substrate/docker-compose.yml}"
[ -f "$MANIFEST" ] || { echo "[install] $MANIFEST is missing from this image" >&2; exit 1; }
if grep -qx 'SUBSTRATE_MANIFEST_EOF' "$MANIFEST"; then
  echo "[install] the manifest contains the heredoc delimiter; refusing to print a broken installer" >&2
  exit 1
fi

# Every ${NAME…} the manifest interpolates, in manifest order, deduplicated.
names_in() { grep -v '^[[:space:]]*#' | grep -oE '\$\{[A-Z][A-Z0-9_]*' | cut -c3- | awk '!seen[$0]++' | tr '\n' ' '; }
INPUT_NAMES="$(names_in < "$MANIFEST")"
[ -n "$INPUT_NAMES" ] || { echo "[install] found no input names in the manifest" >&2; exit 1; }
# The ones the installer takes from its environment: the install inputs (README
# § Installation's closed set) and the manifest's provider-key section. Every other
# manifest input is advanced configuration: it is honoured from .env, and ignored (with
# a notice) when it is only ambient in the shell, so .env is the one declaration.
PROVIDER_NAMES="$(awk '/# ── Provider keys/{f=1;next} f&&/# ──/{exit} f' "$MANIFEST" | names_in)"
[ -n "$PROVIDER_NAMES" ] || { echo "[install] found no provider-key section in the manifest" >&2; exit 1; }
CARRY_NAMES="SUBSTRATE_IMAGE SUBSTRATE_NAME SUBSTRATE_PORT_PREFIX PROFILE SUBSTRATE_UPDATE_CHANNEL SUBSTRATE_ACCEPTANCE DISCOVERY_ENDPOINT METABOB_API_KEY PUBLIC_IP SUBSTRATE_GIT_PAT SUBSTRATE_REPO_OWNER ${PROVIDER_NAMES}"
for n in $CARRY_NAMES; do
  case " $INPUT_NAMES " in *" $n "*) ;; *) echo "[install] install input $n is not read by the manifest" >&2; exit 1 ;; esac
done

REVISION="$(cat /etc/substrate/image-revision 2>/dev/null || echo unknown)"

case "${1:-}" in
  ""|--print) ;;
  -h|--help)
    cat <<'EOF'
usage: docker run --rm <image> install | [INPUT=value …] sh [-s -- options]

Prints an installer for this image. Pipe it to sh; options go after `sh -s --`.

  --join <token|url>       join a network: the join token the hub issued
                           (`substrate-key join <name>` on the hub; prefer SUBSTRATE_JOIN=<token>
                           in the environment, since it carries the key), or the hub's
                           discovery URL together with --key
  --key <key>              the key the hub issued (METABOB_API_KEY; prefer the env form)
  --profile <p>            standalone | hub | hub-minimal | spoke | surface | compute (PROFILE)
  --public-ip <addr>       the address spokes reach; required for a hub (PUBLIC_IP)
  --name <n>               fleet name: container <n>-live, volumes <n>-* (SUBSTRATE_NAME)
  --prefix <nn>            host port prefix, ports <nn>xxx (SUBSTRATE_PORT_PREFIX)
  --dir <path>             fleet directory (default ./<name>)
  --engine docker|podman   container engine (default: the first whose compose answers)
  --wait <level>           live | seeded | served | usable | none (default usable)
  --no-connect             do not write the client configuration
  --adopt                  keep the existing volumes of this name: move a fleet launched
                           another way onto the manifest (remove its container first;
                           learning state, keys and secrets in the volumes are kept)

Install inputs may also be given as environment variables of the sh: a provider key
(ANTHROPIC_API_KEY, OPENAI_API_KEY, …), METABOB_API_KEY, SUBSTRATE_GIT_PAT +
SUBSTRATE_REPO_OWNER. They are written to the fleet's .env, so a later
`compose up -d` keeps them. Advanced configuration is read from that .env only.
Re-running updates a fleet: run it inside the fleet directory (or where it was first
run, with the same --name). Inputs you pass replace their lines, the rest are kept, and
the container is recreated when the image changed. To upgrade, run the install command
again: its --pull always fetches the newer image.
EOF
    exit 0 ;;
  *) echo "usage: substrate-install [--help]   (options belong to the printed script: … | sh -s -- <options>)" >&2; exit 2 ;;
esac

cat <<EOF
#!/bin/sh
# substrate installer, printed by image revision ${REVISION}.
# Runs README § Installation: manifest + .env -> compose up -d -> wait seeded ->
# client config -> wait for the requested level. Options: see \`install --help\`.
set -eu
INPUT_NAMES='${INPUT_NAMES}'
CARRY_NAMES='${CARRY_NAMES}'
EOF

cat <<'EOF'
say() { printf '[install] %s\n' "$*" >&2; }
die() { say "$*"; exit 1; }

engine=""; dir=""; wait_level=usable; connect=1; adopt=0
set_name=""; set_prefix=""; set_profile=""; set_public_ip=""; set_join=""; set_key=""
while [ $# -gt 0 ]; do
  case "$1" in
    --join) set_join="${2:?--join needs a discovery url}"; shift 2 ;;
    --key) set_key="${2:?--key needs a key}"; shift 2 ;;
    --profile) set_profile="${2:?--profile needs a value}"; shift 2 ;;
    --public-ip) set_public_ip="${2:?--public-ip needs an address}"; shift 2 ;;
    --name) set_name="${2:?--name needs a value}"; shift 2 ;;
    --prefix) set_prefix="${2:?--prefix needs a value}"; shift 2 ;;
    --dir) dir="${2:?--dir needs a path}"; shift 2 ;;
    --engine) engine="${2:?--engine needs docker or podman}"; shift 2 ;;
    --wait) wait_level="${2:?--wait needs a level}"; shift 2 ;;
    --no-connect) connect=0; shift ;;
    --adopt) adopt=1; shift ;;
    -h|--help) die "options are listed by: docker run --rm <image> install --help" ;;
    *) die "unknown option '$1' (docker run --rm <image> install --help lists them)" ;;
  esac
done
case "$wait_level" in live|seeded|served|usable|none) ;; *) die "--wait must be live, seeded, served, usable or none" ;; esac

# A join token (`substrate-key join` on the hub) carries both join inputs: the endpoint the
# hub advertises and a key it issued, so a joiner types one value and no port.
#   sj1.<base64url of "<discovery endpoint>\n<api key>">
[ -n "$set_join" ] || set_join="${SUBSTRATE_JOIN:-}"
case "$set_join" in
  sj1.*)
    b="$(printf '%s' "${set_join#sj1.}" | tr '_-' '/+')"
    case $(( ${#b} % 4 )) in 2) b="$b==" ;; 3) b="$b=" ;; esac
    decoded="$(printf '%s' "$b" | base64 -d 2>/dev/null)" || die "the join token does not decode; copy it again from the hub"
    tok_ep="$(printf '%s\n' "$decoded" | sed -n 1p)"; tok_key="$(printf '%s\n' "$decoded" | sed -n 2p)"
    case "$tok_ep" in http://*|https://*) ;; *) die "the join token carries no discovery endpoint; ask the hub for a new one" ;; esac
    [ -n "$tok_key" ] || die "the join token carries no key; ask the hub for a new one"
    set_join="$tok_ep"; [ -n "$set_key" ] || set_key="$tok_key"
    ;;
  sj[0-9]*.*) die "this installer does not understand join token version '${set_join%%.*}'; pull a newer image" ;;
  ""|http://*|https://*) ;;
  *) die "--join takes the join token the hub issued (substrate-key join <name>) or a discovery URL (http://…)" ;;
esac

# Flags are spellings of manifest inputs; they win over the same input in the environment.
[ -n "$set_join" ] && DISCOVERY_ENDPOINT="$set_join" && export DISCOVERY_ENDPOINT
[ -n "$set_key" ] && METABOB_API_KEY="$set_key" && export METABOB_API_KEY
[ -n "$set_profile" ] && PROFILE="$set_profile" && export PROFILE
[ -n "$set_public_ip" ] && PUBLIC_IP="$set_public_ip" && export PUBLIC_IP
[ -n "$set_name" ] && SUBSTRATE_NAME="$set_name" && export SUBSTRATE_NAME
[ -n "$set_prefix" ] && SUBSTRATE_PORT_PREFIX="$set_prefix" && export SUBSTRATE_PORT_PREFIX

# ── Engine ─────────────────────────────────────────────────────────────────────
if [ -z "$engine" ]; then
  for e in docker podman; do
    if command -v "$e" >/dev/null 2>&1 && "$e" compose version >/dev/null 2>&1; then engine="$e"; break; fi
  done
  [ -n "$engine" ] || die "no container engine with compose found: install Docker with 'docker compose', or Podman with 'podman compose'"
fi
case "$engine" in docker|podman) ;; *) die "--engine must be docker or podman" ;; esac

# ── Fleet directory and .env ───────────────────────────────────────────────────
envval() { # value of $1 in ./.env, empty when absent
  [ -f .env ] || return 0
  sed -n "s/^$1=//p" .env | tail -1
}
name="${SUBSTRATE_NAME:-}"
# Run from inside a fleet directory (its manifest and .env are here) with no name or
# --dir, it is that fleet: re-running there is how it is updated.
if [ -z "$dir" ] && [ -z "$name" ] && [ -f .env ] \
   && head -1 docker-compose.yml 2>/dev/null | grep -q '^# Substrate launch manifest'; then
  dir=.
fi
[ -n "$dir" ] || dir="./${name:-substrate}"
start="$(pwd)"
mkdir -p "$dir"
cd "$dir"
# A refused new fleet leaves nothing behind (the directory is removed only while empty).
refuse() { cd "$start"; rmdir "$dir" 2>/dev/null || true; die "$@"; }
[ -n "$name" ] || name="$(envval SUBSTRATE_NAME)"
name="${name:-substrate}"
prefix="${SUBSTRATE_PORT_PREFIX:-$(envval SUBSTRATE_PORT_PREFIX)}"
prefix="${prefix:-18}"
container="${SUBSTRATE_CONTAINER:-$(envval SUBSTRATE_CONTAINER)}"
container="${container:-${name}-live}"

new_fleet=1
[ -f .env ] && [ -f docker-compose.yml ] && new_fleet=0

if [ "$new_fleet" = 1 ]; then
  # A new directory must not attach to a fleet that already owns these names or ports.
  if "$engine" container inspect "$container" >/dev/null 2>&1; then
    refuse "container $container already exists. To move it onto this manifest, stop it with a grace that covers the datastore flush ($engine stop -t 360 $container), remove it ($engine rm $container; its volumes stay), then re-run with --adopt"
  fi
  if [ "$adopt" = 1 ]; then
    "$engine" volume inspect "${name}-workspace" >/dev/null 2>&1 \
      && say "adopting the existing volumes ${name}-workspace and ${name}-surreal: their learning state, keys and secrets are kept" \
      || say "--adopt given, but there is no volume ${name}-workspace; installing fresh"
  elif "$engine" volume inspect "${name}-workspace" >/dev/null 2>&1; then
    refuse "a fleet named '$name' already exists on this host (container $container or volume ${name}-workspace). Update it from its own directory; re-run with --adopt to keep those volumes (a fleet launched another way); or pick another: --name <n> --prefix <nn> (19-32 avoid the ephemeral range)"
  fi
  busy=""
  if command -v ss >/dev/null 2>&1; then
    for p in 080 090 100 101 210 250 260 270 310 333; do
      ss -Hltn "sport = :${prefix}${p}" 2>/dev/null | grep -q . && busy="$busy ${prefix}${p}"
    done
    [ -z "$busy" ] || refuse "host port(s)$busy are already in use; choose another --prefix <nn>"
  else
    say "ss is not available, so host ports ${prefix}xxx were not checked before launch"
  fi
fi

# Rootless engines give every container's systemd session keyrings from this user's
# kernel key quota (kernel.keys.maxkeys, often 200: about 25 per fleet). When it runs
# out, a container fails to start with "unable to create session key: disk quota
# exceeded", which names neither keys nor the fix.
if [ -r /proc/key-users ] && [ -r /proc/sys/kernel/keys/maxkeys ] && [ "$(id -u)" != 0 ]; then
  used="$(awk -v u="$(id -u):" '$1 == u { split($4, a, "/"); print a[1] }' /proc/key-users)"
  max="$(cat /proc/sys/kernel/keys/maxkeys)"
  if [ -n "$used" ] && [ $((max - used)) -lt 40 ]; then
    say "this user holds $used of $max kernel keys; a new fleet needs about 25. If the launch fails with 'unable to create session key: disk quota exceeded', raise the limit: sudo sysctl -w kernel.keys.maxkeys=2000 kernel.keys.maxbytes=2000000"
  fi
fi

# Every container's systemd also holds inotify instances and watches from the host's
# per-user budget (fs.inotify.max_user_instances / max_user_watches). Exhausted, the next
# container's boot stalls in "initializing" with every unit waiting and the journal saying
# "inotify watch limit reached" / "No space left on device"; nothing names the limit.
if [ -r /proc/sys/fs/inotify/max_user_instances ] && [ "$(id -u)" != 0 ]; then
  inst_max="$(cat /proc/sys/fs/inotify/max_user_instances)"
  if [ "$inst_max" -lt 4096 ] 2>/dev/null; then
    say "fs.inotify.max_user_instances is $inst_max; several fleets on one host can exhaust it and a new one then never finishes booting. Raise it: sudo sysctl -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=2097152"
  fi
fi

# The manifest this image was built with (re-running rewrites it, which is how an
# image upgrade reaches the declaration).
cat > docker-compose.yml <<'SUBSTRATE_MANIFEST_EOF'
EOF

cat "$MANIFEST"

cat <<'EOF'
SUBSTRATE_MANIFEST_EOF

# Carry each install input set in this environment into .env, replacing its line.
umask 077
touch .env
carried=""
for n in $CARRY_NAMES; do
  eval "v=\${$n:-}"
  [ -n "$v" ] || continue
  case "$v" in *"
"*) die "$n contains a newline; .env cannot hold it" ;; esac
  grep -v "^$n=" .env > .env.tmp || true
  printf '%s=%s\n' "$n" "$v" >> .env.tmp
  mv .env.tmp .env
  carried="$carried $n"
done
chmod 600 .env
# A key under the wrong provider's name fails every model call with no hint why. Anthropic
# keys always start sk-ant-, so a recognisably different key in ANTHROPIC_API_KEY is named.
case "${ANTHROPIC_API_KEY:-sk-ant-}" in
  sk-ant-*) ;;
  sk-or-*) say "ANTHROPIC_API_KEY holds an OpenRouter key (sk-or-); pass it as OPENROUTER_API_KEY=… instead" ;;
  gsk_*)   say "ANTHROPIC_API_KEY holds a Groq key (gsk_); pass it as GROQ_API_KEY=… instead" ;;
  AIza*)   say "ANTHROPIC_API_KEY holds a Google key (AIza); pass it as GOOGLE_API_KEY=… instead" ;;
  cpk_*)   say "ANTHROPIC_API_KEY holds a Chutes key (cpk_); pass it as CHUTES_API_KEY=… instead" ;;
  sk-*)    say "ANTHROPIC_API_KEY holds what looks like an OpenAI-style key (sk-); pass it as OPENAI_API_KEY=… (with OPENAI_BASE_URL for a compatible service) instead" ;;
  *)       say "ANTHROPIC_API_KEY does not look like an Anthropic key (they start sk-ant-); if it belongs to another provider, pass it under that provider's name" ;;
esac
# A git token grants push capability, and the image refuses to boot a NEW fleet that has
# one without SUBSTRATE_REPO_OWNER naming whose repositories it may land on. The refusal
# happens inside the container, where it becomes a restart loop; say it here instead,
# before anything is launched. (A fleet whose volumes already hold an owner is exempt,
# as it is in the image.) A token exported in the shell for something else is carried
# like any other input, which is how this is usually met.
if [ -n "$(envval SUBSTRATE_GIT_PAT)" ] && [ -z "$(envval SUBSTRATE_REPO_OWNER)" ] \
   && ! "$engine" volume inspect "${name}-workspace" >/dev/null 2>&1; then
  refuse "SUBSTRATE_GIT_PAT is set (from your shell or .env) but SUBSTRATE_REPO_OWNER is not. The token lets this substrate push; the owner scopes it to whose repositories it lands on. Either pass SUBSTRATE_REPO_OWNER=<github owner> with the token, or drop the token: unset SUBSTRATE_GIT_PAT and remove its line from $(pwd)/.env"
fi
# Nothing ambient: any other manifest input reaches compose only through .env.
ignored=""
for n in $INPUT_NAMES; do
  case " $CARRY_NAMES " in *" $n "*) continue ;; esac
  eval "v=\${$n:-}"
  [ -n "$v" ] || continue
  grep -q "^$n=" .env || ignored="$ignored $n"
  unset "$n"
done
[ -z "$ignored" ] || say "ignored from your shell (advanced inputs are read from .env only; add them there to use them):$ignored"
say "fleet directory: $(pwd)  (inputs written:${carried:- none, defaults only})"

# ── Launch ─────────────────────────────────────────────────────────────────────
# An upgrade usually keeps the image's name and changes what it names (a newer :dev).
# Docker's compose recreates the container for that; Podman's does not (podman-compose
# 1.6 `up -d` after a retag leaves the old image running), so re-running would report
# success on the old code. Compare the image the container runs with the one the
# manifest names, and recreate when they differ.
recreate=""
# The compose project is the directory's name unless something says otherwise, and a fleet
# launched from a directory with another name (or with COMPOSE_PROJECT_NAME) carries its own
# project on the container. Running compose here under the directory's project then never
# matched that container: `up --force-recreate` recreated nothing and compose only started
# the stopped container again, still on the old image, while the installer reported the
# upgrade done (node 2, 2026-10-02: project compose2, directory node2). The container's own
# label names the project it belongs to, so every compose call below uses that one.
if [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
  _proj="$("$engine" container inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$container" 2>/dev/null || true)"
  case "$_proj" in ""|"<no value>") ;; *) export COMPOSE_PROJECT_NAME="$_proj" ;; esac
fi
if "$engine" container inspect "$container" >/dev/null 2>&1; then
  want_ref="$("$engine" compose config 2>/dev/null | sed -n 's/^ *image: *//p' | head -1 | tr -d "\"'")"
  want_id="$([ -n "$want_ref" ] && "$engine" image inspect -f '{{.Id}}' "$want_ref" 2>/dev/null || true)"
  have_id="$("$engine" container inspect -f '{{.Image}}' "$container" 2>/dev/null || true)"
  if [ -n "$want_id" ] && [ -n "$have_id" ] && [ "${want_id#sha256:}" != "${have_id#sha256:}" ]; then
    say "$container runs an older image than $want_ref; recreating it (volumes kept)"
    recreate="--force-recreate"
  fi
fi
"$engine" compose up -d $recreate || die "compose up failed; the manifest and .env are in $(pwd)"

if [ "$wait_level" = none ]; then
  say "launched $container; not waiting (check with: $engine exec $container substrate-status)"
  exit 0
fi

# ── Wait for a key, then hand the client its connection ───────────────────────
level_rank() { case "$1" in live) echo 1 ;; seeded) echo 2 ;; served) echo 3 ;; usable) echo 4 ;; esac; }
first_wait=seeded
[ "$(level_rank "$wait_level")" -lt 2 ] && first_wait="$wait_level"
if ! "$engine" exec "$container" substrate-status --wait "$first_wait"; then
  # A container that is not running cannot be asked anything (the exec fails with a bare
  # 409), so say what it is doing and show why, from its own boot log.
  state="$("$engine" container inspect -f '{{.State.Status}} restarts={{.RestartCount}}' "$container" 2>/dev/null || echo missing)"
  case "$state" in
    running\ restarts=0) ;;
    *)
      say "$container is not running steadily ($state). The last refusals in its log:"
      "$engine" logs --tail 200 "$container" 2>&1 | grep -E '^\[gen-env\] (ERROR|  )|^\[entrypoint\].*(ERROR|refus)' | tail -15 >&2 || true
      say "full log: $engine logs $container" ;;
  esac
  say "the verdict did not reach '$first_wait'; nothing else was done"
  exit 20
fi

if [ "$connect" = 1 ] && [ "$first_wait" = seeded ]; then
  # The client config's home is ~/.substrate/config.json; connect-merge keeps ~/.metabob/config.json as a
  # link to it for the cockpit. SUBSTRATE_CONFIG_PATH wins, then the retiring METABOB_CONFIG_PATH.
  target="${SUBSTRATE_CONFIG_PATH:-${METABOB_CONFIG_PATH:-}}"
  [ -n "$target" ] || { [ -n "${HOME:-}" ] && target="$HOME/.substrate/config.json"; }
  # The file that holds the config today: on a host not yet converged, that is still the old path.
  current="$target"
  [ -n "${HOME:-}" ] && [ "$target" = "$HOME/.substrate/config.json" ] && [ ! -e "$target" ] && [ -e "$HOME/.metabob/config.json" ] \
    && current="$HOME/.metabob/config.json"
  if [ -z "$target" ]; then
    say "HOME, SUBSTRATE_CONFIG_PATH and METABOB_CONFIG_PATH are unset; client configuration not written"
  elif "$engine" exec "$container" substrate-connect > metabob-config.json; then
    chmod 600 metabob-config.json
    ep="$(grep -o '"endpoint"[^,}]*' metabob-config.json | head -1)"
    if [ -f "$current" ] && ! grep -qF "$ep" "$current"; then
      # Never overwrite another fleet's client config: leave it, point at ours.
      say "$current already points at another fleet and was left as it is."
      say "to use this fleet: export METABOB_CONFIG_PATH=$(pwd)/metabob-config.json"
    else
      # Same fleet, or no file yet: MERGE this fleet's values into it ON THE HOST with the one merge
      # script (connect-merge.sh, printed by the image): the file never enters the container, only
      # the fleet's own values (--values) leave it; every other key is kept, and a refused merge
      # leaves the file byte-identical.
      if "$engine" exec "$container" substrate-connect --merge-script \
           | bash -s -- "$target" "$engine" exec "$container" substrate-connect --values; then
        say "client configuration merged into $target (its other keys kept)"
      else
        say "could not merge into $target; it was left as it is (this fleet's config: $(pwd)/metabob-config.json)"
      fi
    fi
  else
    say "substrate-connect refused; client configuration not written"
  fi
fi

if [ "$(level_rank "$wait_level")" -gt 2 ]; then
  if ! "$engine" exec "$container" substrate-status --wait "$wait_level"; then
    say "installed, but the verdict is short of '$wait_level' (the lines above name the failing level)"
    say "report it: $engine exec $container substrate-status --report"
    exit 20
  fi
fi
say "done: $container reached '$wait_level'. Human surface: http://localhost:${prefix}310/"
say "verdict any time: $engine exec $container substrate-status"
EOF
