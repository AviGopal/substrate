#!/usr/bin/env bash
# substrate-config — show the substrate's RESOLVED configuration and where each
# value came from.
#
# WHY THIS EXISTS
#
# Nothing in this system could answer "did my -e value win, and if not, what
# beat it?". The obvious place to look is structurally incapable of answering:
# the entrypoint sources /etc/substrate/env into its own environment, so
# /proc/1/environ reports gen-env's OUTPUT back as if it were the operator's
# INPUT. A value that was silently overridden looks exactly like one that was
# honoured.
#
# That blind spot is the shape of most configuration bugs in this repo: the
# operator supplied something, it was discarded, and nothing said so. This
# command makes the discard visible.
#
# Reads /etc/substrate/env (the runtime authority) and /etc/substrate/env.provenance
# (written by gen-env at boot). Secrets are masked; --unmask is deliberate and
# must be typed.
#
# DUAL CONTEXT, same idiom as substrate-ready.sh / self-recovery-tick.sh: runs
# on the host (docker exec into $CONTAINER) or inside the container (direct).
set -uo pipefail

ENV_FILE="${ENV_FILE:-/etc/substrate/env}"
PROV_FILE="${PROV_FILE:-/etc/substrate/env.provenance}"
CONTAINER="${CONTAINER:-}"
UNMASK=0
FILTER=""
FORMAT="table"

usage() {
  cat <<'USAGE'
Usage: substrate-config [--container <name>] [--unmask] [--json] [FILTER]

  --container <name>  run against a container from the host (docker exec)
  --unmask            print secret values in full (default: masked to 6 chars)
  --json              machine-readable output
  FILTER              case-insensitive substring match on the variable name

Source column:
  env        operator-supplied (-e / compose / make) — your value won
  persisted  came from /workspace/.substrate-secrets (a PREVIOUS boot's value)
  generated  minted this boot
  derived    computed from another value
  hardcoded  a literal in gen-env.sh — NOT settable (see: it ignores your input)

Examples:
  substrate-config                    # everything
  substrate-config LLM                # just the LLM-related knobs
  substrate-config --container substrate-live VLLM
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --container) CONTAINER="${2:-}"; shift 2 ;;
    --unmask)    UNMASK=1; shift ;;
    --json)      FORMAT=json; shift ;;
    -h|--help)   usage; exit 0 ;;
    *)           FILTER="$1"; shift ;;
  esac
done

# Read a file either directly or through the container.
rf() {
  if [ -n "$CONTAINER" ]; then docker exec "$CONTAINER" cat "$1" 2>/dev/null
  else cat "$1" 2>/dev/null; fi
}

ENV_TXT="$(rf "$ENV_FILE")"
if [ -z "$ENV_TXT" ]; then
  echo "substrate-config: cannot read $ENV_FILE${CONTAINER:+ in container '$CONTAINER'}" >&2
  echo "  Is the substrate running? Try: docker ps --filter name=substrate" >&2
  exit 1
fi
PROV_TXT="$(rf "$PROV_FILE")"
if [ -z "$PROV_TXT" ]; then
  echo "substrate-config: NOTE — $PROV_FILE is absent." >&2
  echo "  This container booted before provenance tracking existed; sources will read 'unknown'." >&2
  echo "  Recreate it to populate them (learning state lives in volumes and survives)." >&2
fi

# A name is secret-shaped if it looks like a credential OR its value carries a
# known credential prefix. The second rule catches a secret under a name the
# first would miss — the same two-rule idiom ui-only-up.sh uses for redaction.
is_secret() {
  case "$1" in *KEY*|*SECRET*|*PASS*|*TOKEN*|*PAT*) return 0 ;; esac
  case "$2" in sk-*|mb-*|gho_*|ghp_*|github_pat_*) return 0 ;; esac
  return 1
}

mask() {
  local v="$1"
  [ -z "$v" ] && { printf '%s' "(empty)"; return; }
  [ "$UNMASK" = 1 ] && { printf '%s' "$v"; return; }
  printf '%.6s… (%d chars)' "$v" "${#v}"
}

prov_of() {
  printf '%s\n' "$PROV_TXT" | sed -n "s/^$1=//p" | head -1
}

if [ "$FORMAT" = json ]; then printf '{\n'; first=1; fi
rows=0

while IFS= read -r line; do
  case "$line" in ''|\#*) continue ;; esac
  case "$line" in *=*) ;; *) continue ;; esac
  name="${line%%=*}"
  val="${line#*=}"
  case "$name" in [A-Za-z_]*) ;; *) continue ;; esac
  if [ -n "$FILTER" ]; then
    printf '%s' "$name" | grep -qi -- "$FILTER" || continue
  fi
  # Strip one layer of surrounding quotes — gen-env writes VAR="value".
  case "$val" in
    \"*\") val="${val#\"}"; val="${val%\"}" ;;
    \'*\') val="${val#\'}"; val="${val%\'}" ;;
  esac
  src="$(prov_of "$name")"
  if [ -z "$src" ]; then
    # No provenance ENTRY means a literal. No provenance FILE means we simply do
    # not know — reporting that as "hardcoded" would be the same confident-wrong
    # answer this tool exists to eliminate.
    if [ -n "$PROV_TXT" ]; then src="hardcoded"; else src="unknown"; fi
  fi
  if is_secret "$name" "$val"; then shown="$(mask "$val")"; else
    [ -z "$val" ] && shown="(empty)" || shown="$val"
  fi
  rows=$((rows + 1))
  if [ "$FORMAT" = json ]; then
    [ "$first" = 0 ] && printf ',\n'; first=0
    printf '  "%s": {"source": "%s", "value": "%s"}' "$name" "$src" "$(printf '%s' "$shown" | sed 's/"/\\"/g')"
  else
    printf '%-34s %-10s %s\n' "$name" "$src" "$shown"
  fi
done <<EOF
$ENV_TXT
EOF

if [ "$FORMAT" = json ]; then printf '\n}\n'; exit 0; fi

if [ "$rows" = 0 ]; then
  echo "no variables matched${FILTER:+ filter '$FILTER'}"
  exit 0
fi

echo
echo "$rows variable(s). Secrets masked; --unmask to reveal."
echo "A 'hardcoded' source means gen-env.sh writes a literal — setting it has NO effect."
