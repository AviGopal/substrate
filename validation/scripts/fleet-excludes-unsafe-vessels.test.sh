#!/usr/bin/env bash
# fleet-excludes-unsafe-vessels.test.sh: a vessel with an open critical security defect is not installable.
#
# conversation-vessel runs a caller's params.command with `sh -c`, reachable through POST /resolve/tool
# with no authentication (gap conversation-vessel-runs-an-unauthenticated-callers-command-with-sh-c):
# unauthenticated remote code execution as root in the container. On 2026-10-03 no node ran it, and the
# tooling could not install it: vessel-ctl install refuses a name with no manifest entry, and
# apply-inventory selects only inventory entries. This test keeps it that way. It fails if the vessel
# reappears in the fleet definition (inventory, manifest) or as a unit file, which is the only way a node
# would ever start it. Remove the name below only when that gap closes with a verified fix.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/lib/gate-test-lib.sh"
UNSAFE=(conversation-vessel)
for v in "${UNSAFE[@]}"; do
  hits=""
  for f in scripts/substrate/vessels.inventory.json scripts/substrate/vessels.manifest.json; do
    [ -f "$ROOT/$f" ] || { bad "fleet definition present: $f"; continue; }
    jq -e --arg v "$v" '[.. | objects | select((.name? // .unit? // .repo? // "") | tostring | test("^" + $v + "(\\.service)?$"))] | length > 0' "$ROOT/$f" >/dev/null 2>&1 && hits="$hits $f"
  done
  [ -e "$ROOT/scripts/substrate/units/$v.service" ] && hits="$hits scripts/substrate/units/$v.service"
  if [ -n "$hits" ]; then echo "  $v found in:$hits"; bad "no unsafe vessel is installable"
  else ok "no unsafe vessel is installable"; fi
done
done_tests
