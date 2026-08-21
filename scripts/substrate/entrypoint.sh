#!/bin/bash
# entrypoint.sh — substrate container entry point
# Generates env file from container env vars, then execs systemd as PID 1.
set -euo pipefail

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

# Point-and-go spoke federation (folds the former manual spoke-federate.sh into boot):
# when this container is a spoke — HUB_DISCOVERY_URL is derived from DISCOVERY_ENDPOINT
# by gen-env — render + boot-enable the federation-transport-vessel so ingress/egress
# fall out of the discovery anchor alone. The transport self-derives its relay from
# ${HUB_DISCOVERY_URL}/bootstrap and its peer id from FED_VESSEL_ID (both set by gen-env),
# so no RELAY_MULTIADDR / FED_* need be supplied. Spoke-only: a plain root never starts
# it (no crash loop), and a failed transport unit never blocks the rest of the boot.
set -a; . /etc/substrate/env 2>/dev/null || true; set +a
if [ -n "${HUB_DISCOVERY_URL:-}" ] && [ -x /usr/local/bin/vessel-ctl ]; then
  echo "[substrate] spoke federation: enabling federation-transport-vessel (hub=${HUB_DISCOVERY_URL})"
  /usr/local/bin/vessel-ctl install federation-transport-vessel >/dev/null 2>&1 || true
  # vessel-ctl's `systemctl enable --now` no-ops pre-systemd; make boot-start deterministic
  # with an offline wants-symlink (the unit is WantedBy=multi-user.target).
  if [ -f /etc/systemd/system/federation-transport-vessel.service ]; then
    mkdir -p /etc/systemd/system/multi-user.target.wants
    ln -sf ../federation-transport-vessel.service \
      /etc/systemd/system/multi-user.target.wants/federation-transport-vessel.service
  fi
fi

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
