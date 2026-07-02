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

/root/.bun/bin/bun /vessels/seed-identity.ts || {
  log "seed-identity failed (rc=$?) — leaving fleet as-is"
  exit 1
}

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
