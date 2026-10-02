#!/usr/bin/env bash
# PATH A — a UI container onto an existing network.
#
# No secret is on any command line: ui-only-up.sh fills --api-key from
# ~/.metabob/config.json and --git-pat from `gh auth token` when the flags are
# absent. --hub IS passed explicitly, because its config fallback is
# .metabob.endpoint — an activity-api URL that passes validation and fails only
# at the last assert, five minutes in.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB=/home/avi/documents/work/substrate
V="python3 $HERE/vidkit.py"
TAG=a
NAME=${NAME:-substrate-demo-ui}
# 4000 was clear when this was written and was taken minutes later by a container
# someone else started. The port survey below is re-run at execution time for that
# reason: a block is only free at the moment you look.
OFFSET=${OFFSET:-7000}
HUB=http://syzygy.host:18100

$V say $TAG "PATH A — a UI container onto an existing network"
$V say $TAG "target: a box that SHOWS the substrate rather than computing for it."
$V say $TAG "everything it needs but does not serve — traces, identity, goals, LLM — resolves on the hub."

$V say $TAG "step 0 — what is already here, and which ports are free"
$V run $TAG -- docker ps --format '{{.Names}}  {{.Status}}'
# THE SURVEY MUST COVER THE BLOCK IT RECOMMENDS. The previous range stopped at
# 23000 while the chosen offset lands at 25xxx, so the scan structurally could not
# see whether the recommendation was free — and the caption asserted "four
# substrates ... the first clear block" as a literal regardless. Both halves were
# wrong on this box: five thousand-blocks were occupied and seven substrate
# containers were running, printed one frame above the sentence denying it.
#
# Now: scan through the chosen offset, count the occupied blocks, and state
# whether THIS offset's ports are actually free. Nothing here is a constant.
$V run $TAG -- bash -c "PORTS=\$(ss -ltn | awk 'NR>1{n=\$4;sub(/.*[:.]/,\"\",n);print n}' | sort -un | awk -v hi=$((OFFSET+18400)) '\$1>=18000 && \$1<=hi'); \
  echo \"occupied ports 18000-$((OFFSET+18400)): \$(echo \$PORTS | tr '\n' ' ')\"; \
  echo \"distinct thousand-blocks in use: \$(echo \"\$PORTS\" | awk '{print int(\$1/1000)}' | sort -u | tr '\n' ' ')\"; \
  echo \"substrate containers running: \$(docker ps --format '{{.Names}}' | grep -c substrate)\"; \
  CLASH=\$(echo \"\$PORTS\" | awk -v lo=$((OFFSET+18000)) -v hi=$((OFFSET+18400)) '\$1>=lo && \$1<=hi' | tr '\n' ' '); \
  if [ -z \"\$CLASH\" ]; then echo \"offset $OFFSET (ports $((OFFSET+18000))-$((OFFSET+18400))): CLEAR\"; else echo \"offset $OFFSET: OCCUPIED by \$CLASH\"; fi"
$V say $TAG "read the three lines above rather than my summary: the blocks in use, how many substrates are running, and whether the offset this path is about to take is free."

$V say $TAG "step 1 — rehearse. DRY_RUN prints the plan and the exact docker command, and touches nothing."
DRY_RUN=1 $V run $TAG -- "$SUB/scripts/substrate/ui-only-up.sh" \
  --hub "$HUB" --name "$NAME" --port-offset "$OFFSET"

$V say $TAG "step 2 — run it for real. The script numbers its own steps as it goes: preflight, make up, HOST drop-in, vessel-ctl install, then the asserts."
$V run $TAG -- "$SUB/scripts/substrate/ui-only-up.sh" \
  --hub "$HUB" --name "$NAME" --port-offset "$OFFSET"
RC=$?

# Stop here if there is no container. Without this the remaining steps run anyway
# and record a "No such container" error followed by a hub query whose answers come
# from OTHER substrates entirely — a segment that looks like a partial success and
# is actually nothing at all.
if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  $V say $TAG "PATH A stopped at step 2 (rc=$RC) — no container to inspect. The guard above refused before touching anything, which is the correct outcome, not a partial run."
  exit "$RC"
fi

$V say $TAG "step 3 — what actually came up"
$V run $TAG -- timeout 30 docker exec "$NAME" systemctl list-units --type=service --state=running --no-legend --no-pager
$V run $TAG -- bash -c "curl -s -m 5 http://127.0.0.1:$((OFFSET+18310))/health; echo"
# PROVE THE CONTAINER CARRIES THE FIX. The surface installs from the IN-CONTAINER
# super-repo clone, so a stale clone would put old code on camera under a caption
# saying otherwise — a file read is a snapshot, and this is the frame that dates it.
$V say $TAG "which proxy.ts is this container actually running?"
$V run $TAG -- bash -c "W=\$(timeout 30 docker exec $NAME systemctl show human-surface-vessel -p WorkingDirectory --value 2>/dev/null); \
  echo \"unit WorkingDirectory: \$W\"; \
  timeout 30 docker exec $NAME git -C \"\$W\" log -1 --format='%h %ad %s' --date=short -- src/routes/proxy.ts 2>&1 | head -2"

$V say $TAG "the surface answers on the HOST port — which only works because the drop-in bound it to 0.0.0.0."

$V say $TAG "step 3b — the federation transport. NRestarts, not ActiveState, is the discriminator: Restart=always turns a hard failure into a permanently-healthy-looking one."
$V run $TAG -- bash -c "timeout 30 docker exec $NAME systemctl show federation-transport-vessel -p ActiveState -p SubState -p NRestarts -p Result 2>&1"
# DO NOT ASSERT THE FAILURE MODE. The previous cut narrated "ActiveState reads
# 'activating', never 'failed' — NRestarts climbs — the module was never installed",
# which described a crash-loop that 79cfbe9a (self-repairing ExecStartPre) has since
# fixed. A hardcoded failure caption is the same defect as a hardcoded count: on a
# fresh container it may be flatly false under its own frame. Read the number back
# and let it say which case this is.
$V run $TAG -- bash -c "N=\$(timeout 30 docker exec $NAME systemctl show federation-transport-vessel -p NRestarts --value 2>/dev/null); \
  if [ \"\${N:-0}\" -gt 0 ] 2>/dev/null; then echo \"NRestarts=\$N — this unit IS looping; the module it execs is missing or failing to start.\"; \
  else echo \"NRestarts=\$N — no restart loop. The self-repairing ExecStartPre landed, so this failure mode is NOT present on this container.\"; fi"
$V run $TAG -- bash -c "timeout 30 docker exec $NAME journalctl -u federation-transport-vessel -n 40 --no-pager 2>&1 | grep -iE 'cannot find|error|failed to|circuit|reservation' | tail -3"

# EXERCISE THE FIXED PATH, do not just claim it. Before 4e50f1fa this route probed
# `${base}/resolve` on the federation ingress, got a 404, rejected its only candidate
# and returned 502 "upstream unreachable" — which is what the board's error banner
# was reporting. Whatever it prints here is the honest answer for THIS container:
# a UI-only spoke that has not joined has no producer to reach either way.
$V say $TAG "step 3c — the surface's own goal-shape route, which is what the board reads."
$V run $TAG -- bash -c "curl -s -m 25 -X POST http://127.0.0.1:$((OFFSET+18310))/api/resolve \
  -H 'Content-Type: application/json' -d '{\"type\":\"activeDispatches\"}' \
  -w 'HTTP %{http_code}\n' -o /tmp/r.$$ 2>&1; head -c 500 /tmp/r.$$; echo; rm -f /tmp/r.$$"
$V say $TAG "a 502 here names its own reason now. It used to say only 'upstream unreachable' — which was a 404 on a wrong path, indistinguishable from a dead relay."

$V say $TAG "step 4 — the join criterion: do this spoke's shapes appear in the HUB's registry?"
$V run $TAG -- bash -c "curl -s -m 10 -X POST $HUB/resolve -H 'Content-Type: application/json' \
  -H \"Authorization: ApiKey \$(jq -r .metabob.apiKey ~/.metabob/config.json)\" \
  -d '{\"pointer\":{\"type\":\"vesselCapability\",\"shape\":\"surfaceIntent\"}}' \
  | jq -c '.content.vessels[]? | {vesselId, protocol}' 2>/dev/null | head -20; echo"

$V say $TAG "read that answer carefully: those rows are OTHER substrates' surfaces. None of them is this container."
$V run $TAG -- bash -c "FED=\$(timeout 30 docker exec $NAME sh -c 'grep \"^FED_SUBSTRATE_ID=\" /etc/substrate/env | cut -d= -f2-' | tr -d '\"'); \
  N=\$(curl -s -m 15 -X POST $HUB/resolve -H 'Content-Type: application/json' \
    -H \"Authorization: ApiKey \$(jq -r .metabob.apiKey ~/.metabob/config.json)\" \
    -d '{\"pointer\":{\"type\":\"vesselCapability\",\"shape\":\"surfaceIntent\"}}' | grep -c \"\$FED\"); \
  echo \"this container's federation id: \$FED\"; echo \"rows in the hub answer matching it: \$N\""
$V say $TAG "that is what the failing assert means. The surface is up and serving; the FEDERATION of it is what did not happen."

$V say $TAG "PATH A exit code: $RC"
exit $RC
