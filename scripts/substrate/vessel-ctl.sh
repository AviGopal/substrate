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
# THIS IS THE VESSEL MANAGEMENT SURFACE. There is no second one.
#
# It ships in the image, so it works wherever the substrate runs — a laptop, a
# hub, a spoke you reached over ssh — with no checkout and no host tooling. The
# Makefile is the BOOTSTRAP tier only (build / up / recreate): things that must
# happen before a container exists to be talked to. Anything a RUNNING fleet
# does is here.
#
# It replaced ~40 hand-enumerated `make restart-<vessel>` / `logs-<vessel>` /
# `sync-<vessel>` targets that covered 11 of 65 units between them — so the
# common operations were a hardcoded list while the rare ones were generic, and
# `activity-api` (the trace store) had no restart target while `obsidian-vessel`
# did. Every verb below works on ANY unit the fleet has, baked or manifest.
#
# Usage:
#   vessel-ctl.sh list                    [--container NAME]
#   vessel-ctl.sh status    [vessel]      [--container NAME]  # one unit, or the fleet
#   vessel-ctl.sh restart   <vessel>      [--container NAME]
#   vessel-ctl.sh logs      <vessel>      [--container NAME] [-n LINES]
#   vessel-ctl.sh install   <vessel>      [--container NAME]
#   vessel-ctl.sh uninstall <vessel>      [--container NAME]
#   vessel-ctl.sh sync      <vessel>      [--container NAME]  # clone -> live runtime + restart
#   vessel-ctl.sh deregister <vessel>     [--container NAME]  # discovery removal only
#   vessel-ctl.sh apply                   [--container NAME]  # re-apply vessel selection NOW
#   vessel-ctl.sh drift                   [--container NAME]  # inventory vs image vs running
#
# `apply` is the one that closes a long-standing hole: vessel selection used to
# be decided once per boot, so a corrected inventory sat inert in the volume
# while the fleet went on running the old unit set until someone restarted the
# container. `drift` shows you that gap before you close it.
set -uo pipefail

ACTION="${1:?usage: vessel-ctl.sh <list|status|restart|logs|install|uninstall|sync|deregister|apply|drift> [vessel] [--container NAME] [-n LINES]}"
VESSEL="${2:-}"
shift || true; shift || true
CONTAINER="substrate-live"
LINES=50
while [[ $# -gt 0 ]]; do
  case "$1" in
    --container) CONTAINER="$2"; shift 2;;
    -n|--lines)  LINES="$2";     shift 2;;
    *) shift;;
  esac
done

# A vessel is addressed by its unit name; `.service` is implied so an operator
# types what the docs call the vessel, not what systemd calls the file.
unit_of() { case "$1" in *.service|*.timer|*.socket) printf '%s' "$1";; *) printf '%s.service' "$1";; esac; }

# Dual context: in-container iff no working docker CLI for $CONTAINER.
#
# `docker inspect` SUCCEEDS for a container that merely EXISTS, including a
# stopped one — so a stopped target selected the docker-exec path, every csh()
# failed, manifest_json() emitted nothing, and the caller was told
# `vessel '<name>' not in manifest`. That names the wrong cause entirely: the
# manifest is fine and the container is down. Observed 2026-08-19 against a
# container another session had stopped seconds earlier; the misdiagnosis cost a
# whole run. Ask whether it is RUNNING, which is the thing docker exec needs.
if command -v docker >/dev/null 2>&1 \
   && [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ]; then
  IN_CONTAINER=0
elif command -v docker >/dev/null 2>&1 && docker inspect "$CONTAINER" >/dev/null 2>&1; then
  # It exists and is not running. Refusing beats every downstream symptom.
  echo "{\"ok\":false,\"error\":\"container '$CONTAINER' exists but is NOT running — start it before installing vessels\"}"
  exit 1
else
  IN_CONTAINER=1
fi
csh() { if [ "$IN_CONTAINER" = 1 ]; then bash -c "$1"; else docker exec "$CONTAINER" bash -c "$1"; fi; }

# Running INSIDE a container, $CONTAINER is still the "substrate-live" default —
# a name that is simply wrong when the caller is some other fleet. Every reply
# echoed it, so an operator managing a second substrate got output confidently
# naming the production one. Report where the work actually happened.
if [ "$IN_CONTAINER" = 1 ]; then
  CONTAINER="$(cat /etc/hostname 2>/dev/null || hostname 2>/dev/null || echo self)"
fi

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
      # systemctl exits non-zero for an inactive unit, so `|| echo unknown` used to
      # append a second line and the two-line value broke the JSON below.
      active=$(csh "systemctl is-active '$n.service' 2>/dev/null || true" 2>/dev/null | head -n1)
      active=${active:-unknown}
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
    # THIS STEP USED TO BE UNCONDITIONALLY SILENT. `[ -f "$wd/package.json" ] && …
    # || true` short-circuits to true when the workdir does not exist yet, so an
    # install against an absent directory resolved nothing, left an empty
    # node_modules beside a lockfile, and still returned ok:true. The vessel was
    # then enabled and started with no dependencies, and because Restart= re-runs
    # ExecStart and never the install, it crash-looped on a missing module for as
    # long as the container lived — reported by systemd as `activating`, never
    # `failed`. Observed on substrate-ui-local: 1681 restarts over five days.
    #
    # Nothing here is fatal to the install (a vessel with no package.json is
    # normal), but every outcome is now SAID, and a workdir that does not exist is
    # said loudly, because that one means the dependencies silently did not land.
    install_note=""
    if [ -z "$wd" ]; then
      install_note="render-unit produced no WorkingDirectory"
    elif ! csh "[ -d '$wd' ]"; then
      install_note="WORKDIR ABSENT ($wd) — dependencies NOT installed; the unit will start with an empty node_modules"
      echo "{\"warn\":\"$VESSEL: $install_note\"}" >&2
    elif ! csh "[ -f '$wd/package.json' ]"; then
      install_note="no package.json in $wd (nothing to install)"
    elif csh "cd '$wd' && /root/.bun/bin/bun install --silent >/dev/null 2>&1"; then
      install_note="dependencies installed"
    else
      install_note="BUN INSTALL FAILED in $wd"
      echo "{\"warn\":\"$VESSEL: $install_note\"}" >&2
    fi

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

    active=$(csh "systemctl is-active '$VESSEL.service' 2>/dev/null || true" 2>/dev/null | head -n1)
    active=${active:-unknown}
    self_rec=$(echo "$e" | jq -r '.self_recovery // false')
    echo "{\"ok\":true,\"action\":\"installed\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\",\"active\":\"$active\",\"self_recovery\":$self_rec,\"deps\":\"$install_note\"}"
    ;;

  sync)
    entry >/dev/null 2>&1 || { echo "{\"ok\":false,\"error\":\"vessel '$VESSEL' not in manifest\"}"; exit 1; }
    csh "cd '$CLONE_DIR/$VESSEL' 2>/dev/null && GIT_TERMINAL_PROMPT=0 git pull --ff-only -q origin dev" || true
    csh "/usr/local/bin/mirror-to-live '$VESSEL' '$CLONE_DIR'" || { echo "{\"ok\":false,\"error\":\"mirror failed\"}"; exit 1; }
    csh "systemctl restart $VESSEL.service" >/dev/null 2>&1 || true
    active=$(csh "systemctl is-active '$VESSEL.service' 2>/dev/null || true" 2>/dev/null | head -n1)
    active=${active:-unknown}
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

  restart)
    [ -n "$VESSEL" ] || { echo '{"ok":false,"error":"usage: vessel-ctl restart <vessel>"}'; exit 1; }
    U="$(unit_of "$VESSEL")"
    # Refuse a unit the fleet does not have, rather than reporting a cheerful
    # success for a typo — `systemctl restart` on an unknown unit is an error
    # here, but the shape of the reply should say WHICH thing was wrong.
    if ! csh "systemctl cat '$U' >/dev/null 2>&1"; then
      echo "{\"ok\":false,\"action\":\"restart\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\",\"error\":\"no such unit '$U' in this fleet — try: vessel-ctl status\"}"; exit 1
    fi
    csh "systemctl restart '$U'" >/dev/null 2>&1
    ST="$(csh "systemctl is-active '$U' 2>&1" | head -1)"
    NR="$(csh "systemctl show '$U' -p NRestarts --value 2>/dev/null" | head -1)"
    # `active` is not proof of health: a unit in a Restart= loop reports
    # `activating` forever and NEVER `failed`, so NRestarts is reported next to
    # it — a climbing count is the only cheap tell for that state.
    OK=false; [ "$ST" = active ] && OK=true
    echo "{\"ok\":$OK,\"action\":\"restart\",\"vessel\":\"$VESSEL\",\"unit\":\"$U\",\"container\":\"$CONTAINER\",\"active\":\"$ST\",\"nrestarts\":\"${NR:-0}\"}"
    [ "$OK" = true ] || exit 1
    ;;

  logs)
    [ -n "$VESSEL" ] || { echo '{"ok":false,"error":"usage: vessel-ctl logs <vessel> [-n LINES]"}'; exit 1; }
    U="$(unit_of "$VESSEL")"
    if ! csh "systemctl cat '$U' >/dev/null 2>&1"; then
      echo "no such unit '$U' in this fleet — try: vessel-ctl status" >&2; exit 1
    fi
    # Plain text, not JSON: this output is for a human to read.
    csh "journalctl -u '$U' -n '$LINES' --no-pager"
    ;;

  status)
    if [ -n "$VESSEL" ]; then
      U="$(unit_of "$VESSEL")"
      csh "printf '%-38s %-12s %-10s restarts=%s\n' '$U' \"\$(systemctl is-active '$U' 2>&1)\" \"\$(systemctl is-enabled '$U' 2>&1)\" \"\$(systemctl show '$U' -p NRestarts --value)\""
    else
      # Fleet view.
      #
      # Ask SYSTEMD what units it has, not the filesystem what files exist:
      # globbing unit files also returns TEMPLATES (`foo@.service`), which are
      # not units at all and make `systemctl show` fail with "neither a valid
      # invocation ID nor unit name" — one error line per template, drowning the
      # report. list-units --all reports instantiated units only.
      #
      # NRestarts is always shown because a unit in a Restart= loop reports
      # `activating` forever and NEVER `failed`, so it is invisible to any
      # states-only listing. A climbing count is the cheap tell.
      # sed strips systemd's leading '●' failure marker, which is part of the
      # LINE, not the unit name — passed through it becomes its own bogus row
      # ('Invalid unit name "●"'). `static` filters out Debian's own units
      # (fstrim, rescue, apt-daily): a substrate vessel declares [Install]
      # WantedBy and so is enabled or disabled, never static.
      csh "systemctl list-units --type=service --all --no-legend --no-pager 2>/dev/null \
           | sed 's/^[^a-zA-Z]*//' | awk '{print \$1}' \
           | grep -vE '^(systemd|dbus|getty|console-|user@|user-|modprobe|e2scrub|autovt|container-getty)' \
           | grep -v '@' | sort -u | while read -r u; do
               e=\$(systemctl is-enabled \"\$u\" 2>&1)
               # not-found units (systemd lists a referenced-but-absent unit like
               # auditd/syslog/connman) answer with an error sentence, not a state.
               case \"\$e\" in static|masked|generated|transient|indirect|*'No such file'*|*Failed*) continue;; esac
               a=\$(systemctl is-active \"\$u\" 2>&1)
               printf '%-38s %-12s %-10s restarts=%s\n' \"\$u\" \"\$a\" \"\$e\" \"\$(systemctl show \"\$u\" -p NRestarts --value 2>/dev/null)\"
             done | sort -k2,2 -k1,1"
    fi
    ;;

  apply)
    # Re-apply the vessel selection to a RUNNING fleet.
    #
    # apply-inventory decides which units are enabled and runs pre-systemd at
    # boot, so a corrected inventory used to sit inert in the volume — propagated
    # by pull-sync, applied by nobody — until the container was restarted. This
    # makes that a one-command operation instead of a restart decision.
    echo "[apply] re-running vessel selection in $CONTAINER"
    csh "set -a; . /etc/substrate/env 2>/dev/null || true; set +a
         /usr/local/bin/apply-inventory" 2>&1 || {
      echo "{\"ok\":false,\"action\":\"apply\",\"container\":\"$CONTAINER\",\"error\":\"apply-inventory failed — selection unchanged\"}"; exit 1; }
    # The rendered LLM arms are governed by the same selection but are created
    # after apply-inventory under names it never sees, so they need the shared
    # arm pass too. RELOAD=1 because unlike boot, systemd is already up: symlinks
    # alone would change nothing until the next restart, which is the very
    # problem this verb exists to remove.
    csh "RELOAD=1 /usr/local/bin/apply-llm-arms" 2>&1 || echo "[apply] arm pass reported a problem (see above)"
    csh "systemctl daemon-reload" >/dev/null 2>&1
    echo "{\"ok\":true,\"action\":\"apply\",\"container\":\"$CONTAINER\",\"note\":\"selection re-applied; run 'vessel-ctl status' to see the result\"}"
    ;;

  drift)
    # The three copies of the fleet definition and the running set never had a
    # single command that compared them. Volume is authoritative at runtime;
    # image is the build-time default and the fallback when the volume copy is
    # absent; the running set is what is ACTUALLY enabled right now.
    echo "=== inventory: volume (authoritative) vs image (build default) ==="
    csh "if diff -q /workspace/substrate/fleet/vessels.inventory.json \
                    /usr/local/share/substrate/vessels.inventory.json >/dev/null 2>&1; then
           echo 'identical'
         else
           echo 'DIFFERENT — the volume copy is what this fleet obeys:'
           diff /usr/local/share/substrate/vessels.inventory.json \
                /workspace/substrate/fleet/vessels.inventory.json | head -40
         fi"
    echo
    echo "=== selection in force ==="
    csh "grep -E '^(PROFILE|ENABLED_ROLES|ENABLED_VESSELS|ENABLED_EXTRA_VESSELS|DISABLED_VESSELS)=' /etc/substrate/env || echo '(none set — default topology, every baked unit enabled)'"
    echo
    echo "=== would applying that selection now change anything? ==="
    # DRY_RUN so this is a report, never an action. If it names units, the
    # running set has drifted from the selection and `vessel-ctl apply` closes it.
    csh "set -a; . /etc/substrate/env 2>/dev/null || true; set +a
         DRY_RUN=1 /usr/local/bin/apply-inventory 2>&1 | tail -20"
    ;;

  *) echo "{\"ok\":false,\"error\":\"unknown action '$ACTION' (list|status|restart|logs|install|uninstall|sync|deregister|apply|drift)\"}"; exit 1;;
esac
