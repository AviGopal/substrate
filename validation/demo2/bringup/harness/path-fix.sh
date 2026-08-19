#!/usr/bin/env bash
# THE REPAIR — close the two federation asserts Path A failed.
#
# Path A's container is up, its surface serves, and its federation asserts fail.
# The cause is not federation: federation-transport-vessel never had its
# dependencies resolved, so it has been dying and restarting every five seconds
# since boot, and `Restart=always` keeps it in `activating` — never `failed` —
# so every ActiveState-based check above it reads healthy.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUB=/home/avi/documents/work/substrate
V="python3 $HERE/vidkit.py"
TAG=fix
NAME=substrate-demo-ui
OFFSET=${OFFSET:-7000}
HUB=http://syzygy.host:18100

$V say $TAG "THE REPAIR — Path A left two federation asserts failing. This is why, and this is the fix."

$V say $TAG "step 1 — the state nothing reports. ActiveState says 'activating', which every is-active check reads as fine."
$V run $TAG -- bash -c "timeout 30 docker exec $NAME systemctl show federation-transport-vessel -p ActiveState -p SubState -p NRestarts -p ExecMainStatus 2>&1"
$V say $TAG "NRestarts is the discriminator. It has been climbing since boot; the unit has never once run to completion."
$V run $TAG -- bash -c "timeout 30 docker exec $NAME journalctl -u federation-transport-vessel -n 60 --no-pager 2>&1 | grep -iE 'cannot find module|error:' | tail -2"

$V say $TAG "step 2 — root cause. vessel-ctl resolves dependencies ONCE, at install time, in the unit's workdir."
$V say $TAG "That workdir lives inside the super-repo clone, which git-push-setup had not created yet when the install ran."
$V run $TAG -- bash -c "echo 'BAKED in this 4-day-old image:'; timeout 30 docker exec $NAME sed -n '101p' /usr/local/bin/vessel-ctl"
$V say $TAG "the guard short-circuits to true when the directory is absent: nothing installed, and the install still reported ok:true."
$V run $TAG -- bash -c "echo 'FIXED in git (79cfbe9a):'; sed -n "115,126p" $SUB/scripts/substrate/vessel-ctl.sh"
$V say $TAG "and a restart re-runs ExecStart, never the install — so the bad install is permanent for the life of the container."
$V run $TAG -- bash -c "timeout 30 docker exec $NAME sh -c 'ls -A /workspace/git/super-repo/scripts/substrate/federation-relay/node_modules 2>/dev/null | wc -l' | xargs -I{} echo 'modules resolved in the transport workdir: {}'"

$V say $TAG "step 3 — the durable fix: make a RESTART able to repair the install. render-unit.sh now emits an ExecStartPre that resolves deps when they are missing."
$V run $TAG -- bash -c "SUBSTRATE_SUPER_REPO_DIR=/workspace/git/super-repo VESSELS_MANIFEST=$SUB/scripts/substrate/vessels.manifest.json bash $SUB/scripts/substrate/render-unit.sh federation-transport-vessel | grep -E '^ExecStartPre|^ExecStart='"

$V say $TAG "step 4 — apply it to this container, through the normal workpath: vessel-ctl install, from the FIXED script."
$V run $TAG -- "$SUB/scripts/substrate/vessel-ctl.sh" install federation-transport-vessel --container "$NAME"

$V say $TAG "step 5 — did it take? modules resolved, restarts stopped, unit actually running."
$V run $TAG -- bash -c "timeout 30 docker exec $NAME sh -c 'ls -A /workspace/git/super-repo/scripts/substrate/federation-relay/node_modules 2>/dev/null | wc -l' | xargs -I{} echo 'modules resolved now: {}'"
$V run $TAG -- bash -c "sleep 20; timeout 30 docker exec $NAME systemctl show federation-transport-vessel -p ActiveState -p SubState -p NRestarts -p MainPID 2>&1"
$V run $TAG -- bash -c "timeout 20 docker exec $NAME curl -s -m 5 http://127.0.0.1:8401/health 2>&1 | head -c 300; echo"
$V run $TAG -- bash -c "timeout 30 docker exec $NAME journalctl -u federation-transport-vessel -n 15 --no-pager 2>&1 | tail -5"

$V say $TAG "step 6 — the assert Path A failed. Does this spoke's surface now appear in the HUB's registry?"
$V run $TAG -- bash -c "for i in 1 2 3 4 5 6; do \
  n=\$(curl -s -m 10 -X POST $HUB/resolve -H 'Content-Type: application/json' \
    -H \"Authorization: ApiKey \$(jq -r .metabob.apiKey ~/.metabob/config.json)\" \
    -d '{\"pointer\":{\"type\":\"vesselCapability\",\"shape\":\"surfaceIntent\"}}' \
    | jq -r '[.content.vessels[]?.vesselId] | map(select(test(\"spoke-\"))) | length' 2>/dev/null); \
  echo \"poll \$i: surfaceIntent producers on the hub tagged spoke-*: \${n:-?}\"; sleep 15; done"

$V say $TAG "step 7 — and the detector, so this class never needs an operator again."
$V run $TAG -- bash -c "sed -n '/^starting() {/,/^}/p' $SUB/scripts/substrate/self-recovery-tick.sh"
$V say $TAG "self-recovery skipped 'activating' as a slow start. auto-restart is not a start phase — it is the gap between crashes. SubState is the discriminator."
