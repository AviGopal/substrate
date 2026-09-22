#!/usr/bin/env bash
# Acceptance for audit failures #3 (dynamic membership not durable across
# recreate) and part of #2 (install ok:true into an absent workdir).
#
# Boots an isolated instance with the EDITED entrypoint/vessel-ctl/manifest
# overlaid (the image predates them), installs a dynamic vessel, RECREATES the
# container on the same volumes, and asserts the unit file is reconstructed by
# the boot reconcile. Also asserts an install into an absent workdir refuses.
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/avigopal/substrate:dev}"
NAME="slaf-member-$(date +%H%M%S)"
NET="$NAME-net"
LABEL=substrate-lifecycle-fix-accept
CORE='surrealdb,valkey,discovery-vessel,identity-vessel,activity-api,identity-seeder,local-tools-vessel,goal-host-vessel,development-vessel,concept-db,journald-stdout-forwarder'
REPO="${REPO:-/home/avi/documents/work/substrate}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$NAME-workspace" "$NAME-surreal" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

overlay() { # copy edited fleet tooling over the baked copies (pre-start)
  docker cp "$REPO/scripts/substrate/entrypoint.sh"        "$NAME:/usr/local/bin/substrate-entrypoint"
  docker cp "$REPO/scripts/substrate/vessel-ctl.sh"        "$NAME:/usr/local/bin/vessel-ctl"
  docker cp "$REPO/scripts/substrate/vessels.manifest.json" "$NAME:/usr/local/share/substrate/vessels.manifest.json"
}

create() {
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
  overlay
  docker start "$NAME" >/dev/null
}

wait_boot() {
  for _ in $(seq 1 60); do
    docker exec "$NAME" sh -c 'systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"' && return 0
    sleep 2
  done
  echo "[member] FAIL: systemd never settled"; exit 1
}

docker network create --internal --label "$LABEL" "$NET" >/dev/null
docker volume create --label "$LABEL" "$NAME-workspace" >/dev/null
docker volume create --label "$LABEL" "$NAME-surreal" >/dev/null

create; wait_boot
echo "[member] first boot up"

echo "[member] 1. install into ABSENT workdir must refuse (human-surface-vessel; offline seed has no repos/)"
r=$(docker exec "$NAME" vessel-ctl install human-surface-vessel 2>/dev/null || true)
echo "[member]    -> $r"
echo "$r" | grep -q '"ok":false' || { echo "[member] FAIL: absent-workdir install did not refuse"; exit 1; }
docker exec "$NAME" test -f /etc/systemd/system/human-surface-vessel.service \
  && { echo "[member] FAIL: refused install still wrote a unit"; exit 1; } || true

echo "[member] 2. install a dynamic vessel with a BAKED workdir (federation-transport-vessel)"
r=$(docker exec "$NAME" vessel-ctl install federation-transport-vessel 2>/dev/null || true)
echo "[member]    -> $(echo "$r" | head -c 200)"
echo "$r" | grep -q '"ok":true' || { echo "[member] FAIL: baked-workdir install refused"; exit 1; }
docker exec "$NAME" sh -c 'cat /workspace/substrate/fleet/installed.json' | grep -q federation-transport-vessel \
  || { echo "[member] FAIL: installed.json does not record the vessel"; exit 1; }
docker exec "$NAME" test -f /etc/systemd/system/federation-transport-vessel.service \
  || { echo "[member] FAIL: unit not written on install"; exit 1; }

echo "[member] 3. RECREATE the container on the same volumes"
docker rm -f "$NAME" >/dev/null
create; wait_boot
echo "[member]    recreated"

docker exec "$NAME" test -f /etc/systemd/system/federation-transport-vessel.service \
  || { echo "[member] FAIL: unit NOT restored after recreate (the audit's exact failure)"; exit 1; }
echo "[member] 4. unit restored by boot reconcile — PASS"

echo "[member] 5. uninstall removes the record"
docker exec "$NAME" vessel-ctl uninstall federation-transport-vessel >/dev/null 2>&1 || true
docker exec "$NAME" sh -c 'cat /workspace/substrate/fleet/installed.json' | grep -q federation-transport-vessel \
  && { echo "[member] FAIL: uninstall left the record"; exit 1; } || true
echo "[member] PASS: durable membership + workdir refusal verified across a recreate"
