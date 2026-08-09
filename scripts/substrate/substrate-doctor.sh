#!/usr/bin/env bash
# substrate-doctor.sh — "is this substrate actually alive?" in one command.
#
# Beyond substrate-ready's per-unit health matrix, this verifies the seams that
# have historically failed silently:
#   1. fleet readiness matrix (substrate-ready --once)
#   2. SurrealDB root auth      — catches the SURREAL_PASS/datastore drift
#                                 (regenerated pass vs persisted root user, 2026-07-02)
#   3. seeded-key auth          — METABOB_API_KEY authenticates against activity-api
#   4. discovery registry       — registered-vessel count vs a sane floor
#   5. failed systemd units     — catches silently-dead timers/crash-loops
#   6. --smoke                  — dispatch a real goal via goal-host /run-goal and
#                                 confirm the execution trace lands (end-to-end)
#
# Usage: substrate-doctor.sh [--smoke]
# Exit 0 = all checks pass; 1 = at least one failure.
# Dual-context like substrate-ready.sh (host via docker exec, or in-container).
set -uo pipefail

CONTAINER="${CONTAINER:-substrate-live}"
SMOKE=0
[ "${1:-}" = "--smoke" ] && SMOKE=1

if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  IN_CONTAINER=0
else
  IN_CONTAINER=1
fi
csh() { if [ "$IN_CONTAINER" = 1 ]; then sh -c "$1"; else docker exec "$CONTAINER" sh -c "$1"; fi; }

FAIL=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAIL=1; }
note() { printf '       %s\n' "$1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== 1. fleet readiness =="
if [ "$IN_CONTAINER" = 1 ] && [ -x /usr/local/bin/substrate-ready ]; then
  /usr/local/bin/substrate-ready --once || FAIL=1
else
  CONTAINER="$CONTAINER" "$SCRIPT_DIR/substrate-ready.sh" --once || FAIL=1
fi

echo "== 2. SurrealDB root auth =="
SURREAL_CHECK="$(csh 'P=$(grep -m1 "^SURREALDB_PASSWORD=" /etc/substrate/env | cut -d= -f2- | tr -d "\""); curl -s -m 5 -u "root:$P" -X POST http://127.0.0.1:8000/sql -H "Accept: application/json" -H "surreal-ns: activity-system" -H "surreal-db: learning_loop" -d "RETURN 1;"' 2>/dev/null || true)"
if echo "$SURREAL_CHECK" | grep -q '"OK"'; then
  ok "surrealdb root credentials valid"
else
  bad "surrealdb root auth FAILED — env SURREAL_PASS does not match the datastore root user"
  note "response: $(echo "$SURREAL_CHECK" | head -c 120)"
  note "likely cause: container recreate regenerated SURREAL_PASS against a warm datastore volume"
fi

echo "== 3. seeded API key =="
KEY_CODE="$(csh 'K=$(grep -m1 "^METABOB_API_KEY=" /etc/substrate/env | cut -d= -f2- | tr -d "\""); curl -s -o /dev/null -w "%{http_code}" -m 8 -H "Authorization: ApiKey $K" "http://127.0.0.1:8080/v2/activities/templates?limit=1"' 2>/dev/null || true)"
case "$KEY_CODE" in
  200) ok "METABOB_API_KEY authenticates against activity-api" ;;
  401|403) bad "METABOB_API_KEY rejected by activity-api (HTTP $KEY_CODE) — reseed needed (identity-seeder)" ;;
  *) bad "activity-api authed probe returned HTTP ${KEY_CODE:-none}" ;;
esac

echo "== 4. discovery registry =="
REG="$(csh 'curl -s -m 5 http://127.0.0.1:8100/registry/stats' 2>/dev/null || true)"
REG_N="$(echo "$REG" | jq -r '.total_vessels // .totalVessels // .registered // empty' 2>/dev/null || true)"
# Floor scales with topology: a role-subset container (spoke/hub) legitimately
# registers far fewer vessels than the full fleet.
REG_FLOOR=5
if csh 'grep -qE "^ENABLED_(ROLES|VESSELS)=." /etc/substrate/env 2>/dev/null' 2>/dev/null; then REG_FLOOR=2; fi
if [ -n "$REG_N" ] && [ "$REG_N" -ge "$REG_FLOOR" ] 2>/dev/null; then
  ok "discovery registry populated ($REG_N vessels)"
elif [ -n "$REG_N" ]; then
  bad "discovery registry looks hollow ($REG_N vessels registered)"
else
  bad "discovery registry stats unreadable"
  note "response: $(echo "$REG" | head -c 120)"
fi

echo "== 5. failed systemd units =="
FAILED_UNITS="$(csh 'systemctl --failed --no-legend --plain 2>/dev/null' 2>/dev/null | awk '{print $1}' | grep -v '^$' || true)"
if [ -z "$FAILED_UNITS" ]; then
  ok "no failed units"
else
  bad "failed units: $(echo "$FAILED_UNITS" | tr '\n' ' ')"
fi

echo "== 6. recovery-coverage lint =="
# Every long-running vessel service must be reachable by SOME recovery path:
# a health_port (self-recovery tick) or Restart= in its unit (systemd converge).
UNCOVERED="$(csh 'INV=/workspace/substrate/fleet/vessels.inventory.json; [ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json;
  jq -r ".vessels[] | select((.unit | endswith(\".service\")) and .health_port == null and (.role != \"seed\") and ((.manifest // false) | not)) | .unit" "$INV" 2>/dev/null | while read -r u; do
    f="/etc/systemd/system/$u"
    [ -f "$f" ] || continue
    grep -q "^Type=oneshot" "$f" && continue
    grep -q "^Restart=" "$f" || echo "$u"
  done' 2>/dev/null || true)"
if [ -z "$UNCOVERED" ]; then
  ok "every long-running service has a health_port or Restart= policy"
else
  bad "no recovery path (no health_port, no Restart=): $(echo "$UNCOVERED" | tr '\n' ' ')"
fi

echo "== 7. host convergence loop =="
# Checks 1-6 all run INSIDE the container (csh → docker exec), including the
# failed-unit sweep. The host-side sync timers are therefore the one moving part
# the substrate cannot see itself, and on 2026-08-07 that is exactly what broke:
#
#   host-pull-sync.timer: Unit to trigger vanished.
#   host-pull-sync.timer: Failed with result 'resources'.
#
# Both generated unit files had been removed while the timer symlink survived.
# The loop that pulls substrate-authored commits back to the host and re-syncs
# changed vessels was dead for two days, and the only symptom anyone noticed was
# the super-repo's submodule pointers silently falling 30 commits behind.
#
# Deliberately narrow: a machine that never installed these units is a normal
# deployment (they are an operator dev-box convenience, installed by
# `make install-host-sync`), so absence is a note, not a failure. A unit systemd
# knows about and reports as failed, or a half-present installation, is real.
if [ "$IN_CONTAINER" = 1 ] || ! command -v systemctl >/dev/null 2>&1; then
  note "skipped (in-container, or no systemctl) — these units live on the host"
else
  USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  for U in host-pull-sync host-sync-poller; do
    STATE="$(systemctl --user is-active "$U.timer" 2>/dev/null || true)"
    case "$STATE" in
      active)
        # An active timer proves scheduling, not work: the service can fail on
        # every single firing while the timer stays green forever. Judge the
        # service by its Result, NOT by is-active — these are oneshots, so
        # "inactive" with ExecMainStatus 0 is the healthy steady state and
        # treating it as down would report every working host as broken.
        RESULT="$(systemctl --user show -p Result --value "$U.service" 2>/dev/null || true)"
        if [ -n "$RESULT" ] && [ "$RESULT" != "success" ]; then
          bad "$U.timer is active but its last run FAILED (Result=$RESULT)"
          note "the timer will keep firing and keep failing; journalctl --user -u $U.service -n 50"
        else
          ok "$U.timer active, last run ${RESULT:-not yet run}"
        fi
        ;;
      failed)
        bad "$U.timer is FAILED — host/substrate convergence is not running"
        note "why: $(systemctl --user show -p Result --value "$U.timer" 2>/dev/null || echo unknown); \
remedy: make -C scripts/substrate install-host-sync && systemctl --user enable --now $U.timer"
        ;;
      *)
        # Presence of a unit FILE proves nothing: `make install-host-sync` writes
        # both units whether or not the operator wants both running, so keying on
        # the file reports a healthy box as broken. Enablement is the intent
        # signal — enabled-but-not-active is the contradiction worth reporting.
        ENABLED="$(systemctl --user is-enabled "$U.timer" 2>/dev/null || true)"
        if [ "$ENABLED" = "enabled" ]; then
          bad "$U.timer is enabled but not running (state=${STATE:-unknown})"
          note "remedy: systemctl --user start $U.timer  (or reinstall: make -C scripts/substrate install-host-sync)"
        else
          note "$U not enabled on this host (expected unless this is the operator dev box)"
        fi
        ;;
    esac
  done
fi

if [ "$SMOKE" = 1 ]; then
  echo "== 8. smoke: goal dispatch -> trace lands =="
  SMOKE_OUT="$(csh 'K=$(grep -m1 "^METABOB_API_KEY=" /etc/substrate/env | cut -d= -f2- | tr -d "\""); curl -s -m 60 -X POST http://127.0.0.1:8210/run-goal -H "Content-Type: application/json" -H "Authorization: ApiKey $K" -d "{\"goal\":\"substrate doctor smoke check: report the substrate is alive\"}"' 2>/dev/null || true)"
  # /run-goal answers either synchronously ({executionId,...}) or async
  # ({dispatchId, status:running} — poll GET /executions/:dispatchId).
  EXEC_ID="$(echo "$SMOKE_OUT" | jq -r '.executionId // empty' 2>/dev/null || true)"
  DISPATCH_ID="$(echo "$SMOKE_OUT" | jq -r '.dispatchId // empty' 2>/dev/null || true)"
  if [ -z "$EXEC_ID" ] && [ -z "$DISPATCH_ID" ]; then
    bad "goal dispatch returned neither executionId nor dispatchId"
    note "response: $(echo "$SMOKE_OUT" | head -c 200)"
  else
    if [ -z "$EXEC_ID" ]; then
      note "dispatched dispatchId=$DISPATCH_ID — polling for completion"
      ST=""
      for _ in $(seq 1 40); do
        REC="$(csh "curl -s -m 8 http://127.0.0.1:8210/executions/$DISPATCH_ID" 2>/dev/null || true)"
        ST="$(echo "$REC" | jq -r '.status // empty' 2>/dev/null || true)"
        EXEC_ID="$(echo "$REC" | jq -r '.executionId // empty' 2>/dev/null || true)"
        [ -n "$ST" ] && [ "$ST" != "running" ] && break
        sleep 5
      done
      [ -n "$ST" ] && note "dispatch status: $ST"
    fi
    if [ -z "$EXEC_ID" ]; then
      bad "no executionId materialized for the smoke goal"
    else
      note "executionId=$EXEC_ID — waiting for trace"
      TRACE_OK=0
      for _ in $(seq 1 20); do
        CODE="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -o /dev/null -w '%{http_code}' -m 8 -H \"Authorization: ApiKey \$K\" http://127.0.0.1:8080/v2/activities/execution-traces/$EXEC_ID" 2>/dev/null || true)"
        [ "$CODE" = "200" ] && { TRACE_OK=1; break; }
        sleep 3
      done
      if [ "$TRACE_OK" = 1 ]; then ok "execution trace landed ($EXEC_ID)"; else bad "trace for $EXEC_ID not readable within 60s"; fi
    fi
  fi
fi

echo
if [ "$FAIL" = 0 ]; then echo "[doctor] all checks PASS"; else echo "[doctor] FAILURES detected" >&2; fi
exit "$FAIL"
