#!/usr/bin/env bash
# deploy-analysis-backend.sh — the unit selection for the MINIMUM backend a
# metabob-mcp client attaches to: discovery + concept-db + analysis-vessel +
# activity-api, plus the store (surrealdb/valkey), the identity authority, and the
# seed/infra units those transitively require. Nothing else runs — no goal-host,
# llm-resolver, ribosome, boredom, obsidian, federation, autonomy loops.
#
# This is the "analysis-backend" composition: the surface a white-labelled
# metabob-mcp needs to serve code scanning (analysis-vessel) and the how/why-of-code
# knowledge graph (concept-db) to an agent, WITHOUT the substrate's self-development
# fleet. It is an ENABLED_VESSELS selection over the one image and the one launch
# manifest; it launches nothing of its own. Ports, volumes, names and credentials
# come from the manifest and the .env exactly as for any other node.
#
# USAGE
#   deploy-analysis-backend.sh                      print the selection as a .env line
#   deploy-analysis-backend.sh >> .env              add it to a node's install inputs,
#                                                   then follow README § Installation
#   deploy-analysis-backend.sh --env-file <f> [deploy.sh options] user@host
#                                                   deploy.sh with <f> plus the selection
#
# The selection is the only thing this script knows. A provider key, a name or a
# port prefix belongs in the .env; nothing is read from client config files.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The exact unit allow-list. ENABLED_VESSELS masks every manageable unit NOT named
# here, so the store/identity/seed/infra deps of the four target vessels must be
# listed explicitly. Keep this in sync with scripts/substrate/vessels.inventory.json;
# preview with `DRY_RUN=1 ENABLED_VESSELS=… apply-inventory` inside the image.
ENABLED_VESSELS="\
surrealdb.service,\
valkey.service,\
discovery-vessel.service,\
identity-vessel.service,\
activity-api.service,\
concept-db.service,\
analysis-vessel.service,\
bootstrap-seeder.service,\
identity-seeder.service,\
concept-db-seeder.service,\
substrate-ready.service,\
journald-stdout-forwarder.service"

if [ $# -eq 0 ]; then
  printf 'ENABLED_VESSELS=%s\n' "$ENABLED_VESSELS"
  exit 0
fi

# Remote: hand deploy.sh the caller's .env with the selection appended. An
# ENABLED_VESSELS already in that file is a conflicting selection, refused rather
# than silently overridden.
ENV_IN=""
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --env-file) ENV_IN="${2:-}"; shift 2 ;;
    --env-file=*) ENV_IN="${1#--env-file=}"; shift ;;
    *) args+=("$1"); shift ;;
  esac
done
if [ -z "$ENV_IN" ] || [ ! -r "$ENV_IN" ]; then
  echo "[analysis-backend] --env-file <file> is required for a remote deploy" >&2
  exit 2
fi
if grep -qE '^[[:space:]]*(export[[:space:]]+)?ENABLED_VESSELS=' "$ENV_IN"; then
  echo "[analysis-backend] $ENV_IN already sets ENABLED_VESSELS; remove it or deploy with deploy.sh directly" >&2
  exit 2
fi
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"
cat "$ENV_IN" > "$tmp"
printf '\nENABLED_VESSELS=%s\n' "$ENABLED_VESSELS" >> "$tmp"
"$HERE/deploy.sh" --env-file "$tmp" "${args[@]}"
