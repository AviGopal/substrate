#!/usr/bin/env bash
# vessel-ctl.sh — install / uninstall / sync / list dynamic vessels.
#
# ONE method for attaching/detaching a vessel, driven by the declarative
# vessels.manifest.json (volume copy at /workspace/substrate/fleet/ preferred).
# SELF-CONTAINED (2026-07-02): runs natively IN-CONTAINER (where it ships at
# /usr/local/bin/vessel-ctl) or from a host (docker exec hop via --container).
# Vessel source comes from the IN-CONTAINER git clones
# (/workspace/git/vessels/<name>, cloned on demand) — never a host checkout,
# never docker cp from a host workspace. Units render via the shared
# render-unit.sh template; self-recovery derives membership from the fleet
# files at read time (no script mutation on install/uninstall).
#
# OPERATOR-runnable (make install-vessel / uninstall-vessel) AND
# ACTIVITY-dispatchable through local-tools-vessel's `shell` resolver
# (clean JSON on stdout, idempotent, no prompts) — the substrate manages its
# own membership.
#
# Usage:
#   vessel-ctl.sh list                    [--container NAME]
#   vessel-ctl.sh install   <vessel>      [--container NAME]
#   vessel-ctl.sh uninstall <vessel>      [--container NAME]
#   vessel-ctl.sh sync      <vessel>      [--container NAME]   # clone -> live runtime + restart
#   vessel-ctl.sh deregister <vessel>     [--container NAME]   # discovery removal only
set -uo pipefail

ACTION="${1:?usage: vessel-ctl.sh <install|uninstall|sync|deregister|list> [vessel] [--container NAME]}"
VESSEL="${2:-}"
shift || true; shift || true
CONTAINER="substrate-live"
while [[ $# -gt 0 ]]; do case "$1" in --container) CONTAINER="$2"; shift 2;; *) shift;; esac; done

# Dual context: in-container iff no working docker CLI for $CONTAINER.
if command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  IN_CONTAINER=0
else
  IN_CONTAINER=1
fi
csh() { if [ "$IN_CONTAINER" = 1 ]; then bash -c "$1"; else docker exec "$CONTAINER" bash -c "$1"; fi; }

# All manifest reads happen in the container's context (volume copy first).
MANIFEST_PATHS='/workspace/substrate/fleet/vessels.manifest.json /usr/local/share/substrate/vessels.manifest.json'
manifest_json() { csh "for m in $MANIFEST_PATHS; do [ -f \"\$m\" ] && { cat \"\$m\"; exit 0; }; done; echo '{\"vessels\":[]}'"; }
entry() { manifest_json | jq -e --arg n "$VESSEL" '.vessels[] | select(.name==$n)'; }

CLONE_DIR=/workspace/git/vessels
RUNTIME_DIR=/vessels

ensure_clone() { # vessel [repo] -> ensure /workspace/git/vessels/<v> exists (clone on demand)
  local v="$1" repo="${2:-$1}"
  csh "set -e
    [ -d '$CLONE_DIR/$v/.git' ] && exit 0
    set -a; . /etc/substrate/env 2>/dev/null || true; set +a
    OWNER=\"\${SUBSTRATE_REPO_OWNER:-AviGopal}\"
    export GIT_TERMINAL_PROMPT=0
    mkdir -p '$CLONE_DIR'
    git clone -q --branch dev \"https://github.com/\$OWNER/$repo.git\" '$CLONE_DIR/$v'"
}

case "$ACTION" in
  list)
    manifest_json | jq -r '.vessels[].name' | while read -r n; do
      active=$(csh "systemctl is-active '$n.service' 2>/dev/null" 2>/dev/null || echo unknown)
      printf '{"name":"%s","active":"%s"}\n' "$n" "$active"
    done | jq -s '{vessels: .}'
    ;;

  install)
    e=$(entry) || { echo "{\"ok\":false,\"error\":\"vessel '$VESSEL' not in manifest\"}"; exit 1; }

    # 0. Port-collision guard: the manifest port must be unique across fleet files.
    port=$(echo "$e" | jq -r '.health_port // empty')
    if [ -n "$port" ]; then
      clash=$(csh "for f in /workspace/substrate/fleet/vessels.inventory.json /workspace/substrate/fleet/vessels.manifest.json; do [ -f \"\$f\" ] && jq -r --arg v '$VESSEL' '.vessels[] | select((.name // .unit) != \$v and ((.name // .unit) | sub(\"\\\\.service\$|\\\\.timer\$\"; \"\")) != \$v) | .health_port // empty' \"\$f\"; done" | grep -cx "$port" || true)
      if [ "${clash:-0}" -gt 0 ]; then
        echo "{\"ok\":false,\"error\":\"health_port $port already claimed by another fleet entry\"}"; exit 1
      fi
    fi

    # 1. Source: git clone (on demand) — units run from clone/super-repo paths,
    #    or from /vessels/<name> when workdir says $RUNTIME (mirror it first).
    repo=$(echo "$e" | jq -r '.repo // .name')
    workdir_raw=$(echo "$e" | jq -r '.workdir')
    case "$workdir_raw" in
      *'$VESSEL_CLONE'*|*'$RUNTIME'*)
        ensure_clone "$VESSEL" "$repo" || { echo "{\"ok\":false,\"error\":\"clone failed for $repo (PAT/network?)\"}"; exit 1; }
        ;;
      *'$REPO_ROOT'*)
        : # super-repo clone owns it (git-push-setup ensures it at boot)
        ;;
    esac
    if [[ "$workdir_raw" == *'$RUNTIME'* ]]; then
      csh "mkdir -p '$RUNTIME_DIR/$VESSEL'"
      csh "/usr/local/bin/mirror-to-live '$VESSEL' '$CLONE_DIR'" || true
    fi
    # bun install where the unit will run
    wd=$(csh "MITOSIS_PUSH_CLONE_DIR=$CLONE_DIR /usr/local/bin/render-unit '$VESSEL' 2>/dev/null | sed -n 's/^WorkingDirectory=//p'")
    [ -n "$wd" ] && csh "[ -f '$wd/package.json' ] && cd '$wd' && /root/.bun/bin/bun install --silent >/dev/null 2>&1 || true"

    # 2. Ensure declared secrets exist in /etc/substrate/env (single place).
    secs=$(echo "$e" | jq -r '.secrets[]?' | tr '\n' ' ')
    if [[ -n "$secs" ]]; then
      csh "set -a; [ -f /usr/local/share/substrate/secrets.env.sh ] && source /usr/local/share/substrate/secrets.env.sh >/dev/null 2>&1 || true; set +a; \
           for k in $secs; do v=\"\${!k:-}\"; \
             if [ -n \"\$v\" ]; then grep -v \"^\$k=\" /etc/substrate/env > /etc/substrate/env.tmp && mv /etc/substrate/env.tmp /etc/substrate/env; echo \"\$k=\$v\" >> /etc/substrate/env; fi; done"
    fi

    # 3. Render + install the unit via the shared template.
    csh "/usr/local/bin/render-unit '$VESSEL' > /etc/systemd/system/$VESSEL.service"
    csh "systemctl daemon-reload && systemctl enable --now $VESSEL.service" >/dev/null 2>&1 || true

    # 4. Optional post-install hook.
    post=$(echo "$e" | jq -r '.post_install // empty')
    [[ -n "$post" ]] && csh "$post" >/dev/null 2>&1 || true

    active=$(csh "systemctl is-active '$VESSEL.service' 2>/dev/null" 2>/dev/null || echo unknown)
    self_rec=$(echo "$e" | jq -r '.self_recovery // false')
    echo "{\"ok\":true,\"action\":\"installed\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\",\"active\":\"$active\",\"self_recovery\":$self_rec}"
    ;;

  sync)
    entry >/dev/null 2>&1 || { echo "{\"ok\":false,\"error\":\"vessel '$VESSEL' not in manifest\"}"; exit 1; }
    csh "cd '$CLONE_DIR/$VESSEL' 2>/dev/null && GIT_TERMINAL_PROMPT=0 git pull --ff-only -q origin dev" || true
    csh "/usr/local/bin/mirror-to-live '$VESSEL' '$CLONE_DIR'" || { echo "{\"ok\":false,\"error\":\"mirror failed\"}"; exit 1; }
    csh "systemctl restart $VESSEL.service" >/dev/null 2>&1 || true
    active=$(csh "systemctl is-active '$VESSEL.service' 2>/dev/null" 2>/dev/null || echo unknown)
    echo "{\"ok\":true,\"action\":\"synced\",\"vessel\":\"$VESSEL\",\"active\":\"$active\"}"
    ;;

  deregister)
    csh "/usr/local/bin/discovery-deregister '$VESSEL'" || true
    echo "{\"ok\":true,\"action\":\"deregistered\",\"vessel\":\"$VESSEL\"}"
    ;;

  uninstall)
    entry >/dev/null 2>&1 || echo "{\"warn\":\"'$VESSEL' not in manifest; removing unit anyway\"}" >&2
    csh "systemctl disable --now $VESSEL.service 2>/dev/null || true; rm -f /etc/systemd/system/$VESSEL.service; systemctl daemon-reload" >/dev/null 2>&1 || true
    csh "/usr/local/bin/discovery-deregister '$VESSEL'" || true
    echo "{\"ok\":true,\"action\":\"uninstalled\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\"}"
    ;;

  *) echo "{\"ok\":false,\"error\":\"unknown action '$ACTION' (install|uninstall|sync|deregister|list)\"}"; exit 1;;
esac
