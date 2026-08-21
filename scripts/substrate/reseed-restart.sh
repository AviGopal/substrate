#!/usr/bin/env bash
# reseed-restart.sh — run the identity seeder and, iff it minted a NEW
# METABOB_API_KEY, restart the vessels that loaded the old one.
#
# ExecStart of identity-seeder.service (in-container, boot path). Fixes the
# seed-key-without-restart wart: seed-identity.ts rewrites METABOB_API_KEY in
# /etc/substrate/env, but vessels started with the bootstrap key keep it until
# restarted. The unit's OWN environment still holds the PRE-seed value (systemd
# loaded it before ExecStart), so the file-vs-env diff detects a mint exactly.
#
# On warm volumes seed-identity 409-skips and the key never changes -> no
# restarts (this guard is what prevents a restart storm on every boot).
set -uo pipefail

ENV_FILE=/etc/substrate/env
INV="${VESSELS_INVENTORY:-/workspace/substrate/fleet/vessels.inventory.json}"
[ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json
PRE_KEY="${METABOB_API_KEY:-}"

log() { echo "[identity-seeder] $*"; }

# Retry loop: identity-vessel answers /health before its SurrealDB connection
# is up (warm datastores open slowly), so early seed calls 500 with
# PERSIST_FAILED (observed 2026-07-02 recreate). Transient by nature — retry.
SEED_OK=0
for attempt in $(seq 1 10); do
  if /root/.bun/bin/bun /vessels/seed-identity.ts; then SEED_OK=1; break; fi
  log "seed-identity attempt $attempt failed — retrying in 6s (identity-vessel DB likely still warming)"
  # identity-vessel has NO reconnect logic: if its initial SurrealDB connect
  # lost the race it stays disconnected forever (PERSIST_FAILED on every call)
  # and no amount of seeder retries helps. Kick it once mid-retry — a fresh
  # start connects fine once surrealdb is actually up (observed on both the
  # local and hub recreates, 2026-07-02). Durable fix = reconnect logic in
  # identity-vessel itself (queued substrate gap).
  if [ "$attempt" = 5 ]; then
    log "restarting identity-vessel (known no-reconnect defect) before further retries"
    systemctl restart identity-vessel 2>/dev/null || true
    sleep 8
  fi
  sleep 6
done
if [ "$SEED_OK" != 1 ]; then
  log "seed-identity failed after 10 attempts — leaving fleet as-is"
  exit 1
fi

POST_KEY="$(grep -m1 '^METABOB_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
if [ -z "$POST_KEY" ] || [ "$POST_KEY" = "$PRE_KEY" ]; then
  log "key unchanged — no restarts needed"
  exit 0
fi

log "METABOB_API_KEY changed (seed minted a new key) — restarting key consumers"
# Every vessel service sources the key via EnvironmentFile; restart the ones the
# inventory maps to a repo (i.e. actual vessels, not store/infra), staggered to
# avoid a thundering herd (lesson 2026-06-21).
if command -v jq >/dev/null 2>&1 && [ -f "$INV" ]; then
  UNITS="$(jq -r '.vessels[] | select(.repo != null and (.unit | endswith(".service")) and ((.manifest // false) | not)) | .unit' "$INV")"
  # THE RENDERED LLM ARMS ARE NOT IN THE INVENTORY, BY DESIGN — so an
  # inventory-driven target list silently excluded exactly the units that most
  # need the new key. Measured on a live hub: llm-haiku held a 31-char pre-seed
  # placeholder for the life of the container while llm-resolver-vessel held the
  # real 160-char key; discovery answered 20 of 40 arm heartbeats with 401, and
  # the arms still reported `active enabled restarts=0` with substrate-doctor
  # PASSing "no failed units". A key consumer invisible to the key-rotation
  # sweep is a permanent one. Add them by glob, which is how they exist.
  for _a in /etc/systemd/system/llm-*.service; do
    [ -f "$_a" ] || continue
    UNITS="$UNITS
$(basename "$_a")"
  done
else
  UNITS="discovery-vessel.service identity-vessel.service activity-api.service development-vessel.service local-tools-vessel.service llm-resolver-vessel.service goal-host-vessel.service ribosome-vessel.service concept-db.service analysis-vessel.service light-dispatch-vessel.service relevance-sink-vessel.service stateful-ui-vessel.service"
fi
for u in $UNITS; do
  # membership = enabled OR running (core units are often 'disabled' by symlink
  # yet pulled in via Requires= — same rule as substrate-ready.sh)
  systemctl is-enabled "$u" >/dev/null 2>&1 || systemctl is-active "$u" >/dev/null 2>&1 || continue
  # identity-vessel issues keys, does not consume METABOB_API_KEY — and
  # restarting it kills THIS unit mid-run (Requires= stop propagation).
  [ "$u" = "identity-vessel.service" ] && continue
  systemctl restart "$u" 2>/dev/null && log "restarted $u" || log "warn: restart failed for $u"
  sleep 2
done

# Seed oneshots that already ran (and failed) with the pre-mint bootstrap key
# get a second chance with the real key (their writes need a valid org).
if command -v jq >/dev/null 2>&1 && [ -f "$INV" ]; then
  for u in $(jq -r '.vessels[] | select(.role == "seed") | .unit' "$INV"); do
    [ "$u" = "identity-seeder.service" ] && continue
    if [ "$(systemctl is-failed "$u" 2>/dev/null)" = "failed" ]; then
      systemctl restart "$u" 2>/dev/null && log "re-ran failed seeder $u" || true
    fi
  done
fi
log "reseed restart complete"
