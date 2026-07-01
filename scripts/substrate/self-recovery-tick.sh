#!/usr/bin/env bash
# self-recovery-tick.sh — the substrate's immune system.
#
# With every human-in-the-loop gate dropped (autonomous author->verify->stage->
# land), the thing that keeps "remaining becoming" true is the ability to detect
# and UNDO a change that broke the substrate. This tick does that:
#
#   for each vessel: health-check (in-container)
#     unhealthy -> restart (recover a transient crash) -> re-check
#       still unhealthy + hot-syncable -> re-sync from host last-good (reverts a
#         bad STAGED change in /vessels) + restart -> re-check
#         still unhealthy -> escalate (emit a substrateGap)
#
# feature_compose already rolls back UNFAVORABLE at author-time (typecheck); this
# is the RUNTIME tier: a typecheck-clean change that breaks at runtime gets
# reverted to the last-good host source. Read-only otherwise; never throws.
#
# DUAL CONTEXT (fix 2026-07-01): this script may run FROM the host (docker CLI
# available) OR INSIDE the container (deployed as a systemd unit — NO docker CLI).
# The body previously used `docker exec "$CONTAINER"` unconditionally, so when it
# ran in-container EVERY docker call failed silently: healthy() always returned
# non-200 -> ALL vessels judged unhealthy -> restart/revert were no-ops (docker
# missing) -> hundreds of false ESCALATE gaps flooding the gap store (and polluting
# gap-compose's backlog). Detect the context once and run each op directly when
# in-container; keep the docker-hop when invoked from the host.
set -uo pipefail
CONTAINER="${CONTAINER:-substrate-live}"
MAKE_DIR="${MAKE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"

# Context detection: in-container iff there is no working docker CLI for $CONTAINER.
if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  IN_CONTAINER=0
else
  IN_CONTAINER=1
fi
# Run a shell command in the container's context (directly in-container, else via docker).
csh()  { if [ "$IN_CONTAINER" = 1 ]; then sh -c "$1"; else docker exec "$CONTAINER" sh -c "$1"; fi; }
csys() { if [ "$IN_CONTAINER" = 1 ]; then systemctl "$@"; else docker exec "$CONTAINER" systemctl "$@"; fi; }
# Revert a vessel's /vessels/<name>/src to last-good host source (present in-container
# at $HOST_SRC because the repo is bind-mounted at SUBSTRATE_ROOT).
crevert() {
  local name="$1" src="$2"
  if [ "$IN_CONTAINER" = 1 ]; then
    rm -rf "/vessels/$name/src" 2>/dev/null || true
    cp -r "$src" "/vessels/$name/src" 2>/dev/null || true
  else
    docker exec "$CONTAINER" sh -c "rm -rf /vessels/$name/src" 2>/dev/null || true
    docker cp "$src" "$CONTAINER:/vessels/$name/src" >/dev/null 2>&1 || true
  fi
}

# vessel:in-container-health-port. Hot-syncable ones can be reverted from host.
VESSELS=(
  "activity-api:8080" "development-vessel:8090" "goal-host-vessel:8210"
  "concept-db:8260" "relevance-sink-vessel:8255" "llm-resolver-vessel:8220"
  "federation-transport-vessel:8401"
)
HOT="concept-db development-vessel goal-host-vessel llm-resolver-vessel local-tools-vessel ribosome-vessel relevance-sink-vessel analysis-vessel"

log() { echo "[self-recovery $(date -Iseconds)] $*" >&2; }
healthy() { # vessel-name port -> 0 if /health returns 200
  csh "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:$2/health 2>/dev/null" 2>/dev/null | grep -q 200
}
emit_gap() {
  csh "curl -s --max-time 8 -X POST $DEV_VESSEL/v2/impulses/resolve -H 'Content-Type: application/json' -d '$1'" >/dev/null 2>&1 || true
}

recovered=0; reverted=0; escalated=0; healthy_n=0
for entry in "${VESSELS[@]}"; do
  name="${entry%%:*}"; port="${entry##*:}"
  if healthy "$name" "$port"; then healthy_n=$((healthy_n+1)); continue; fi
  log "UNHEALTHY: $name (:$port) — restarting"
  csys restart "$name.service" >/dev/null 2>&1 || true
  sleep 6
  if healthy "$name" "$port"; then log "recovered $name via restart"; recovered=$((recovered+1)); continue; fi
  # Still down: revert a bad staged change by re-syncing last-good host source.
  HOST_SRC="$MAKE_DIR/../../repos/$name/src"
  if [ -d "$HOST_SRC" ]; then
    log "still down — reverting $name /vessels/src to last-good host source"
    crevert "$name" "$HOST_SRC"
    csys restart "$name.service" >/dev/null 2>&1 || true
    sleep 6
    if healthy "$name" "$port"; then log "RECOVERED $name via revert-to-host"; reverted=$((reverted+1)); continue; fi
  fi
  log "ESCALATE: $name still unhealthy after restart+revert"
  escalated=$((escalated+1))
  emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"self-recovery-failed-$name\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$name unhealthy and NOT recovered by restart+revert-to-host — needs deeper repair\",\"status\":\"open\"}}}}"
done
echo "{\"healthy\":$healthy_n,\"recovered_by_restart\":$recovered,\"reverted_to_host\":$reverted,\"escalated\":$escalated}"
