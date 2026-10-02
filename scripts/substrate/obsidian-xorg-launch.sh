#!/usr/bin/env bash
# obsidian-xorg-launch.sh — the persistent display stack for the in-container
# Obsidian desktop: virtual X server + window manager + VNC export.
#
# Deliberately SEPARATE from obsidian-desktop.service so that reloading the
# obsidian-vessel plugin (restart-obsidian-vessel) restarts ONLY Obsidian inside
# this still-running desktop — the operator's noVNC browser session survives a
# plugin reload instead of dropping.
#
# Xvfb is the foreground/main process; if it dies the unit restarts the stack.
set -uo pipefail

DISPLAY_NUM="${OBSIDIAN_DISPLAY:-:0}"
GEOMETRY="${OBSIDIAN_GEOMETRY:-1600x900x24}"

cleanup() { pkill -P $$ 2>/dev/null || true; }
trap cleanup EXIT

Xvfb "${DISPLAY_NUM}" -screen 0 "${GEOMETRY}" -nolisten tcp &
XVFB_PID=$!

# Wait for the X socket before starting clients.
for _ in $(seq 1 30); do
  [ -S "/tmp/.X11-unix/X${DISPLAY_NUM#:}" ] && break
  sleep 0.5
done

export DISPLAY="${DISPLAY_NUM}"
# Maximize every window to fill the framebuffer — only Obsidian runs on this
# display, so a catch-all rule keeps it edge-to-edge (no offset/clipped window).
mkdir -p "${HOME:-/root}/.fluxbox"
cat > "${HOME:-/root}/.fluxbox/apps" <<'APPS'
[app] (name=.*)
  [Maximized]	{yes}
[end]
APPS
fluxbox >/dev/null 2>&1 &
# -threads enables multithreaded framebuffer encoding (the viewing-latency win
# over the bare default); xdamage region-tracking stays on so only changed rects
# are re-encoded. -nopw is safe: VNC is bound to localhost and only reached via
# the host-mapped noVNC port.
x11vnc -display "${DISPLAY_NUM}" -nopw -forever -shared -rfbport 5900 -bg -quiet -threads

# Keep the unit alive as long as the X server lives.
wait "${XVFB_PID}"
