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

if [ "$SMOKE" = 1 ]; then
  echo "== 7. smoke: goal dispatch -> trace lands =="
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
