#!/usr/bin/env bash
# One demonstration case: launch a NEW fleet through the install page's path
# (manifest printed by the image + .env + compose), wait on the verdict, dispatch
# a known-answer goal and a data-local goal, record evidence, tear down.
#
# usage: run-case.sh <case-name> <port-prefix> <env-file-fragment> [wait-level]
# Inputs are only the .env fragment plus IMAGE; nothing ambient is read.
set -uo pipefail
CASE="$1"; PREFIX="$2"; FRAG="$3"; LEVEL="${4:-usable}"
IMAGE="${IMAGE:?set IMAGE to the image under test}"
OUT="${OUT_DIR:-$(dirname "$0")/results}/$CASE"; mkdir -p "$OUT"
WD="$(mktemp -d)"; NAME="demo-$CASE"; C="$NAME-live"
log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$OUT/log.txt"; }
cleanup() {
  docker logs "$C" > "$OUT/container.log" 2>&1 || true
  (cd "$WD" && docker compose down -v >>"$OUT/teardown.txt" 2>&1)
  rm -rf "$WD"
}
trap cleanup EXIT

log "case=$CASE prefix=$PREFIX image=$IMAGE"
docker run --rm --entrypoint substrate-manifest "$IMAGE" > "$WD/docker-compose.yml" 2>"$OUT/manifest.err" \
  || { log "FAIL manifest"; exit 1; }
{ echo "SUBSTRATE_IMAGE=$IMAGE"; echo "SUBSTRATE_NAME=$NAME"; echo "SUBSTRATE_PORT_PREFIX=$PREFIX"; cat "$FRAG"; } > "$WD/.env"
sed -E 's/(KEY|TOKEN|PAT)=.*/\1=<redacted>/' "$WD/.env" > "$OUT/env.redacted"

T0=$(date +%s)
(cd "$WD" && docker compose up -d) >"$OUT/up.txt" 2>&1 || { log "FAIL compose up"; exit 1; }
log "up; waiting for $LEVEL"
docker exec "$C" substrate-status --wait "$LEVEL" --timeout 1200 --json > "$OUT/verdict.json" 2>"$OUT/verdict.err"
VRC=$?
log "verdict rc=$VRC after $(( $(date +%s) - T0 ))s: $(jq -c '[.levels[]? | {(.level): .value}] | add' "$OUT/verdict.json" 2>/dev/null)"

# Data-local goal: a file that exists only on this node's disk.
GH="http://127.0.0.1:${PREFIX}210"
if curl -sf -m 5 "$GH/health" >/dev/null; then
  docker exec "$C" sh -c 'mkdir -p /workspace/demo && yes x | head -53 > /workspace/demo/known.txt'
  GOAL="Count the lines in the file /workspace/demo/known.txt on this machine and report the number."
  D=$(curl -s -m 30 -X POST "$GH/run-goal" -H 'Content-Type: application/json' \
      -d "$(jq -nc --arg g "$GOAL" '{goal:$g, tags:["operator:install-demo"]}')" | jq -r '.dispatchId // .executionId // empty')
  log "data-local dispatch=$D"
  for i in $(seq 1 60); do
    R=$(curl -s -m 15 "$GH/executions/$D"); ST=$(jq -r '.status // empty' <<<"$R")
    case "$ST" in completed|failed|error) break;; esac; sleep 10
  done
  echo "$R" > "$OUT/data-local.json"
  REACHED=$(jq -r '.reached' <<<"$R"); ANS=$(jq -r 'tostring | test("\\b53\\b")' <<<"$R")
  log "data-local status=$ST reached=$REACHED answer_mentions_53=$ANS"
else
  log "data-local: no goal-host on this node (profile routes goals to its anchor)"
fi
docker exec "$C" substrate-status --json > "$OUT/verdict-final.json" 2>/dev/null
log "done rc=$VRC"
exit $VRC
