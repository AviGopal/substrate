#!/usr/bin/env bash
# substrate-ready.sh — fleet readiness, derived from vessels.inventory.json.
#
# The single answer to "is the substrate up?". Replaces the "wait ~15s" advice
# and the per-unit ad-hoc ExecStartPre health polls. Three consumers:
#   - substrate-ready.service (oneshot): boot-readiness as a systemd fact
#   - Dockerfile HEALTHCHECK (--quick): host-visible readiness via docker inspect
#   - substrate-doctor.sh: the launch-verification matrix
#
# Usage: substrate-ready.sh [--timeout N] [--once] [--quick] [--json] [--services-only]
#   --timeout N       poll until ready or N seconds (default 120)
#   --once            single pass, no waiting
#   --quick           core vessels only ("core": true in the inventory)
#   --json            machine-readable result on stdout
#   --services-only   skip *.timer units — REQUIRED for the boot gate
#                     (substrate-ready.service): the ready-gated timers are
#                     After=substrate-ready, so counting them creates a
#                     circular wait that burns the full poll timeout at every
#                     boot (observed 2026-07-02 recreate)
#
# Readiness rules per enabled inventory unit:
#   health_port present        -> curl 127.0.0.1:<port><health_path|/health> == 200
#   *.timer                    -> systemctl is-active (timers stay active while waiting)
#   role "seed" oneshots       -> not failed (inactive after a successful run is OK)
#   other *.service, no port   -> systemctl is-active
# Units disabled by apply-inventory (or not installed) are skipped.
#
# DUAL CONTEXT (same idiom as self-recovery-tick.sh): runs from the host
# (docker exec into $CONTAINER) or inside the container (direct).
set -uo pipefail

CONTAINER="${CONTAINER:-substrate-live}"
TIMEOUT=120; ONCE=0; QUICK=0; JSON=0; SERVICES_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --once) ONCE=1; shift ;;
    --quick) QUICK=1; ONCE=1; shift ;;
    --json) JSON=1; shift ;;
    --services-only) SERVICES_ONLY=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  IN_CONTAINER=0
else
  IN_CONTAINER=1
fi
csh()  { if [ "$IN_CONTAINER" = 1 ]; then sh -c "$1"; else docker exec "$CONTAINER" sh -c "$1"; fi; }

# Inventory: env override, then the substrate-writable VOLUME copy, then the
# image-baked default, then next to this script (host context).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INV="${VESSELS_INVENTORY:-}"
if [ -z "$INV" ]; then
  if [ "$IN_CONTAINER" = 1 ] && [ -f /workspace/substrate/fleet/vessels.inventory.json ]; then
    INV=/workspace/substrate/fleet/vessels.inventory.json
  elif [ "$IN_CONTAINER" = 1 ] && [ -f /usr/local/share/substrate/vessels.inventory.json ]; then
    INV=/usr/local/share/substrate/vessels.inventory.json
  elif [ -f "$SCRIPT_DIR/vessels.inventory.json" ]; then
    INV="$SCRIPT_DIR/vessels.inventory.json"
  fi
fi
if [ -z "$INV" ] || [ ! -f "$INV" ]; then echo "[ready] no inventory found" >&2; exit 2; fi
command -v jq >/dev/null 2>&1 || { echo "[ready] jq required" >&2; exit 2; }

# rows: unit|role|health_port|health_path|core
rows() {
  jq -r '.vessels[] | [.unit, .role, (.health_port // ""), (.health_path // "/health"), (.core // false)] | join("|")' "$INV"
}

# Restart-loop detection, by DELTA against the previous poll pass.
#
# `is-active` and `is-failed` are both blind to a Restart= loop — the unit reports
# `activating` or `active` forever and never `failed`. NRestarts is the tell, but
# only as a change over time: the lifetime counter is non-zero on any fleet whose
# vessel recovered once, and failing on that would make a healthy fleet unready.
#
# LOOP_PREV holds "unit=count" from the previous pass. A unit whose count MOVED
# between passes is looping right now. On the first pass there is no baseline, so
# nothing is reported — which is correct: one sample cannot distinguish a loop
# from a unit that restarted an hour ago.
# ONE round trip per pass, not one per unit. Asking systemd per unit added ~64
# `docker exec`s to every pass and pushed a readiness check past two minutes —
# a check slow enough to skip is a check nobody runs. Collect the whole table in
# a single call and look units up in the local string.
LOOP_PREV=""
LOOP_CUR=""
# NOT `--value` with two properties: it prints bare values with no key, and the
# pairing does not survive `paste` — the first attempt produced rows like
# "0<TAB>systemd-sysctl.service", so every lookup missed and the detection was
# inert while looking implemented. Keep the KEY=VALUE form and pair on the keys.
# ENUMERATE, DON'T GLOB. `systemctl show "*.service"` expands against loaded
# units only and returned 25 rows on a fleet with 99 services — every unit it
# omitted was undetectable, which is the silent-blind-spot shape this check
# exists to remove. Feed it the list explicitly.
# PARSE BY BLOCK, NOT BY ORDER. systemd prints `NRestarts=` BEFORE `Id=` in each
# unit's block, so an awk that assumes Id-then-value pairs every unit's count
# with the PREVIOUS unit's name — a silent off-by-one that reported the looping
# vessel as 0 while `systemctl show` on it alone said 29. Blocks are separated by
# a blank line; collect both keys and emit at the boundary, whatever the order.
snapshot_restarts() {
  csh 'systemctl list-units --type=service --all --no-legend --plain 2>/dev/null | awk "{print \$1}" | grep -v "^$" | tr "\n" " " | xargs -r systemctl show --property=Id,NRestarts --no-pager 2>/dev/null' 2>/dev/null \
    | awk -F= '
        /^Id=/{id=$2}
        /^NRestarts=/{n=$2}
        /^[[:space:]]*$/{ if(id!=""){print id "\t" n} ; id=""; n="" }
        END{ if(id!=""){print id "\t" n} }'
}
restarting() { # unit -> 0 if its restart counter moved since the previous pass
  local unit="$1" now prev
  now="$(printf '%s' "$LOOP_CUR" | awk -F'\t' -v U="$unit" '$1==U {print $2}')"
  prev="$(printf '%s' "$LOOP_PREV" | awk -F'\t' -v U="$unit" '$1==U {print $2}')"
  [ -n "$now" ] && [ -n "$prev" ] || return 1
  [ "$now" -gt "$prev" ] 2>/dev/null
}

check_unit() { # unit role port path -> echo status: ok|down|skipped
  local unit="$1" role="$2" port="$3" path="$4" enabled state
  enabled="$(csh "systemctl is-enabled '$unit' 2>/dev/null" 2>/dev/null || true)"
  state="$(csh "systemctl is-active '$unit' 2>/dev/null" 2>/dev/null || true)"
  # Membership: enabled units, OR units running/failed anyway (core units are
  # often 'disabled' by symlink yet pulled in via Requires= from dependents).
  # Skip only what is neither enabled nor present in the live boot.
  case "$enabled" in
    enabled|static|enabled-runtime) ;;
    *)
      case "$state" in
        active|activating|failed) ;;
        *) echo skipped; return ;;
      esac
      ;;
  esac
  # A unit whose ExecCondition said "not here" was SKIPPED, not lost.
  #
  # ExecCondition is how one image serves several topologies: the rendered LLM
  # arms skip when their provider key is absent, and the desktop units (novnc,
  # obsidian-xorg, obsidian-desktop) skip on the base image, which ships none of
  # Xvfb/websockify/obsidian. Such a unit rests `inactive` — indistinguishable
  # from a dead vessel by is-active alone, so all three were reported `down` on a
  # fleet that was working exactly as designed.
  #
  # Ask systemd what it decided rather than inferring from the resting state:
  # ConditionResult=no is its own record that the unit was deliberately not run.
  # The arms escaped this only by not being inventory-named, which is the very
  # gap the inventory grew these entries to close.
  if [ "$(csh "systemctl show '$unit' -p ConditionResult --value 2>/dev/null" 2>/dev/null || true)" = "no" ]; then
    echo skipped; return
  fi
  if [ -n "$port" ]; then
    if csh "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:$port$path 2>/dev/null" 2>/dev/null | grep -q '^200$'; then
      echo ok
    else
      echo down
    fi
    return
  fi
  case "$unit" in
    *.timer) [ "$state" = "active" ] && echo ok || echo down; return ;;
  esac
  # Oneshots: a completed run is INACTIVE, and inactive is the healthy resting
  # state — only 'failed' is unhealthy.
  #
  # ASK SYSTEMD, don't infer. The tempting rule is "the inventory names a
  # sibling <unit>.timer, so it is timer-driven and may rest" — and it is wrong
  # on the one case that matters: boredom-vessel.service is Type=simple with
  # Restart=always AND has a timer, so that rule would have quietly stopped
  # checking a long-running vessel. Type= is the actual property being relied
  # on, so read it.
  #
  # This became load-bearing when the inventory grew the .service half of every
  # timer pair (naming them is what lets a role govern them at all). Each one
  # landed in a liveness check it can never pass, and a readiness gate that
  # fails on healthy units gets ignored — worse than having no gate.
  local utype
  utype="$(csh "systemctl show '$unit' -p Type --value 2>/dev/null" 2>/dev/null || true)"
  if [ "$role" = "seed" ] || [ "$utype" = "oneshot" ]; then
    # A RESTART LOOP IS NOT A HEALTHY REST. `is-failed` answers `active` or
    # `activating` for a unit that is dying and being restarted, so a looping
    # seeder was reported `ok` and the fleet `ready` while it cycled about once
    # every 20 seconds. Measured on a spoke whose hub rejected its key:
    # bootstrap-seeder NRestarts 2 -> 4 across a 41s window, `[ready] fleet ready`
    # printed throughout.
    #
    # Compare against the PREVIOUS pass, never against zero: NRestarts is
    # cumulative for the boot, so a unit that recovered once at startup would be
    # condemned forever by an absolute test. LOOP_PREV is populated by the poll
    # loop below; on the first pass there is no baseline and only `failed` counts.
    if [ "$(csh "systemctl is-failed '$unit' 2>/dev/null" 2>/dev/null || true)" = "failed" ]; then echo down; return; fi
    if restarting "$unit"; then echo down; return; fi
    echo ok
    return
  fi
  if [ "$state" = "active" ] && restarting "$unit"; then echo down; return; fi
  [ "$state" = "active" ] && echo ok || echo down
}

pass() { # -> sets RESULTS (unit|status lines), FAILING count
  RESULTS=""; FAILING=0
  # Roll the previous pass's restart counters forward as this pass's baseline.
  LOOP_PREV="$LOOP_CUR"; LOOP_CUR="$(snapshot_restarts)"
  while IFS='|' read -r unit role port path core; do
    [ "$unit" = "substrate-ready.service" ] && continue  # never gate on self
    [ "$SERVICES_ONLY" = 1 ] && [ "${unit%.timer}" != "$unit" ] && continue
    [ "$QUICK" = 1 ] && [ "$core" != "true" ] && continue
    s="$(check_unit "$unit" "$role" "$port" "$path")"
    RESULTS="${RESULTS}${unit}|${s}
"
    [ "$s" = "down" ] && FAILING=$((FAILING+1))
  done < <(rows)
}

deadline=$(( $(date +%s) + TIMEOUT ))
# A SINGLE PASS CANNOT SEE A LOOP. Restart detection is a delta, so --once (which
# the Dockerfile HEALTHCHECK and substrate-doctor both use) needs a baseline pass
# before the pass whose verdict it reports. Two samples a few seconds apart cost
# a few seconds and are the difference between "fleet ready" and the truth about
# a unit cycling every twenty. --quick keeps its single pass: it gates container
# health on core liveness and must stay fast.
LOOP_WINDOW="${READY_LOOP_WINDOW:-25}"
if [ "$ONCE" = 1 ] && [ "$QUICK" != 1 ]; then
  pass                    # baseline — verdict discarded, restart counters retained
  # The window must exceed one restart cycle or the delta is zero and the loop
  # reads as healthy. A measured seeder loop cycled about every 20s, so a 5s
  # window saw no change and reported `ok` — the very false green this detects.
  # Overridable for tests; do not shorten it to make a check feel faster.
  sleep "$LOOP_WINDOW"
fi
while :; do
  pass
  [ "$FAILING" = 0 ] && break
  [ "$ONCE" = 1 ] && break
  [ "$(date +%s)" -ge "$deadline" ] && break
  sleep 3
done

if [ "$JSON" = 1 ]; then
  printf '%s' "$RESULTS" | jq -R -s '
    split("\n") | map(select(length>0) | split("|") | {unit: .[0], status: .[1]})
    | {ready: (map(select(.status=="down")) | length == 0), vessels: .}'
else
  printf '%s' "$RESULTS" | while IFS='|' read -r unit s; do
    [ -n "$unit" ] || continue
    printf '%-45s %s\n' "$unit" "$s"
  done
  if [ "$FAILING" = 0 ]; then echo "[ready] fleet ready"; else echo "[ready] NOT ready: $FAILING unit(s) down" >&2; fi
fi
[ "$FAILING" = 0 ]
