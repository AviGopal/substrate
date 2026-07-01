#!/usr/bin/env bash
# vessel-ctl.sh — general install / uninstall / list of (dynamic) vessels.
#
# ONE method for adding/removing a vessel from a substrate container, driven by the
# declarative vessels.manifest.json, reusing the same lifecycle the built-in vessels
# use: render a systemd unit (EnvironmentFile=/etc/substrate/env + static Environment
# from the manifest), docker cp it in, daemon-reload, enable/disable, start/stop, and
# (un)register it in self-recovery-tick. Secrets come from the SINGLE place
# (secrets.env.sh → /etc/substrate/env + /workspace/.substrate-secrets).
#
# It is OPERATOR-runnable (make install-vessel / uninstall-vessel) AND
# ACTIVITY-dispatchable: the substrate can invoke it through local-tools-vessel's
# `shell` resolver (clean JSON on stdout, idempotent, no prompts). The same call works
# against another container (--container) — the basis for installing "elsewhere".
#
# Usage:
#   vessel-ctl.sh list [--container substrate-live]
#   vessel-ctl.sh install   <vessel-name> [--container substrate-live]
#   vessel-ctl.sh uninstall <vessel-name> [--container substrate-live]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$REPO_ROOT/scripts/substrate"
MANIFEST="${MANIFEST:-$HERE/vessels.manifest.json}"
CONTAINER="substrate-live"
ACTION="${1:?usage: vessel-ctl.sh <install|uninstall|list> [vessel] [--container NAME]}"
VESSEL="${2:-}"
shift || true; shift || true
while [[ $# -gt 0 ]]; do case "$1" in --container) CONTAINER="$2"; shift 2;; *) shift;; esac; done

dex() { docker exec "$CONTAINER" bash -lc "$1"; }
j() { jq -r "$1" "$MANIFEST"; }
entry() { jq -e --arg n "$VESSEL" '.vessels[] | select(.name==$n)' "$MANIFEST"; }

self_recovery_register() { # name port  (idempotent add to self-recovery-tick VESSELS)
  local n="$1" p="$2" f="$HERE/self-recovery-tick.sh"
  grep -q "\"$n:$p\"" "$f" 2>/dev/null && return 0
  # insert before the closing ) of the VESSELS=( ... ) array
  awk -v entry="  \"$n:$p\"" '
    /^VESSELS=\(/ {invessel=1}
    invessel && /^\)/ {print entry; invessel=0}
    {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}
self_recovery_deregister() { # name
  local n="$1" f="$HERE/self-recovery-tick.sh"
  grep -v "\"$n:[0-9]*\"" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}

case "$ACTION" in
  list)
    echo "{\"vessels\":["
    first=1
    for n in $(j '.vessels[].name'); do
      active=$(docker exec "$CONTAINER" systemctl is-active "$n.service" 2>/dev/null || echo unknown)
      [[ $first == 0 ]] && echo ","; first=0
      printf '  {"name":"%s","active":"%s"}' "$n" "$active"
    done
    echo "]}"
    ;;

  install)
    e=$(entry) || { echo "{\"ok\":false,\"error\":\"vessel '$VESSEL' not in manifest\"}"; exit 1; }
    workdir=$(echo "$e" | jq -r '.workdir' | sed "s#\$REPO_ROOT#$REPO_ROOT#g")
    exec_ts=$(echo "$e" | jq -r '.exec')
    restart=$(echo "$e" | jq -r '.restart // "always"')
    self_rec=$(echo "$e" | jq -r '.self_recovery // false')
    health_port=$(echo "$e" | jq -r '.health_port // empty')
    bun=$(docker exec "$CONTAINER" bash -lc 'command -v bun')

    # 1. Ensure this vessel's declared secrets exist in /etc/substrate/env (single place).
    secs=$(echo "$e" | jq -r '.secrets[]?' | tr '\n' ' ')
    if [[ -n "$secs" ]]; then
      dex "set -a; source '$HERE/secrets.env.sh' >/dev/null 2>&1 || true; set +a; \
           for k in $secs; do v=\"\${!k:-}\"; \
             if [ -n \"\$v\" ]; then grep -v \"^\$k=\" /etc/substrate/env > /etc/substrate/env.tmp && mv /etc/substrate/env.tmp /etc/substrate/env; echo \"\$k=\$v\" >> /etc/substrate/env; fi; done"
    fi

    # 2. Render the systemd unit (EnvironmentFile gives secrets + dynamic env_from_file;
    #    Environment= lines are the manifest's STATIC literals).
    env_lines=$(echo "$e" | jq -r '.env // {} | to_entries[] | "Environment=\(.key)=\(.value)"')
    unit="[Unit]
Description=$(echo "$e" | jq -r '.description // .name')
After=network.target discovery-vessel.service

[Service]
Type=simple
EnvironmentFile=/etc/substrate/env
EnvironmentFile=-/workspace/.substrate-secrets
$env_lines
WorkingDirectory=$workdir
ExecStart=$bun $workdir/$exec_ts
Restart=$restart
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target"
    echo "$unit" | docker exec -i "$CONTAINER" bash -c "cat > /etc/systemd/system/$VESSEL.service"

    # 3. Enable + start.
    dex "systemctl daemon-reload && systemctl enable --now $VESSEL.service" >/dev/null 2>&1 || true

    # 4. Register in self-recovery (if it has a health port + opts in).
    if [[ "$self_rec" == "true" && -n "$health_port" ]]; then self_recovery_register "$VESSEL" "$health_port"; fi

    # 5. Optional post-install hook (e.g. capture a dynamic relay multiaddr into env).
    post=$(echo "$e" | jq -r '.post_install // empty')
    [[ -n "$post" ]] && dex "$post" >/dev/null 2>&1 || true

    active=$(docker exec "$CONTAINER" systemctl is-active "$VESSEL.service" 2>/dev/null || echo unknown)
    echo "{\"ok\":true,\"action\":\"installed\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\",\"active\":\"$active\",\"self_recovery\":$self_rec}"
    ;;

  uninstall)
    entry >/dev/null 2>&1 || echo "{\"warn\":\"'$VESSEL' not in manifest; removing unit anyway\"}" >&2
    dex "systemctl disable --now $VESSEL.service 2>/dev/null || true; rm -f /etc/systemd/system/$VESSEL.service; systemctl daemon-reload" >/dev/null 2>&1 || true
    self_recovery_deregister "$VESSEL"
    echo "{\"ok\":true,\"action\":\"uninstalled\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\"}"
    ;;

  *) echo "{\"ok\":false,\"error\":\"unknown action '$ACTION' (install|uninstall|list)\"}"; exit 1;;
esac
