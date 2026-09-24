#!/bin/bash
# entrypoint.sh — substrate container entry point
# Generates env file from container env vars, then execs systemd as PID 1.
#
# With a tool name as its first argument it runs that tool instead and exits,
# so the image itself answers `docker run --rm <image> manifest` without an
# --entrypoint override:
#   manifest  print the launch manifest (substrate-manifest)
#   status    the readiness verdict (substrate-status)
#   connect   the client configuration (substrate-connect)
# Nothing else is touched on that path: no env file, no volume, no systemd.
# Any other argument, or none, boots the fleet exactly as before.
set -euo pipefail

case "${1:-}" in
  manifest|status|connect)
    _cmd="$1"
    _tool="/usr/local/bin/substrate-$_cmd"
    shift
    if [ ! -x "$_tool" ]; then
      echo "[substrate] $(basename "$_tool") is not in this image revision; pull a newer image to use '$_cmd'." >&2
      exit 127
    fi
    exec "$_tool" "$@"
    ;;
esac

echo "[substrate] generating /etc/substrate/env"
/usr/local/bin/gen-env

# Fleet definition lives in the VOLUME (substrate-writable — the substrate can
# alter its own membership); the image ships defaults. First boot copies them
# in; later boots keep the volume copies authoritative. Readiness, doctor,
# self-recovery, pull-sync and vessel-ctl all prefer $FLEET_DIR.
FLEET_DIR=/workspace/substrate/fleet
mkdir -p "$FLEET_DIR"
for f in vessels.inventory.json vessels.manifest.json; do
  if [ ! -f "$FLEET_DIR/$f" ] && [ -f "/usr/local/share/substrate/$f" ]; then
    cp "/usr/local/share/substrate/$f" "$FLEET_DIR/$f"
    echo "[substrate] seeded $FLEET_DIR/$f from image default"
  fi
done

# Select which vessel units run (subset support). Reads /etc/substrate/env for
# ENABLED_ROLES / ENABLED_VESSELS / DISABLED_VESSELS. Default = keep everything.
if [ -x /usr/local/bin/apply-inventory ]; then
  echo "[substrate] applying vessel inventory selection"
  # shellcheck disable=SC1091
  set -a; . /etc/substrate/env 2>/dev/null || true; set +a
  # ★ FAIL-OPEN IS ONLY SAFE WHEN NOTHING WAS ASKED FOR.
  #
  # apply-inventory exits 1 on an unrecognised PROFILE / ENABLED_ROLES token —
  # a guard added precisely so a typo could not silently change the fleet. This
  # line then swallowed it into "keeping all units", which is the WORST possible
  # response: the operator asked for a subset, and the substrate answers by
  # enabling EVERYTHING the image bakes in. `ENABLED_ROLES=spok` does not get you
  # a spoke minus a typo; it gets you a full node running the LLM arms, the
  # autonomy timers and the trace store you deliberately excluded — the exact
  # outcome the guard exists to prevent, defeated one layer above it.
  #
  # So: fail-open ONLY when no selection was requested (a bare `docker run`,
  # where "run everything" IS the intent). If any selection knob is set, a
  # failure to apply it aborts the boot — a container that will not start is
  # diagnosable; one silently running the wrong fleet is not.
  if ! /usr/local/bin/apply-inventory; then
    if [ -n "${PROFILE:-}${ENABLED_ROLES:-}${ENABLED_VESSELS:-}${ENABLED_EXTRA_VESSELS:-}${DISABLED_VESSELS:-}" ]; then
      echo "[substrate] FATAL: apply-inventory failed while a vessel selection was requested." >&2
      echo "[substrate] FATAL: PROFILE='${PROFILE:-}' ENABLED_ROLES='${ENABLED_ROLES:-}' ENABLED_VESSELS='${ENABLED_VESSELS:-}' ENABLED_EXTRA_VESSELS='${ENABLED_EXTRA_VESSELS:-}' DISABLED_VESSELS='${DISABLED_VESSELS:-}'" >&2
      echo "[substrate] FATAL: refusing to boot the full baked fleet in place of the requested subset. Fix the selection (see the error above) and restart." >&2
      exit 1
    fi
    echo "[substrate] apply-inventory failed; no selection was requested, so keeping all units (default topology)"
  fi
fi

# Reconcile durable dynamic membership. Units rendered by `vessel-ctl install`
# live in /etc/systemd/system — container filesystem, NOT a volume — so a
# recreate silently drops every installed unit while the manifest and sources
# (volumes) survive; the 2026-09-21 lifecycle audit measured exactly this
# ("manifest and source persist, but generated service unit disappears").
# installed.json is the volume-backed desired-membership record vessel-ctl
# maintains on install/uninstall; re-install its members on every boot.
# Idempotent for an already-present unit; DISABLED_VESSELS outranks the record,
# same as the federation auto-enable below.
set -a; . /etc/substrate/env 2>/dev/null || true; set +a
if [ -f "$FLEET_DIR/installed.json" ] && [ -x /usr/local/bin/vessel-ctl ] && command -v jq >/dev/null 2>&1; then
  _dis=",$(echo "${DISABLED_VESSELS:-}" | tr -d '[:space:]'),"
  for _v in $(jq -r '.installed[]? // empty' "$FLEET_DIR/installed.json" 2>/dev/null); do
    case "$_dis" in
      *,"$_v.service",*|*,"$_v",*)
        echo "[substrate] installed.json: $_v is in DISABLED_VESSELS — restore skipped" ;;
      *)
        if [ ! -f "/etc/systemd/system/$_v.service" ]; then
          echo "[substrate] installed.json: restoring dynamic vessel $_v"
          /usr/local/bin/vessel-ctl install "$_v" || \
            echo "[substrate] installed.json: restore of $_v failed — see the line above; boot continues"
          # vessel-ctl's `systemctl enable --now` no-ops pre-systemd; the offline
          # wants-symlink makes boot-start deterministic (same pattern as the
          # federation auto-enable below).
          if [ -f "/etc/systemd/system/$_v.service" ]; then
            mkdir -p /etc/systemd/system/multi-user.target.wants
            ln -sf "../$_v.service" "/etc/systemd/system/multi-user.target.wants/$_v.service"
          fi
        fi
        ;;
    esac
  done
fi

# Point-and-go spoke federation (folds the former manual spoke-federate.sh into boot):
# when this container is a spoke — HUB_DISCOVERY_URL is derived from DISCOVERY_ENDPOINT
# by gen-env — render + boot-enable the federation-transport-vessel so ingress/egress
# fall out of the discovery anchor alone. The transport self-derives its relay from
# ${HUB_DISCOVERY_URL}/bootstrap and its peer id from FED_VESSEL_ID (both set by gen-env),
# so no RELAY_MULTIADDR / FED_* need be supplied. Spoke-only: a plain root never starts
# it (no crash loop), and a failed transport unit never blocks the rest of the boot.
set -a; . /etc/substrate/env 2>/dev/null || true; set +a
# PEER_MULTIADDR is the multiaddr-only join: a substrate handed nothing but a peer
# multiaddr has no HUB_DISCOVERY_URL to gate on, but it needs the transport MORE than a
# URL-joined spoke does — the transport is the only thing that can reach that peer at all,
# because the anchor names a peer identity rather than a host with an HTTP endpoint.
# DISABLED_VESSELS outranks the auto-enable. This block used to run
# unconditionally on every spoke, so a deployment that explicitly said
# DISABLED_VESSELS=federation-transport-vessel.service got the unit anyway —
# selection could not say no to it, because manifest units sit outside
# apply-inventory's loop and this auto-enable ran after it. Measured
# 2026-09-15 (validation/reports/wiring-green-vs-miswired-proof): the unit
# came up, crash-looped against a hub with no relay, and was the only red on
# an otherwise-green fleet the operator had deliberately composed without it.
_ftv_disabled=0
case ",$(echo "${DISABLED_VESSELS:-}" | tr -d '[:space:]')," in
  *,federation-transport-vessel.service,*|*,federation-transport-vessel,*) _ftv_disabled=1 ;;
esac
if [ "$_ftv_disabled" = 1 ]; then
  echo "[substrate] spoke federation: federation-transport-vessel is in DISABLED_VESSELS — auto-enable skipped"
elif { [ -n "${HUB_DISCOVERY_URL:-}" ] || [ -n "${PEER_MULTIADDR:-}" ]; } && [ -x /usr/local/bin/vessel-ctl ]; then
  echo "[substrate] spoke federation: enabling federation-transport-vessel (hub=${HUB_DISCOVERY_URL:-none} peer_multiaddr=${PEER_MULTIADDR:-none})"
  # DO NOT DISCARD THIS OUTPUT. It used to be `>/dev/null 2>&1 || true`, and that
  # redirect hid the single most useful line in the whole boot: the install failed
  # with "WORKDIR ABSENT (/workspace/git/super-repo/scripts/substrate/federation-relay)
  # — dependencies NOT installed", because the clone does not exist yet at this point.
  # The operator-visible symptom was a container that booted healthy, reported
  # substrate-ready, and federated with nobody — with the cause already computed and
  # thrown away. The unit now runs from the image path so the race is gone, but the
  # output stays: a swallowed install error is how this went unnoticed for an entire
  # development arc, and `|| true` keeps boot non-fatal without keeping it silent.
  /usr/local/bin/vessel-ctl install federation-transport-vessel || \
    echo "[substrate] spoke federation: vessel-ctl install returned $? — transport may not start; see the line above for the reason"
  # vessel-ctl's `systemctl enable --now` no-ops pre-systemd; make boot-start deterministic
  # with an offline wants-symlink (the unit is WantedBy=multi-user.target).
  if [ -f /etc/systemd/system/federation-transport-vessel.service ]; then
    mkdir -p /etc/systemd/system/multi-user.target.wants
    ln -sf ../federation-transport-vessel.service \
      /etc/systemd/system/multi-user.target.wants/federation-transport-vessel.service
  fi
fi

# Hub-side federation: ENABLED_ROLES=hub promises "spokes can join me", and that
# promise has two runtime halves the role selection alone cannot deliver, because
# both units are manifest-installed (outside apply-inventory's loop):
#   - federation-relay: the reachability anchor every spoke circuit rides. Without
#     it a joining spoke's transport has nothing to dial and /bootstrap advertises
#     an empty relay list.
#   - federation-transport-vessel: already auto-enabled by the block above, since
#     gen-env now self-anchors a hub (HUB_DISCOVERY_URL=localhost) — without it the
#     hub can SEE mirrored spoke rows and cannot dial them (forward_failed).
# Both were manual interventions in the 2026-09-16 network demo
# (validation/reports/network-demo); this block moves deploy-hub.sh's knowledge
# into the boot path. DISABLED_VESSELS still outranks, same as the transport.
#
# PROFILE=hub and PROFILE=hub-minimal carry the same promise, and are the form
# the install contract uses: the relay runs in the container, listens on 30333
# there, and announces the host port the launch manifest publishes it on
# (RELAY_ANNOUNCE_PORT, derived by gen-env) — so /bootstrap advertises an address
# a spoke can actually dial, with no relay process on the host.
_frl_disabled=0
case ",$(echo "${DISABLED_VESSELS:-}" | tr -d '[:space:]')," in
  *,federation-relay.service,*|*,federation-relay,*) _frl_disabled=1 ;;
esac
case ",$(echo "${ENABLED_ROLES:-}" | tr -d '[:space:]'),:${PROFILE:-}" in
  *,hub,*|*:hub|*:hub-minimal)
    if [ "$_frl_disabled" = 1 ]; then
      echo "[substrate] hub federation: federation-relay is in DISABLED_VESSELS — auto-enable skipped"
    elif [ -x /usr/local/bin/vessel-ctl ]; then
      echo "[substrate] hub federation: enabling federation-relay (the reachability anchor spokes dial)"
      /usr/local/bin/vessel-ctl install federation-relay || \
        echo "[substrate] hub federation: vessel-ctl install returned $? — relay may not start; see the line above for the reason"
      if [ -f /etc/systemd/system/federation-relay.service ]; then
        mkdir -p /etc/systemd/system/multi-user.target.wants
        ln -sf ../federation-relay.service \
          /etc/systemd/system/multi-user.target.wants/federation-relay.service
      fi
    fi
    ;;
esac

# LLM arm fleet: render one unit per declared arm (llm-arms.json / LLM_ARMS env)
# via render-llm-arms.sh, then boot-enable the rendered llm-<id>.service units.
# Fail-open: no renderer found => skip (the static opus/haiku/google units still
# run — parallel-run migration; retiring them is a later change). Enable mirrors
# the federation-transport pattern above: `systemctl enable --now` no-ops
# pre-systemd, so boot-start is made deterministic with offline wants-symlinks
# (the rendered units are WantedBy=multi-user.target).
# LLM arm fleet: render the declarative arms, retire the static units they
# supersede, and enable exactly the set this selection asks for. The logic lives
# in apply-llm-arms.sh because `vessel-ctl apply` runs the SAME code at runtime —
# two copies would drift, and the boot copy being the only one is precisely why
# changing which arms run used to require a container restart.
#
# No RELOAD here: systemd is not running yet, so the wants-symlinks this writes
# ARE the instruction. Fail-open — a renderer problem must not block the boot.
APPLY_ARMS=""
for c in /usr/local/bin/apply-llm-arms \
         /usr/local/share/substrate/super-repo/scripts/substrate/apply-llm-arms.sh \
         "$(dirname "$0")/apply-llm-arms.sh"; do
  if [ -x "$c" ]; then APPLY_ARMS="$c"; break; fi
done
if [ -n "$APPLY_ARMS" ]; then
  "$APPLY_ARMS" || echo "[substrate] apply-llm-arms failed (continuing boot)"
else
  echo "[substrate] apply-llm-arms not found — skipping LLM arm setup"
fi

echo "[substrate] handing off to systemd"
exec /lib/systemd/systemd
