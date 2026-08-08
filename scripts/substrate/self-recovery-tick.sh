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
# Shared-DB liveness probe target + budgets (see db_under_pressure below). The
# whole fleet's DB-backed vessels share ONE SurrealDB; when it saturates, every
# one of their /health checks times out at once — restarting them can't fix the
# DB and only piles on startup load, so we detect DB pressure and back off.
SURREAL_URL="${SURREALDB_URL:-http://127.0.0.1:8000}"
DB_PROBE_TIMEOUT="${DB_PROBE_TIMEOUT:-5}"   # per-probe budget (s) for the cheap RETURN 1 liveness check
DB_PROBE_GAP="${DB_PROBE_GAP:-3}"           # seconds between the two consecutive probes
# Sustained-wedge escalation (2026-07-31 outage): the DB-pressure guard below
# correctly BACKS OFF restarting vessels when SurrealDB is the bottleneck — but
# nothing restarted SurrealDB itself, so a wedge persisted for hours. Root: the
# unit's MemoryHigh=22G throttle/reclaim zone makes surreal unresponsive
# (http=000, RocksDB "transaction dropped") WITHOUT ever hitting MemoryMax=26G,
# so the intended "OOM-kill -> self-restart" safety never fires. Escalate: after
# N CONSECUTIVE pressured ticks (a sustained wedge, not a transient heavy-query
# spike), restart surrealdb — the same graceful restart an operator would do
# (reloads the durable file: RocksDB WAL, no data loss). Streak persists in a
# container-writable file (via csh, so it lands in-container from either context).
SURREAL_RESTART_THRESHOLD="${SURREAL_RESTART_THRESHOLD:-2}"     # consecutive pressured ticks (×~3min timer) before restart
PRESSURE_STREAK_FILE="${PRESSURE_STREAK_FILE:-/workspace/.surreal-pressure-streak}"

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
# Role-awareness (2026-07-30): a unit is intentionally-disabled for the active
# ENABLED_ROLES iff apply-inventory.sh masked it — an /etc-level symlink
# /etc/systemd/system/<unit> -> /dev/null (apply-inventory.sh). Read that same
# mask (the ground truth boot just wrote) in the container's context; more robust
# than re-deriving ENABLED_ROLES here.
masked() { [ "$(csh "readlink /etc/systemd/system/$1 2>/dev/null" 2>/dev/null)" = "/dev/null" ]; }
# Never installed (2026-08-08): a MANIFEST vessel's real unit is written to
# /etc/systemd/system by `vessel-ctl install`, after readiness. Before that runs
# the only unit by that name is the one baked into the image, whose
# WorkingDirectory (/vessels/<v>) does not exist for a manifest vessel — it is
# not shipped there. Starting it fails at CHDIR, forever.
#
# THIS WAS A BOOTSTRAP DEADLOCK, observed on a clean UI-only spoke: apply-
# inventory does not mask manifest entries (by design — it never selects them
# either), so nothing stopped this tick from "recovering" the baked unit. It
# restart-looped it, readiness counted it down, `make up` exited non-zero, and
# the launcher aborted BEFORE the install step that would have written the
# correct unit. The immune system was holding the door shut on the cure.
#
# A manifest vessel with no rendered unit has not been installed yet. That is a
# state to wait through, not a fault to repair.
manifest_vessel() {
  csh "for f in /workspace/substrate/fleet/vessels.manifest.json /usr/local/share/substrate/vessels.manifest.json; do
         [ -f \"\$f\" ] || continue
         jq -e --arg n '$1' 'any(.vessels[]; .name == \$n)' \"\$f\" >/dev/null 2>&1 && echo yes
         break
       done" 2>/dev/null | grep -q yes
}
not_installed() { ! csh "[ -f /etc/systemd/system/$1.service ]" 2>/dev/null; }
# Still inside its own start phase (2026-08-03): a unit running ExecStartPre/
# ExecStartPost — DB migrations, template seeding — is not yet serving /health,
# so probing it reads as death. Restarting then aborts the start work and the
# next tick finds it starting again: observed on the hub as activity-api
# restarted mid-migration, each restart replaying ~2min of schema work with the
# trace store down and every spoke spooling. systemd already bounds this with
# TimeoutStartSec; let that bound apply instead of pre-empting it.
starting() { [ "$(csys show "$1" -p ActiveState --value 2>/dev/null)" = "activating" ]; }
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
# Consecutive-pressured-tick streak (see SURREAL_RESTART_THRESHOLD above). Read/
# write via csh so the file lands in the container from host OR in-container.
streak_get() { csh "cat $PRESSURE_STREAK_FILE 2>/dev/null || echo 0" 2>/dev/null | tr -dc '0-9' | head -c 6; }
streak_set() { csh "printf '%s' '$1' > $PRESSURE_STREAK_FILE 2>/dev/null" 2>/dev/null || true; }
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

# Shared-DB pressure guard (2026-07-23 resource-cascade gap). Root: the fleet's
# DB-backed vessels share ONE SurrealDB. When it saturates/throttles, activity-
# api's /health (a SurrealDB round-trip) times out -> 503 -> this tick restarts
# it -> init crash-loops on 'SurrealDB not ready, retrying N/40' against the
# still-throttled DB, and while it is down every vessel ConnectionRefuses to
# :8080 and retry-storms -> the restart AMPLIFIES the very pressure it can't fix.
# So before restarting an unhealthy vessel, rule out "the shared DB is the
# bottleneck": a cheap RETURN 1 (loads NO table — same idiom as substrate-
# doctor.sh:46; proven live to time out during a real 28GiB saturation event
# while healthy it answers in ~1s) probed twice. Two consecutive timeouts/5xx
# => DB is the bottleneck, back off (no restart). A prompt answer — 2xx, OR even
# a fast auth/4xx (HTTP server answered => DB process alive) — => NOT the
# bottleneck, so a genuinely-dead vessel still restarts. Fail SAFE toward
# "restart normally": a broken/empty-cred probe returns a fast 4xx and does NOT
# suppress recovery.
db_under_pressure() {
  local i out
  for i in 1 2; do
    out=$(csh "P=\$(grep -m1 '^SURREALDB_PASSWORD=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); \
NS=\$(grep -m1 '^SURREALDB_NAMESPACE=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); \
DB=\$(grep -m1 '^SURREALDB_DATABASE=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); \
curl -s -o /dev/null -w '%{http_code}' --max-time $DB_PROBE_TIMEOUT -u \"root:\$P\" \
  -X POST $SURREAL_URL/sql -H 'Accept: application/json' \
  -H \"surreal-ns: \${NS:-activity-system}\" -H \"surreal-db: \${DB:-learning_loop}\" \
  -d 'RETURN 1;' 2>/dev/null" 2>/dev/null)
    case "$out" in
      2*|4*) return 1 ;;   # server answered promptly (2xx, or fast auth/4xx) -> DB alive, NOT the bottleneck
    esac
    [ "$i" -lt 2 ] && sleep "$DB_PROBE_GAP"
  done
  return 0                 # two consecutive timeouts / 000 / 5xx -> shared DB IS the bottleneck
}
# Memoize the verdict for the tick so we probe the DB at most once (and only
# lazily, the first time a vessel is found unhealthy).
DB_PRESSURE_CHECKED=0; DB_PRESSURE=0
db_is_bottleneck() {
  if [ "$DB_PRESSURE_CHECKED" = 0 ]; then
    if db_under_pressure; then DB_PRESSURE=1; else DB_PRESSURE=0; fi
    DB_PRESSURE_CHECKED=1
  fi
  [ "$DB_PRESSURE" = 1 ]
}

recovered=0; reverted=0; escalated=0; healthy_n=0; db_backoff=0; masked_skipped=0; starting_skipped=0; uninstalled_skipped=0
for entry in "${VESSELS[@]}"; do
  name="${entry%%:*}"; port="${entry##*:}"
  # Skip units apply-inventory masked for the active role: they are intentionally
  # down, so probing fails, restart is a no-op (unit masked), revert rewrites
  # /vessels/<v>/src every tick, and each pass escalates a bogus substrateGap.
  if masked "$name.service"; then masked_skipped=$((masked_skipped+1)); continue; fi
  # A manifest vessel that has never been installed — see not_installed().
  if manifest_vessel "$name" && not_installed "$name"; then
    log "NOT INSTALLED: $name (:$port) — manifest vessel with no rendered unit; waiting for vessel-ctl install, not restarting the baked one"
    uninstalled_skipped=$((uninstalled_skipped+1)); continue
  fi
  # Give a unit its own start phase before judging it dead — see starting().
  if starting "$name.service"; then
    log "STARTING: $name (:$port) — still in its start phase; deferring to TimeoutStartSec (no restart this tick)"
    starting_skipped=$((starting_skipped+1)); continue
  fi
  if healthy "$name" "$port"; then healthy_n=$((healthy_n+1)); continue; fi
  # Shared-DB pressure guard: if SurrealDB (the shared dependency) is the
  # bottleneck, restarting this vessel can't fix it and amplifies the load —
  # back off. Only reached AFTER a health failure, so a healthy DB with a
  # genuinely-dead vessel still falls through to the restart path below.
  if db_is_bottleneck; then
    log "UNHEALTHY: $name (:$port) — shared SurrealDB is the bottleneck; BACKING OFF (no restart/revert this tick)"
    db_backoff=$((db_backoff+1))
    continue
  fi
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
# When we backed off because the shared DB was the bottleneck, emit ONE
# db_contention gap (not per-vessel service_failure gaps — those would be a
# misdiagnosis: the vessels aren't broken, the DB is) so the real problem is
# surfaced for repair. The next tick recovers vessels normally once the DB
# probe answers promptly again.
# When we backed off because the shared DB was the bottleneck, track a
# consecutive-pressured-tick streak. A SUSTAINED wedge (>= threshold ticks) means
# surreal is stuck in the MemoryHigh throttle zone and will NOT self-restart —
# escalate to a graceful `systemctl restart surrealdb` (durable file: storage,
# WAL crash-consistent, no data loss). A single pressured tick is left alone (a
# transient heavy-query spike self-clears). Emit the db_contention gap either way
# so the underlying cause (unbounded trace table -> RocksDB working set) is still
# surfaced for a durable retention fix.
surreal_restarted=0
if [ "$db_backoff" -gt 0 ]; then
  streak="$(streak_get)"; [ -n "$streak" ] || streak=0; streak=$((streak + 1))
  if [ "$streak" -ge "$SURREAL_RESTART_THRESHOLD" ]; then
    log "SURREAL WEDGE: DB bottlenecked for $streak consecutive ticks (>= $SURREAL_RESTART_THRESHOLD) — restarting surrealdb.service (throttle-zone wedge never self-restarts)"
    csys restart surrealdb.service >/dev/null 2>&1 || true
    surreal_restarted=1
    streak_set 0
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"self-recovery-surreal-wedge-restart\",\"category\":\"db_contention\",\"source\":\"substrate_detected\",\"summary\":\"self-recovery RESTARTED surrealdb after $streak consecutive ticks of a cheap RETURN 1 liveness probe timing out — the shared datastore was wedged in the MemoryHigh throttle zone (unresponsive without an OOM-kill, so it never self-restarted). Durable fix needed: bound the activity_execution_traces working set (retention) so the RocksDB footprint stays under the block-cache cap.\",\"status\":\"open\"}}}}"
  else
    streak_set "$streak"
    log "shared-DB pressure: deferred restart/revert of $db_backoff vessel(s) this tick (consecutive pressured ticks: $streak/$SURREAL_RESTART_THRESHOLD) — emitting db_contention gap"
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"self-recovery-db-pressure-backoff\",\"category\":\"db_contention\",\"source\":\"substrate_detected\",\"summary\":\"self-recovery backed off restarting $db_backoff DB-backed vessel(s): shared SurrealDB was unresponsive to a cheap RETURN 1 liveness probe — the shared datastore is the bottleneck, not the vessels; restarting them would amplify load\",\"status\":\"open\"}}}}"
  fi
else
  streak_set 0
fi
echo "{\"healthy\":$healthy_n,\"recovered_by_restart\":$recovered,\"reverted_from_git\":$reverted,\"escalated\":$escalated,\"db_pressure_backoff\":$db_backoff,\"surreal_restarted\":$surreal_restarted,\"masked_skipped\":$masked_skipped,\"starting_skipped\":$starting_skipped,\"uninstalled_skipped\":$uninstalled_skipped}"
