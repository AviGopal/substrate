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

echo "[substrate] handing off to systemd"
exec /lib/systemd/systemd
