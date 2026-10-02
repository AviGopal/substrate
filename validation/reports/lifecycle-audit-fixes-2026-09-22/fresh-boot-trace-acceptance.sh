#!/usr/bin/env bash
# Acceptance gate for the fresh-datastore trace-persistence fix (audit failure #1).
#
# Boots an ISOLATED substrate instance from the current image with FRESH volumes
# (the audit's restricted CORE roster, fixture provider creds, no host mounts,
# no published ports), overlays the two landed schema fixes over the baked
# copies (the image predates them), then asserts the audit's failed gate:
#   POST /v2/activities/execution-traces -> 2xx AND the trace listing non-empty.
# Teardown removes the container, volumes and network. Nothing touches the
# production instance or its volumes.
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/avigopal/substrate:dev}"
NAME="slaf-accept-$(date +%H%M%S)"
NET="$NAME-net"
LABEL=substrate-lifecycle-fix-accept
CORE='surrealdb,valkey,discovery-vessel,identity-vessel,activity-api,identity-seeder,local-tools-vessel,goal-host-vessel,development-vessel,concept-db,journald-stdout-forwarder'
# NO_OVERLAY=1: the image already carries the fixed schemas (a post-fix
# rebuild) — skip the docker cp overlays and additionally assert the
# human-surface UI and relay bring-up work out-of-box.
NO_OVERLAY="${NO_OVERLAY:-0}"
# The UI check needs the vessel unmasked by the selection.
[ "$NO_OVERLAY" = 1 ] && CORE="$CORE,human-surface-vessel"
if [ "$NO_OVERLAY" != 1 ]; then
  FIXED_SQL_SRC="${FIXED_SQL_SRC:?path to a checkout of activity-api at/after the landed fixes (needs sql/schemas/023-shape-conditioned-scores.surql and sql/migrations/055-variant-tracking.surql)}"
fi

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$NAME-workspace" "$NAME-surreal" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create --internal --label "$LABEL" "$NET" >/dev/null
docker volume create --label "$LABEL" "$NAME-workspace" >/dev/null
docker volume create --label "$LABEL" "$NAME-surreal" >/dev/null

docker create --name "$NAME" --hostname "$NAME" --label "$LABEL" --network "$NET" \
  --privileged --memory 4g --cpus 2 --pids-limit 1024 \
  --tmpfs /run --tmpfs /run/lock \
  -v "$NAME-workspace:/workspace" -v "$NAME-surreal:/var/lib/surrealdb" \
  -e OPENAI_API_KEY=audit-fixture-not-a-provider-credential \
  -e OPENAI_BASE_URL=http://127.0.0.1:19999/v1 \
  -e LLM_DEFAULT_MODEL=audit-unavailable \
  -e MITOSIS_DIRECT_PUSH=0 -e ROUTE_EDIT_INTENT_TO_COMPOSE=0 \
  -e SUBSTRATE_GIT_PAT= -e GITHUB_TOKEN= \
  -e ENABLED_VESSELS="$CORE" \
  "$IMAGE" >/dev/null

if [ "$NO_OVERLAY" != 1 ]; then
  # Overlay the landed fixes over the baked schema copies BEFORE first boot, so
  # init-database applies the fixed files exactly as a post-fix image would.
  docker cp "$FIXED_SQL_SRC/sql/schemas/023-shape-conditioned-scores.surql" \
    "$NAME:/vessels/activity-api/sql/schemas/023-shape-conditioned-scores.surql"
  docker cp "$FIXED_SQL_SRC/sql/migrations/055-variant-tracking.surql" \
    "$NAME:/vessels/activity-api/sql/migrations/055-variant-tracking.surql"
  docker cp "$FIXED_SQL_SRC/sql/schemas/045-emergent-shape-stats.surql" \
    "$NAME:/vessels/activity-api/sql/schemas/045-emergent-shape-stats.surql"
fi

docker start "$NAME" >/dev/null
echo "[accept] booted $NAME; waiting for activity-api"

ok=0
for _ in $(seq 1 90); do
  if docker exec "$NAME" sh -c 'curl -sm 2 http://127.0.0.1:8080/health >/dev/null 2>&1'; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || { echo "[accept] FAIL: activity-api never became healthy"; docker exec "$NAME" journalctl -u activity-api -n 40 --no-pager || true; exit 1; }

# Wait for identity seeding to mint the API key the POST needs.
key=""
for _ in $(seq 1 60); do
  key=$(docker exec "$NAME" sh -c 'grep -m1 "^METABOB_API_KEY=" /etc/substrate/env 2>/dev/null | sed "s/^METABOB_API_KEY=//; s/\"//g"' || true)
  [ -n "$key" ] && break
  sleep 2
done
[ -n "$key" ] || { echo "[accept] FAIL: no METABOB_API_KEY after identity seeding"; exit 1; }

probe() { # method path [body] — $key comes from the bash scope above.
  # Never non-zero: a transient ConnectionRefused (activity-api restarting
  # under self-recovery) must read as a retryable "000", not kill the script
  # through set -e inside a command substitution.
  docker exec -e PROBE_KEY="$key" "$NAME" bun -e '
    const [method, path, body] = process.argv.slice(1);
    try {
      const r = await fetch("http://127.0.0.1:8080" + path, {
        method, headers: {"Content-Type":"application/json", Authorization: "ApiKey " + process.env.PROBE_KEY},
        body: body ? body : undefined, signal: AbortSignal.timeout(10000)});
      console.log(r.status + " " + (await r.text()).slice(0, 300));
    } catch (e) { console.log("000 " + String(e).slice(0, 120)); }
  ' "$@" 2>/dev/null || echo "000 docker-exec-failed"
}

# The key appears in /etc/substrate/env before identity-vessel has finished
# registering it, so early POSTs see INVALID_API_KEY. Wait until auth clears.
for _ in $(seq 1 60); do
  s=$(probe GET /v2/activities/templates | head -c 3)
  case "$s" in
    401*|000*) key=$(docker exec "$NAME" sh -c 'grep -m1 "^METABOB_API_KEY=" /etc/substrate/env 2>/dev/null | sed "s/^METABOB_API_KEY=//; s/\"//g"' || true); sleep 3 ;;
    *) break ;;
  esac
done
echo "[accept] auth cleared (templates -> $s)"

echo "[accept] POST execution trace"
TRACE='{"execution_id":"exec_accept_1","template_id":"acceptance-probe","activity_id":"acceptance-probe","variant_id":"acceptance-probe","success":true,"duration_ms":5,"cost_usd":0,"input_impulse_shapes":["acceptance_input"],"output_impulse_shapes":["acceptance_output"],"trace":{"tasks":[{"task_id":"t1","description":"acceptance","status":"success","duration_ms":5,"tool_calls":[],"input_impulse_ids":[],"output_impulse_ids":[],"success":true,"input_shapes":["acceptance_input"],"output_shapes":["acceptance_output"]}]}}'
# activity-api restarts a few times while the fresh fleet settles; a refused
# connection is retryable, a 4xx/5xx is a verdict.
r1=""
for _ in $(seq 1 20); do
  r1=$(probe POST /v2/activities/execution-traces "$TRACE")
  case "$r1" in 000*) sleep 5 ;; *) break ;; esac
done
echo "[accept] write: $r1"
case "$r1" in 2*) ;; *) echo "[accept] FAIL: trace write not 2xx"; docker exec "$NAME" sh -c 'systemctl status activity-api --no-pager | head -6; journalctl -u activity-api -n 30 --no-pager | tail -20' || true; exit 1;; esac

r2=$(probe GET /v2/activities/execution-traces)
echo "[accept] list: $(echo "$r2" | head -c 200)"
case "$r2" in
  2*exec_accept_1*|2*acceptance-probe*) echo "[accept] PASS: trace persisted and listed on a fresh datastore";;
  *) echo "[accept] FAIL: listing does not contain the written trace"; exit 1;;
esac

if [ "$NO_OVERLAY" = 1 ]; then
  echo "[accept] out-of-box extras (post-fix image)"
  # Human surface: vendor unit + baked ui/dist must answer / with 200.
  docker exec "$NAME" sh -c 'systemctl start human-surface-vessel 2>/dev/null; sleep 3; curl -sm 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:8310/' | grep -q 200 \
    && echo "[accept] PASS: human surface / -> 200 out-of-box" \
    || { echo "[accept] FAIL: human surface / not 200"; exit 1; }
  # Relay: manifest workdir must exist in the image (no hand repoint needed).
  wd=$(docker exec "$NAME" sh -c 'jq -r ".vessels[] | select(.name==\"federation-relay\") | .workdir" /usr/local/share/substrate/vessels.manifest.json')
  docker exec "$NAME" test -f "$wd/relay.ts" \
    && echo "[accept] PASS: relay workdir exists in-image ($wd)" \
    || { echo "[accept] FAIL: relay workdir absent ($wd)"; exit 1; }
fi
