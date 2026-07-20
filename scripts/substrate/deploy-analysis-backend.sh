#!/usr/bin/env bash
# deploy-analysis-backend.sh — stand up the MINIMUM backend a metabob-mcp client
# attaches to: discovery + concept-db + analysis-vessel + activity-api, plus the
# store (surrealdb/valkey), the identity authority, and the seed/infra units those
# transitively require. Nothing else runs — no goal-host, llm-resolver, ribosome,
# boredom, obsidian, federation, autonomy loops.
#
# This is the "analysis-backend" profile: the surface a white-labelled metabob-mcp
# needs to serve code scanning (analysis-vessel) and the how/why-of-code knowledge
# graph (concept-db) to an agent, WITHOUT the substrate's self-development fleet.
#
# It reuses the same image the full substrate builds (metabob/substrate:dev); the
# subset is selected at boot by ENABLED_VESSELS (see apply-inventory.sh). No new
# image, no role-tag changes — existing hub/spoke/full deploys are unaffected.
#
# Usage (local):
#   ANTHROPIC_API_KEY=sk-ant-...  bash deploy-analysis-backend.sh
#   NAME=analysis-backend  bash deploy-analysis-backend.sh      # custom container name
#
# Assumes `make -C scripts/substrate build` has produced metabob/substrate:dev.
# Host ports follow the 18xxx→8xxx convention so an existing ~/.metabob/config.json
# pointing at http://localhost:18080 keeps working.
set -euo pipefail

NAME="${NAME:-analysis-backend}"
IMAGE="${IMAGE:-metabob/substrate:dev}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(jq -r '.providers.anthropic.apiKey // empty' "$HOME/.metabob/config.json" 2>/dev/null || true)}"

# The exact unit allow-list. ENABLED_VESSELS masks every manageable unit NOT named
# here, so the store/identity/seed/infra deps of the four target vessels must be
# listed explicitly. Keep this in sync with scripts/substrate/vessels.inventory.json.
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

echo "[analysis-backend] starting subset: $ENABLED_VESSELS" | tr ',' ' '

docker volume create "${NAME}-surreal"    >/dev/null 2>&1 || true
docker volume create "${NAME}-workspace"  >/dev/null 2>&1 || true
docker rm -f "$NAME" >/dev/null 2>&1 || true

docker run -d --name "$NAME" --privileged \
  ${ANTHROPIC_API_KEY:+-e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"} \
  -e ENABLED_VESSELS="$ENABLED_VESSELS" \
  -p 18080:8080 -p 18100:8100 -p 18101:8101 -p 18250:8250 -p 18260:8260 \
  -v "${NAME}-workspace":/workspace -v "${NAME}-surreal":/var/lib/surrealdb \
  --tmpfs /run --tmpfs /run/lock "$IMAGE"

echo "[analysis-backend] waiting for discovery + activity-api…"
for i in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:18100/health" 2>/dev/null && break; sleep 3
done

echo "[analysis-backend] === status ==="
for pair in "discovery:18100" "activity-api:18080" "identity:18101" "analysis-vessel:18250" "concept-db:18260"; do
  name="${pair%%:*}"; port="${pair##*:}"
  printf '[analysis-backend] %-16s ' "$name:"
  curl -s "http://localhost:${port}/health" 2>/dev/null | head -c 100 || echo "(no /health)"; echo
done
echo "[analysis-backend] DONE. Point metabob-mcp's backend at http://localhost:18080 (discovery derives :18100)."
