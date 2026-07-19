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
  /usr/local/bin/apply-inventory || echo "[substrate] apply-inventory failed (keeping all units)"
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

echo "[substrate] handing off to systemd"
exec /lib/systemd/systemd
