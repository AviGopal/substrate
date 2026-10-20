#!/usr/bin/env bash
# image-timers-run-on-a-fresh-boot.test.sh: a recovery or liveness timer runs on a node built from the image, with
# no later step. Before, nine of them were enabled only by pull-sync on a later tick, so a fresh or recreated node
# without a git credential or network ran with no liveness checks at all.
#   (a) REGRESSION GUARD: every timer under scripts/substrate/units has a first-run trigger (OnBootSec, OnCalendar,
#       OnStartupSec or OnActiveSec), not OnUnitActiveSec alone, which counts from the service's last activation and
#       so would not guarantee a first run on a fresh boot. Every timer has one today (all carry OnActiveSec or
#       OnBootSec); this keeps it so.
#   (b) Dockerfile.substrate's `systemctl enable` list names each recovery/liveness timer (RECOVERY below)
#   (c) every timer the image enables exists under scripts/substrate/units (a typo in the list would fail the build)
# usage: validation/scripts/image-timers-run-on-a-fresh-boot.test.sh   (bash, grep; files only)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; U="$ROOT/scripts/substrate/units"; DF="$ROOT/Dockerfile.substrate"
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
RECOVERY="self-recovery self-operational-health self-repair-operational light-dispatch-healthcheck joint-liveness
  validator-liveness memory-budget-check trace-store-health-check runtime-drift db-maintenance db-contention-check
  learning-liveness-probe coherence-recover"
miss=""; for f in "$U"/*.timer; do grep -qE '^(OnBootSec|OnCalendar|OnStartupSec|OnActiveSec)=' "$f" || miss="$miss ${f##*/}"; done
[ -z "$miss" ] && ok "(a) every timer has a first-run trigger" || bad "(a) OnUnitActiveSec alone (no first run on a fresh boot):$miss"
enabled="$(awk '/systemctl enable \\$/{on=1; next} on{print} on && !/\\$/{on=0}' "$DF" | tr -d ' \\' | grep -E '\.(timer|service)$')"
miss=""; for t in $RECOVERY; do printf '%s\n' "$enabled" | grep -qx "$t.timer" || miss="$miss $t.timer"; done
[ -z "$miss" ] && ok "(b) the image enables every recovery/liveness timer" || bad "(b) not enabled by the image:$miss"
miss=""; for t in $(printf '%s\n' "$enabled" | grep '\.timer$'); do [ -f "$U/$t" ] || miss="$miss $t"; done
[ -z "$miss" ] && ok "(c) every timer the image enables exists in units/" || bad "(c) enabled but not in units/:$miss"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
