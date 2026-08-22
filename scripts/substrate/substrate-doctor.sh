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

echo "== 1b. datastore disk headroom =="
# A FULL DISK PRESENTS AS DATABASE-PERFORMANCE PATHOLOGY, AND NOTHING ELSE ALARMED.
#
# 2026-08-10: the hub sat at 76G/77G used — 1.1G free — and SurrealDB began timing
# out on writes: 28 "query was not executed because it exceeded the timeout" on
# INSERT INTO execution in a single 20-minute window, with the process never
# restarting. Everything downstream stopped quietly: ribosome extraction skipped
# every execution (verdict=ungraded), reaches went ungraded, and spoke traces were
# dropped by TranslatingTraceSink. No check anywhere reported a problem, and the
# investigation burned three plausible wrong causes (index count, request volume,
# restart loop) before `df -h` answered it in one line.
#
# Thresholds are on FREE SPACE, not percentage: an 18G datastore on a 99%-full 77G
# disk has 1.1G to work with regardless of what the ratio says.
DISK_AVAIL_MB="$(csh 'df -Pm /var/lib/surrealdb 2>/dev/null || df -Pm /' | awk 'NR==2 {print $4}')"
DISK_USE_PCT="$(csh 'df -P /var/lib/surrealdb 2>/dev/null || df -P /' | awk 'NR==2 {print $5}' | tr -d '%')"
if [ -z "$DISK_AVAIL_MB" ]; then
  note "could not read datastore filesystem usage — skipping headroom check"
elif [ "$DISK_AVAIL_MB" -lt 2048 ]; then
  bad "datastore disk has ${DISK_AVAIL_MB}MB free (${DISK_USE_PCT}% used) — SurrealDB WILL time out on writes"
  note "grading, ribosome extraction and trace persistence stop silently at this level"
  note "reclaim without touching data: docker builder prune -f ; journalctl --vacuum-size=200M"
  note "do NOT prune docker local volumes — that is the substrate datastore"
elif [ "$DISK_AVAIL_MB" -lt 8192 ]; then
  note "WARN datastore disk has ${DISK_AVAIL_MB}MB free (${DISK_USE_PCT}% used) — below 8G, watch it"
else
  ok "datastore disk headroom ${DISK_AVAIL_MB}MB free (${DISK_USE_PCT}% used)"
fi

# ── Topology, read once ──────────────────────────────────────────────────────
# EVERY CHECK BELOW USED TO ASSUME A STANDALONE FLEET, so on a spoke — where the
# store, the trace API and identity live on the HUB by design — four checks
# failed for reasons that were not defects, and none of them named the actual
# problem. Measured on a spoke whose hub rejected its key: check 2 failed with a
# "likely cause" that was wrong twice over (fresh volume, and a spoke has no
# local surrealdb at all), check 3 probed a masked loopback port, and the real
# fault — a 401 from the hub on every write — was named by nothing.
#
# Ask systemd what is actually here rather than inferring from env: a masked unit
# is the definitive statement that this topology does not serve that role.
masked() { [ "$(csh "systemctl is-enabled '$1' 2>/dev/null" 2>/dev/null || true)" = "masked" ]; }
IS_SPOKE=0
# STRIP THE QUOTES BEFORE TESTING FOR EMPTY. gen-env emits HUB_DISCOVERY_URL=""
# on a standalone, and `grep -E '^HUB_DISCOVERY_URL=.+'` matches that line
# because the two quote characters ARE content — which labelled every standalone
# a spoke. Read the value, not the line.
_hub="$(csh 'grep -m1 "^HUB_DISCOVERY_URL=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\"'"'"'"' 2>/dev/null || true)"
[ -n "$_hub" ] && IS_SPOKE=1
# The endpoints this fleet actually resolves against — loopback on a standalone,
# the hub on a spoke. Probing the hardcoded loopback is what made check 3 blind.
ACTIVITY_EP="$(csh 'grep -m1 "^ACTIVITY_API_ENDPOINT=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\""' 2>/dev/null || true)"
IDENTITY_EP="$(csh 'grep -m1 "^IDENTITY_VESSEL_URL=" /etc/substrate/env 2>/dev/null | cut -d= -f2- | tr -d "\""' 2>/dev/null || true)"
[ -n "$ACTIVITY_EP" ] || ACTIVITY_EP="http://127.0.0.1:8080"
[ -n "$IDENTITY_EP" ] || IDENTITY_EP="http://127.0.0.1:8101"
[ "$IS_SPOKE" = 1 ] && note "topology: spoke — store/identity/trace checks target the hub ($ACTIVITY_EP)"

echo "== 2. SurrealDB root auth =="
if masked surrealdb.service; then
  ok "skipped — surrealdb is masked by this topology; the datastore lives on the hub"
else
SURREAL_CHECK="$(csh 'P=$(grep -m1 "^SURREALDB_PASSWORD=" /etc/substrate/env | cut -d= -f2- | tr -d "\""); curl -s -m 5 -u "root:$P" -X POST http://127.0.0.1:8000/sql -H "Accept: application/json" -H "surreal-ns: activity-system" -H "surreal-db: learning_loop" -d "RETURN 1;"' 2>/dev/null || true)"
if echo "$SURREAL_CHECK" | grep -q '"OK"'; then
  ok "surrealdb root credentials valid"
else
  bad "surrealdb root auth FAILED — env SURREAL_PASS does not match the datastore root user"
  note "response: $(echo "$SURREAL_CHECK" | head -c 120)"
  # Offer the recreate-against-warm-volume cause only when the volume IS warm.
  # Stating it unconditionally sent a reader chasing a recreate that never
  # happened, on a fleet whose datastore had been created minutes earlier.
  if csh '[ -d /var/lib/surrealdb ] && [ -n "$(ls -A /var/lib/surrealdb 2>/dev/null)" ]' 2>/dev/null; then
    note "likely cause: container recreate regenerated SURREAL_PASS against a warm datastore volume"
  else
    note "the datastore directory is empty — this is a first boot, not a recreate against warm state"
  fi
fi
fi

echo "== 3. seeded API key =="
# Probe the endpoint this fleet actually uses. Hardcoded loopback meant that on a
# spoke — where activity-api is masked and the trace store is the hub's — this
# check reported a local probe error, and the ONE check positioned to say
# "your hub rejected your key" said "HTTP 000" instead.
KEY_CODE="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -o /dev/null -w '%{http_code}' -m 8 -H \"Authorization: ApiKey \$K\" '$ACTIVITY_EP/v2/activities/templates?limit=1'" 2>/dev/null || true)"
_where="activity-api"; [ "$IS_SPOKE" = 1 ] && _where="the hub's activity-api ($ACTIVITY_EP)"
case "$KEY_CODE" in
  200) ok "METABOB_API_KEY authenticates against $_where" ;;
  401|403)
    bad "METABOB_API_KEY rejected by $_where (HTTP $KEY_CODE)"
    if [ "$IS_SPOKE" = 1 ]; then
      note "THIS SPOKE HAS NOT JOINED. The hub does not accept this key, so every write it"
      note "attempts — template seeding, traces, capability mirroring — is refused."
      note "Mint one on the hub: docker exec <hub-container> substrate-key issue <name>"
    else
      note "reseed needed (identity-seeder)"
    fi ;;
  *) bad "authed probe against $_where returned HTTP ${KEY_CODE:-none}" ;;
esac

echo "== 3b. credential is accepted by the identity that issued it =="
# The discriminator the spoke audit found missing. `substrate-key whoami` reports
# it correctly and doctor never asked, so a fleet could be comprehensively
# unable to join while doctor listed four unrelated failures.
VALID="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -m 8 -X POST '$IDENTITY_EP/v1/keys/validate' -H 'Content-Type: application/json' -d \"{\\\"api_key\\\":\\\"\$K\\\"}\"" 2>/dev/null || true)"
if echo "$VALID" | grep -q '"valid":[[:space:]]*true'; then
  ok "METABOB_API_KEY validates against $IDENTITY_EP"
elif echo "$VALID" | grep -q '"valid":[[:space:]]*false'; then
  bad "METABOB_API_KEY REJECTED by $IDENTITY_EP: $(echo "$VALID" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')"
  [ "$IS_SPOKE" = 1 ] && note "this is the join failure — nothing this spoke writes to the hub will be accepted"
else
  bad "identity validate unreadable at $IDENTITY_EP"
  note "response: $(echo "$VALID" | head -c 120)"
fi

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

echo "== 5b. restart loops =="
# `systemctl --failed` CANNOT SEE A RESTART LOOP. A unit with Restart= that keeps
# dying reports `activating`/`active` forever and never `failed`, so check 5
# above is structurally blind to it. Measured on a spoke: bootstrap-seeder
# cycling roughly once every 20s, doctor reporting no failed units, and the
# fleet's actual fault invisible.
#
# A DELTA, NOT A LIFETIME COUNT. NRestarts is cumulative for the life of the
# boot, so failing on NRestarts>0 would condemn every unit that ever recovered —
# including a healthy fleet whose vessel restarted once at boot. Take two
# samples and report only units whose counter MOVES between them; that is a loop
# happening now, which is what an operator needs to know.
# One call, parsed by block. systemd prints NRestarts BEFORE Id, so an
# order-assuming parser pairs each count with the previous unit's name — measured
# as a looping vessel reporting 0 while a direct query said 29.
_snap() {
  csh 'systemctl list-units --type=service --all --no-legend --plain 2>/dev/null | awk "{print \$1}" | grep -v "^$" | tr "\n" " " | xargs -r systemctl show --property=Id,NRestarts --no-pager 2>/dev/null' 2>/dev/null \
    | awk -F= '
        /^Id=/{id=$2}
        /^NRestarts=/{n=$2}
        /^[[:space:]]*$/{ if(id!=""){print id " " n} ; id=""; n="" }
        END{ if(id!=""){print id " " n} }'
}
SNAP1="$(_snap)"
# Must exceed one restart cycle. A measured seeder loop cycled about every 20s,
# so a 12s window saw no change and the loop read as healthy.
sleep "${DOCTOR_LOOP_WINDOW:-25}"
SNAP2="$(_snap)"
LOOPING=""
while read -r u n2; do
  [ -n "$u" ] || continue
  n1="$(echo "$SNAP1" | awk -v U="$u" '$1==U {print $2}')"
  [ -n "$n1" ] && [ -n "$n2" ] || continue
  [ "$n2" -gt "$n1" ] 2>/dev/null && LOOPING="$LOOPING $u(+$((n2-n1)) in ${DOCTOR_LOOP_WINDOW:-25}s, total $n2)"
done <<EOF
$SNAP2
EOF
if [ -z "$LOOPING" ]; then
  ok "no unit restarted during a ${DOCTOR_LOOP_WINDOW:-25}s observation window"
else
  bad "restart loop:$LOOPING"
  note "these report 'activating'/'active', never 'failed' — check 5 cannot see them"
  note "read the cause: journalctl -u <unit> -n 50"
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

echo "== 7. llm arms answer a real call =="
# Not /health. Measured 2026-08-10: every local arm reported 200 with
# providers=[anthropic] and discovery listed nine servers for llm_completion,
# while EVERY actual call returned "Your credit balance is too low". The account
# was unfunded, so no compose could draft anything for hours, and each layer
# reported something true but not causal — the compose verdict even quoted the
# trailing federation-egress arm, which is the LAST candidate tried.
#
# A paid dependency is only provably alive if a real, minimal, paid call
# succeeds. 16 tokens costs a fraction of a cent and buys the one fact that
# matters: can this substrate draft at all.
LLM_OK=0; LLM_TRIED=0; LLM_WHY=""
for LP in 8221 8223 8225; do
  csh "curl -s -o /dev/null -w '' -m 3 http://127.0.0.1:$LP/health" >/dev/null 2>&1 || continue
  LLM_TRIED=$((LLM_TRIED + 1))
  LR="$(csh "K=\$(grep -m1 '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '\"'); curl -s -m 45 -X POST http://127.0.0.1:$LP/resolve -H 'Content-Type: application/json' -H \"Authorization: ApiKey \$K\" -d '{\"type\":\"llm_completion\",\"prompt\":\"reply with the single word ok\",\"max_tokens\":16,\"task_type\":\"doctor_probe\"}'" 2>/dev/null || true)"
  case "$LR" in
    *'"resolved":true'*) LLM_OK=$((LLM_OK + 1)) ;;
    *) [ -z "$LLM_WHY" ] && LLM_WHY="$(printf '%s' "$LR" | tr -d '\n' | head -c 160)" ;;
  esac
done
if [ "$LLM_TRIED" = 0 ]; then
  note "no local llm arm is listening (expected on a role-subset node that resolves LLM on a peer)"
elif [ "$LLM_OK" -gt 0 ]; then
  ok "$LLM_OK/$LLM_TRIED llm arm(s) answered a real completion"
else
  bad "all $LLM_TRIED local llm arm(s) are up but CANNOT COMPLETE — the substrate cannot draft"
  note "first error: $LLM_WHY"
  note "credit/quota or key problem, not a code problem; /health cannot see it"
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
