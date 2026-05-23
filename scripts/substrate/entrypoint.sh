#!/bin/bash
# entrypoint.sh — substrate container entry point
# Generates env file from container env vars, then execs systemd as PID 1.
set -euo pipefail

echo "[substrate] generating /etc/substrate/env"
/usr/local/bin/gen-env

echo "[substrate] handing off to systemd"
exec /lib/systemd/systemd
