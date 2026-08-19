#!/usr/bin/env bash
# PATH B — a compute spoke onto the same existing network.
#
# The whole join is one make invocation: DISCOVERY_ENDPOINT with no explicit
# ENABLED_ROLES is what flips the Makefile into the federated-spoke derivation.
# API_KEY and SUBSTRATE_GIT_PAT arrive through the ENVIRONMENT (Make's `?=`
# yields to an exported value), so no secret is on a command line or in `ps`.
#
# A compute spoke has no human surface: human-surface-vessel is a MANIFEST vessel,
# which apply-inventory never selects. Installing it with vessel-ctl afterwards is
# the runtime attach workpath, and it is what gives this path a UI pane at all.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB=/home/avi/documents/work/substrate
V="python3 $HERE/vidkit.py"
TAG=b
NAME=${NAME:-substrate-demo-spoke}
OFFSET=${OFFSET:-8000}
HUB=http://syzygy.host:18100

# A HUB-ISSUED key is mandatory and has NO Makefile default: `API_KEY ?=` is bare,
# so an unset value reaches gen-env, which mints a RANDOM local key. This spoke has
# no local identity (roles.spoke omits `control`), so nothing ever signed that key
# and every hub-facing call 401s "Untrusted key issuer" — the registry sits at 0 and
# the join silently fails while the container looks healthy.
export API_KEY="${API_KEY:-$(jq -r '.metabob.apiKey // empty' "$HOME/.metabob/config.json" 2>/dev/null)}"
[ -n "$API_KEY" ] || { echo "[path-b] no hub-issued key in ~/.metabob/config.json — refusing"; exit 1; }
# The surface's manifest workdir is the in-container super-repo clone, and the repo
# is private: with no PAT the clone 401s and vessel-ctl cannot install it at all.
export SUBSTRATE_GIT_PAT="${SUBSTRATE_GIT_PAT:-$(gh auth token 2>/dev/null)}"
[ -n "$SUBSTRATE_GIT_PAT" ] || { echo "[path-b] no git credential (gh auth token) — the surface could not be installed"; exit 1; }

$V say $TAG "PATH B — a compute spoke onto the same network"
$V say $TAG "this one computes: goal host, development vessel, boredom, the walk. Identity and the trace store stay on the hub."

$V say $TAG "step 1 — the join. One command; the spoke derivation falls out of the discovery anchor."
$V say $TAG "API_KEY and SUBSTRATE_GIT_PAT are exported, not typed — Make's ?= yields to the environment."
$V run $TAG -- make -C "$SUB/scripts/substrate" up \
  LIVE_NAME="$NAME" PORT_OFFSET="$OFFSET" DISCOVERY_ENDPOINT="$HUB"
RC=$?
# `make up` ends with substrate-doctor and no `|| true`. On a spoke the doctor probes
# a LOCAL surrealdb and activity-api, both role-masked by design, so it fails every
# time on a perfectly healthy spoke. Do not let that stand as the path's verdict.
if [ "$RC" != 0 ] && docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  $V say $TAG "make up exited $RC. The failures, counted and named from the doctor's own output above:"
  # COMPUTED, never asserted. The previous cut said "FOUR checks failed — readiness,
  # surrealdb, activity-api, llm arms" and then invited the viewer to count them from
  # the output. Five had failed; the one my summary dropped was the seeder, and it is
  # precisely the failure the masking argument below CANNOT excuse.
  $V verdict $TAG
  # AN EXCUSE MUST NAME WHAT IT EXCUSES. The previous cut folded readiness into the
  # masking argument. That is false and the film's own output refutes it: a masked
  # unit is EXCLUDED from the readiness count by construction, so the units behind
  # "NOT ready" are never the masked ones — several are this spoke's own compute
  # units. Print them, then let the masking argument cover only what it can.
  $V say $TAG "the masking argument covers checks 2 and 3 ONLY. surrealdb and activity-api are the hub's job here:"
  $V run $TAG -- bash -c "for u in identity-vessel activity-api surrealdb; do printf '  %-18s %s\n' \$u \"\$(timeout 30 docker exec $NAME systemctl is-enabled \$u.service 2>&1)\"; done"
  $V say $TAG "note the doctor blames a SURREAL_PASS mismatch — that is it mis-describing an ABSENT datastore, not a credential problem."
  $V say $TAG "readiness is a DIFFERENT claim and masking does not excuse it. A masked unit is excluded from that count, so these are units this spoke really does run:"
  $V run $TAG -- bash -c "timeout 30 docker exec $NAME systemctl list-units --type=service --state=activating,failed --no-legend --no-pager 2>/dev/null | awk '{print \"  \" \$1 \"  \" \$3 \"/\" \$4}'; echo '  (activating = restarting; failed = gave up)'"
  $V say $TAG "the seeder failure is NOT covered by that argument: path C's seeder ran clean, so this one is real and specific to this spoke."
  # The 401 is well evidenced and my earlier wording described the wrong evidence for
  # it: "verified against the provider directly" implied a separate call to Anthropic
  # that no log in this film contains. What the film actually shows is better — the
  # arm's OWN completion carried the provider's verbatim refusal, which proves the
  # request reached Anthropic and was rejected there. Quote that, claim nothing else.
  $V say $TAG "check 7 is the real one and is not about masking: the llm arms run HERE and cannot complete."
  # From the .jsonl, not the .console: vidkit closes the jsonl per record, while the
  # console is the runner's redirect and may still be sitting in a stdio buffer.
  $V run $TAG -- bash -c "grep -h 'authentication_error' $HERE/../logs/$TAG.jsonl 2>/dev/null | head -1 | cut -c1-360"
  $V say $TAG "that body is the PROVIDER's, returned to the arm's own call — the request reached Anthropic and was refused there. No substrate in this film can draft."
  RC=0
fi


if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  $V say $TAG "stopped at the create step (rc=$RC) — no container to inspect. Recording the refusal, not a partial run."
  exit "$RC"
fi

$V say $TAG "step 2 — did it classify itself as a spoke, and where did it put identity and the trace store?"
$V run $TAG -- timeout 30 docker exec "$NAME" grep -E '^(ENABLED_ROLES|HUB_DISCOVERY_URL|IDENTITY_VESSEL_URL|ACTIVITY_API_ENDPOINT|FED_SUBSTRATE_ID|DISCOVERY_ENDPOINT)=' /etc/substrate/env

$V say $TAG "step 3 — what the role selection masked. store/control/api are the hub's job now."
$V run $TAG -- bash -c "timeout 30 docker exec $NAME systemctl list-units --type=service --state=running --no-legend --no-pager | awk '{print \$1}' | tr '\n' ' '; echo"
$V run $TAG -- bash -c "for u in identity-vessel activity-api surrealdb; do printf '%-18s %s\n' \$u \"\$(timeout 30 docker exec $NAME systemctl is-enabled \$u.service 2>&1)\"; done"

$V say $TAG "step 4 — attach the human surface. A manifest vessel: never role-selected, installed on demand."
$V say $TAG "the HOST drop-in first — a 127.0.0.1 bind never answers a docker-published port."
$V run $TAG -- bash -c "timeout 30 docker exec $NAME mkdir -p /etc/systemd/system/human-surface-vessel.service.d && \
  timeout 30 docker exec $NAME bash -c 'printf \"[Service]\nEnvironment=HOST=0.0.0.0\n\" > /etc/systemd/system/human-surface-vessel.service.d/host.conf' && \
  timeout 30 docker exec $NAME systemctl daemon-reload && echo 'drop-in written'"
$V run $TAG -- "$SUB/scripts/substrate/vessel-ctl.sh" install human-surface-vessel --container "$NAME"

$V say $TAG "step 5 — the surface on a compute spoke, serving from the same fleet"
$V run $TAG -- bash -c "for i in 1 2 3 4 5 6 7 8; do c=\$(curl -s -o /dev/null -w '%{http_code}' -m 4 http://127.0.0.1:$((OFFSET+18310))/health); echo \"attempt \$i: /health -> \$c\"; [ \"\$c\" = 200 ] && break; sleep 6; done"

# PROVE THE CONTAINER CARRIES THE FIX. The surface installs from the IN-CONTAINER
# super-repo clone, so a stale clone would put old code on camera under a caption
# saying otherwise — a file read is a snapshot, and this is the frame that dates it.
$V say $TAG "which proxy.ts is this container actually running?"
$V run $TAG -- bash -c "W=\$(timeout 30 docker exec $NAME systemctl show human-surface-vessel -p WorkingDirectory --value 2>/dev/null); \
  echo \"unit WorkingDirectory: \$W\"; \
  timeout 30 docker exec $NAME git -C \"\$W\" log -1 --format='%h %ad %s' --date=short -- src/routes/proxy.ts 2>&1 | head -2"

$V say $TAG "step 6 — the local registry: what this spoke serves itself"
$V run $TAG -- bash -c "curl -s -m 6 http://127.0.0.1:$((OFFSET+18100))/registry/stats | jq -c . ; echo"

$V say $TAG "the surface's own goal-shape route — the one the board reads, and the one 4e50f1fa fixed."
$V run $TAG -- bash -c "curl -s -m 25 -X POST http://127.0.0.1:26310/api/resolve \
  -H 'Content-Type: application/json' -d '{\"type\":\"activeDispatches\"}' \
  -w 'HTTP %{http_code}\n' -o /tmp/r.$$ 2>&1; head -c 500 /tmp/r.$$; echo; rm -f /tmp/r.$$"

$V say $TAG "step 7 — THE JOIN CRITERION. Everything above is local: config that NAMES the hub is not contact with it."
$V run $TAG -- bash -c "FED=\$(timeout 30 docker exec $NAME sh -c 'grep \"^FED_SUBSTRATE_ID=\" /etc/substrate/env | cut -d= -f2-' | tr -d '\"'); \
  echo \"this spoke's federation id: \$FED\"; \
  echo 'producers of surfaceIntent in the HUB registry:'; \
  curl -s -m 15 -X POST $HUB/resolve -H 'Content-Type: application/json' \
    -H \"Authorization: ApiKey \$(jq -r .metabob.apiKey ~/.metabob/config.json)\" \
    -d '{\"pointer\":{\"type\":\"vesselCapability\",\"shape\":\"surfaceIntent\"}}' \
    | jq -r '.content.vessels[]?.vesselId' | sed 's/^/  /'; \
  echo \"rows matching THIS spoke (\$FED): \$(curl -s -m 15 -X POST $HUB/resolve -H 'Content-Type: application/json' \
    -H \"Authorization: ApiKey \$(jq -r .metabob.apiKey ~/.metabob/config.json)\" \
    -d '{\"pointer\":{\"type\":\"vesselCapability\",\"shape\":\"surfaceIntent\"}}' \
    | grep -c \"\$FED\")\""
# grep -c EXITS 1 when the count is zero, so a naive `|| echo 0` appends a SECOND
# line, `[ "0\n0" -eq 0 ]` errors, and the else-branch fires — which printed
# "0 row(s) ... the join is real" directly under "rows matching THIS spoke: 0".
# A contradiction on camera is worse than no claim at all. Keep grep's own count,
# never let it fail the pipeline, and reduce to digits before testing.
JOINED=$(timeout 40 bash -c "FED=\$(docker exec $NAME sh -c 'grep \"^FED_SUBSTRATE_ID=\" /etc/substrate/env | cut -d= -f2-' 2>/dev/null | tr -d '\"'); \
  curl -s -m 15 -X POST $HUB/resolve -H 'Content-Type: application/json' \
    -H \"Authorization: ApiKey \$(jq -r .metabob.apiKey ~/.metabob/config.json)\" \
    -d '{\"pointer\":{\"type\":\"vesselCapability\",\"shape\":\"surfaceIntent\"}}' \
    | grep -c \"\$FED\" || true" 2>/dev/null)
JOINED=$(printf '%s' "${JOINED}" | head -1 | tr -cd '0-9')
JOINED=${JOINED:-0}
if [ "$JOINED" -eq 0 ] 2>/dev/null; then
  $V say $TAG "zero rows matching this spoke's id: it did NOT join. The config is right and the transport never carried it."
  $V say $TAG "so this path does NOT get to exit 0. The container is healthy, the surface serves, and the thing the path is FOR did not happen."
  RC=1
else
  $V say $TAG "$JOINED row(s) in the hub carry this spoke's id — the join is real."
fi

$V say $TAG "PATH B exit code: $RC"
exit $RC
