#!/usr/bin/env bash
# self-recovery-tick.sh — the substrate's immune system.
#
# With every human-in-the-loop gate dropped (autonomous author->verify->stage->
# land), the thing that keeps "remaining becoming" true is the ability to detect
# and UNDO a change that broke the substrate. This tick does that:
#
#   for each vessel: health-check (in-container)
#     unhealthy -> restart (recover a transient crash) -> re-check
#       still unhealthy -> revert /vessels/<v>/src from the in-container git
#         clone (last-good pin at /workspace/.last-good/<v> when recorded,
#         else clone dev HEAD) + restart -> re-check
#         still unhealthy -> escalate (emit a substrateGap)
#
# feature_compose already rolls back UNFAVORABLE at author-time (typecheck); this
# is the RUNTIME tier: a typecheck-clean change that breaks at runtime gets
# reverted to the last-good GIT source (never a host checkout — the substrate
# does not rely on a host workspace). Read-only otherwise; never throws.
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
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"

# Change-window (2026-07-09 contiguous-shape-flow §5): while a change-set holds
# the change_window lease, a vessel mid-cutover is ALLOWED to look broken; a
# restart/revert here would fight the cutover. Defer the whole recovery pass
# (lease is TTL-bounded; next tick recovers normally after release/expiry).
CW_HELD="$(curl -s --max-time 5 -X POST "$DEV_VESSEL/v2/impulses/resolve" \
  -H 'Content-Type: application/json' \
  -d '{"impulse":{"type":"maintenanceLease","name":"change_window"}}' 2>/dev/null \
  | grep -o '"held":true' || true)"
if [ -n "$CW_HELD" ]; then
  echo "[self-recovery $(date -Iseconds)] change_window lease held — deferring recovery pass"
  exit 0
fi

# Context detection: in-container iff there is no working docker CLI for $CONTAINER.
if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  IN_CONTAINER=0
else
  IN_CONTAINER=1
fi
# Run a shell command in the container's context (directly in-container, else via docker).
csh()  { if [ "$IN_CONTAINER" = 1 ]; then sh -c "$1"; else docker exec "$CONTAINER" sh -c "$1"; fi; }
csys() { if [ "$IN_CONTAINER" = 1 ]; then systemctl "$@"; else docker exec "$CONTAINER" systemctl "$@"; fi; }
# Revert a vessel's /vessels/<name>/src from the IN-CONTAINER git clone
# (/workspace/git/vessels/<name>): the last-good pin recorded by pull-sync/
# cutover at /workspace/.last-good/<name> when present, else the clone's
# current dev HEAD. Git is the revert source — never a host checkout (the
# substrate must not rely on a host workspace, 2026-07-02). Exit 1 = no clone.
crevert() {
  local name="$1"
  csh "CLONE=/workspace/git/vessels/$name; [ -d \"\$CLONE/.git\" ] || exit 1; \
PIN=\$(cat /workspace/.last-good/$name 2>/dev/null || true); \
if [ -n \"\$PIN\" ]; then git -C \"\$CLONE\" checkout -q \"\$PIN\" -- . 2>/dev/null || true; fi; \
rm -rf /vessels/$name/src && cp -r \"\$CLONE/src\" /vessels/$name/src; rc=\$?; \
if [ -n \"\$PIN\" ]; then git -C \"\$CLONE\" reset --hard -q HEAD 2>/dev/null || true; fi; \
exit \$rc"
}

# vessel:in-container-health-port — DERIVED at runtime from the fleet files
# (inventory: every .service with a repo + health_port; manifest: entries with
# self_recovery:true + health_port). Install/uninstall no longer mutates this
# script (the old awk-append path is gone); membership is read where it is
# declared. Fallback list = the historical hardcoded set, used only when no
# fleet file is readable in this context.
fleet_vessels() {
  csh 'for f in /workspace/substrate/fleet/vessels.inventory.json /usr/local/share/substrate/vessels.inventory.json; do
         [ -f "$f" ] || continue
         jq -r ".vessels[] | select(.repo != null and (.unit | endswith(\".service\")) and .health_port != null and ((.manifest // false) | not)) | (.unit | sub(\"\\\\.service$\"; \"\")) + \":\" + (.health_port | tostring)" "$f"
         break
       done
       for f in /workspace/substrate/fleet/vessels.manifest.json /usr/local/share/substrate/vessels.manifest.json; do
         [ -f "$f" ] || continue
         jq -r ".vessels[] | select((.self_recovery // false) and .health_port != null) | .name + \":\" + (.health_port | tostring)" "$f"
         break
       done' 2>/dev/null | sort -u
}
VESSELS=()
while IFS= read -r line; do [ -n "$line" ] && VESSELS+=("$line"); done < <(fleet_vessels)
if [ "${#VESSELS[@]}" -eq 0 ]; then
  VESSELS=(
    "activity-api:8080" "development-vessel:8090" "goal-host-vessel:8210"
    "concept-db:8260" "relevance-sink-vessel:8255" "llm-resolver-vessel:8220"
    "federation-transport-vessel:8401"
  )
fi

log() { echo "[self-recovery $(date -Iseconds)] $*" >&2; }
healthy() { # vessel-name port -> 0 if /health returns 200 within the probe budget.
  # Require CONSECUTIVE probe failures before declaring a vessel dead: under DB
  # thrash / load spikes a single 200-but-slow response used to time out and
  # trigger a fleet-wide restart cascade (restarts interrupt dispatches, which
  # requeue and amplify the very load that slowed the probe). Three probes,
  # 10s budget each, 5s apart — a genuinely-down vessel still restarts within
  # the same tick; a merely-slow one gets the benefit of the doubt.
  local tries=3 i
  for i in $(seq 1 $tries); do
    if csh "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:$2/health 2>/dev/null" 2>/dev/null | grep -q 200; then return 0; fi
    [ "$i" -lt "$tries" ] && sleep 5
  done
  return 1
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
  # Still down: revert a bad staged change from the in-container git clone
  # (last-good pin when recorded, else clone dev HEAD).
  if crevert "$name"; then
    log "still down — reverted $name /vessels/src from git clone (last-good pin if recorded)"
    csys restart "$name.service" >/dev/null 2>&1 || true
    sleep 6
    if healthy "$name" "$port"; then log "RECOVERED $name via revert-from-git"; reverted=$((reverted+1)); continue; fi
  fi
  log "ESCALATE: $name still unhealthy after restart+revert"
  escalated=$((escalated+1))
  emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"self-recovery-failed-$name\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$name unhealthy and NOT recovered by restart+revert-from-git — needs deeper repair\",\"status\":\"open\"}}}}"
done
echo "{\"healthy\":$healthy_n,\"recovered_by_restart\":$recovered,\"reverted_from_git\":$reverted,\"escalated\":$escalated}"
