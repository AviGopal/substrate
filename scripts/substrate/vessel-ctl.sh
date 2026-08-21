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
# OPERATOR-runnable (docker exec <container> vessel-ctl install/uninstall) AND
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

# Bare invocation must print a usage line an operator can act on. `${1:?...}`
# prefixed it with bash's own "line 51: 1:" noise and named the SOURCE file
# (vessel-ctl.sh) rather than the installed tool (vessel-ctl) — and its verb list
# omitted `start` and `stop`, the two verbs the docs prescribe for recovering a
# unit that `apply` masked. Print it ourselves so the text is exactly what ships.
if [ $# -eq 0 ]; then
  echo "usage: vessel-ctl <list|status|restart|start|stop|logs|install|uninstall|sync|deregister|apply|drift> [vessel] [--container NAME] [-n LINES]" >&2
  exit 1
fi
ACTION="$1"
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
    # A BAKED vessel is not in the manifest, but it still has a clone and a unit,
    # so refusing it contradicted the surface's "any unit, baked or manifest"
    # contract. Only refuse a name this fleet has neither an entry NOR a unit for.
    if ! entry >/dev/null 2>&1; then
      if ! csh "systemctl cat '$VESSEL.service' >/dev/null 2>&1"; then
        echo "{\"ok\":false,\"action\":\"sync\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\",\"error\":\"no manifest entry and no unit '$VESSEL.service' in this fleet — try: vessel-ctl status\"}"; exit 1
      fi
    fi
    csh "cd '$CLONE_DIR/$VESSEL' 2>/dev/null && GIT_TERMINAL_PROMPT=0 git pull --ff-only -q origin dev" || true
    csh "/usr/local/bin/mirror-to-live '$VESSEL' '$CLONE_DIR'" || { echo "{\"ok\":false,\"error\":\"mirror failed\"}"; exit 1; }
    csh "systemctl restart $VESSEL.service" >/dev/null 2>&1 || true
    active=$(csh "systemctl is-active '$VESSEL.service' 2>/dev/null || true" 2>/dev/null | head -n1)
    active=${active:-unknown}
    echo "{\"ok\":true,\"action\":\"synced\",\"vessel\":\"$VESSEL\",\"active\":\"$active\"}"
    ;;

  deregister)
    # The last verb still faking success on a typo. `deregister nosuchvessel-xyz`
    # printed {"ok":true,"action":"deregistered"} and exited 0 — measured against
    # a positive control on the same fleet, where the real name emitted
    # "[discovery-deregister] removed concept-db-local" and the typo emitted
    # nothing, yet both reported ok:true. Two causes, both fixed here: no
    # existence check, and `|| true` swallowing the tool's exit status.
    [ -n "$VESSEL" ] || { echo "{\"ok\":false,\"error\":\"usage: vessel-ctl deregister <vessel>\"}"; exit 1; }
    if ! csh "systemctl cat '$(unit_of "$VESSEL")' >/dev/null 2>&1" 2>/dev/null; then
      echo "{\"ok\":false,\"error\":\"no such unit '$(unit_of "$VESSEL")' in this fleet — try: vessel-ctl status\"}"; exit 1
    fi
    if ! csh "/usr/local/bin/discovery-deregister '$VESSEL'"; then
      echo "{\"ok\":false,\"action\":\"deregister\",\"vessel\":\"$VESSEL\",\"error\":\"discovery-deregister failed\"}"; exit 1
    fi
    echo "{\"ok\":true,\"action\":\"deregistered\",\"vessel\":\"$VESSEL\"}"
    ;;

  uninstall)
    [ -n "$VESSEL" ] || { echo "{\"ok\":false,\"error\":\"usage: vessel-ctl uninstall <vessel>\"}"; exit 1; }
    # Reporting ok:true for a vessel that exists NOWHERE turned a typo into a
    # silent no-op that read as a successful removal. Require the name to be
    # real — a manifest entry or an installed unit — before claiming to remove it.
    if ! entry >/dev/null 2>&1; then
      if ! csh "test -f /etc/systemd/system/$VESSEL.service"; then
        echo "{\"ok\":false,\"action\":\"uninstall\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\",\"error\":\"no manifest entry and no installed unit '$VESSEL.service' — nothing to uninstall\"}"; exit 1
      fi
      echo "{\"warn\":\"'$VESSEL' not in manifest; removing its installed unit anyway\"}" >&2
    fi
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
    # A MASKED unit cannot be restarted: systemd refuses, the old process keeps
    # running, and `is-active` still says `active` — so reporting on is-active
    # alone returned ok:true for a restart that never happened. Refuse up front.
    if [ "$(csh "systemctl is-enabled '$U' 2>&1" | head -1)" = masked ]; then
      echo "{\"ok\":false,\"action\":\"restart\",\"vessel\":\"$VESSEL\",\"unit\":\"$U\",\"container\":\"$CONTAINER\",\"error\":\"unit is MASKED — the current vessel selection excludes it, so systemd will refuse. Change the selection and run 'vessel-ctl apply', or unmask it deliberately.\"}"; exit 1
    fi
    # MainPID is the discriminator, not is-active: an unchanged PID means the
    # restart did not happen however healthy the state string looks.
    PID0="$(csh "systemctl show '$U' -p MainPID --value 2>/dev/null" | head -1)"
    RERR="$(csh "systemctl restart '$U' 2>&1" | head -3)"
    ST="$(csh "systemctl is-active '$U' 2>&1" | head -1)"
    NR="$(csh "systemctl show '$U' -p NRestarts --value 2>/dev/null" | head -1)"
    PID1="$(csh "systemctl show '$U' -p MainPID --value 2>/dev/null" | head -1)"
    # `active` is not proof of health: a unit in a Restart= loop reports
    # `activating` forever and NEVER `failed`, so NRestarts is reported next to
    # it — a climbing count is the only cheap tell for that state.
    OK=false; [ "$ST" = active ] && [ "$PID1" != "$PID0" ] && OK=true
    if [ "$OK" = true ]; then
      echo "{\"ok\":true,\"action\":\"restart\",\"vessel\":\"$VESSEL\",\"unit\":\"$U\",\"container\":\"$CONTAINER\",\"active\":\"$ST\",\"mainpid\":\"$PID1\",\"nrestarts\":\"${NR:-0}\"}"
    else
      echo "{\"ok\":false,\"action\":\"restart\",\"vessel\":\"$VESSEL\",\"unit\":\"$U\",\"container\":\"$CONTAINER\",\"active\":\"$ST\",\"mainpid_before\":\"$PID0\",\"mainpid_after\":\"$PID1\",\"nrestarts\":\"${NR:-0}\",\"error\":\"$(printf '%s' "${RERR:-restart did not take: MainPID unchanged}" | tr -d '\"' | tr '\n' ' ')\"}"
      exit 1
    fi
    ;;

  start|stop)
    # `apply` can mask a unit the selection no longer wants, and a masked unit
    # cannot be restarted — without these verbs the documented surface could
    # take a vessel out of service and then not act on it at all.
    [ -n "$VESSEL" ] || { echo "{\"ok\":false,\"error\":\"usage: vessel-ctl $ACTION <vessel>\"}"; exit 1; }
    U="$(unit_of "$VESSEL")"
    if ! csh "systemctl cat '$U' >/dev/null 2>&1"; then
      echo "{\"ok\":false,\"action\":\"$ACTION\",\"vessel\":\"$VESSEL\",\"container\":\"$CONTAINER\",\"error\":\"no such unit '$U' in this fleet — try: vessel-ctl status\"}"; exit 1
    fi
    ERR="$(csh "systemctl $ACTION '$U' 2>&1" | head -3)"
    ST="$(csh "systemctl is-active '$U' 2>&1" | head -1)"
    case "$ACTION:$ST" in
      start:active|stop:inactive|stop:failed) OK=true ;;
      *) OK=false ;;
    esac
    echo "{\"ok\":$OK,\"action\":\"$ACTION\",\"vessel\":\"$VESSEL\",\"unit\":\"$U\",\"container\":\"$CONTAINER\",\"active\":\"$ST\"$( [ "$OK" = false ] && printf ',"error":"%s"' "$(printf '%s' "${ERR:-did not reach the expected state}" | tr -d '"' | tr '\n' ' ')" )}"
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
      # MASKED AND STATIC UNITS ARE PRINTED — they used to be dropped here, and
      # the fleet view hid exactly the units an operator must act on.
      #
      #   masked: after `apply` masked seven vessels, `status` went 43 -> 25 lines
      #     and activity-api/surrealdb/identity-vessel/concept-db/valkey/llm-opus/
      #     llm-haiku VANISHED — no row, no count — while the doc's instruction
      #     after an apply is "Confirm with `vessel-ctl status`". `status <name>`
      #     showed the masked row all along, proving it was a filter and not a
      #     vocabulary gap.
      #   static: the comment here claimed a substrate vessel "declares [Install]
      #     WantedBy and so is enabled or disabled, never static". Measured false —
      #     self-recovery, autonomy-metrics and light-dispatch-healthcheck are
      #     static (they are TIMER-triggered, so they carry no [Install]), and they
      #     are the liveness watchdogs. They were armed, firing, and invisible.
      #
      # Debian's own statics are still excluded, by inventory membership rather
      # than by state: a unit the fleet inventory names is ours and is shown.
      csh "_inv=\$(jq -r '.vessels[].unit' /workspace/substrate/fleet/vessels.inventory.json 2>/dev/null \
                   || jq -r '.vessels[].unit' /usr/local/share/substrate/vessels.inventory.json 2>/dev/null || true)
           systemctl list-units --type=service --all --no-legend --no-pager 2>/dev/null \
           | sed 's/^[^a-zA-Z]*//' | awk '{print \$1}' \
           | grep -vE '^(systemd|dbus|getty|console-|user@|user-|modprobe|e2scrub|autovt|container-getty)' \
           | grep -v '@' | sort -u | while read -r u; do
               e=\$(systemctl is-enabled \"\$u\" 2>&1)
               # not-found units (systemd lists a referenced-but-absent unit like
               # auditd/syslog/connman) answer with an error sentence, not a state.
               case \"\$e\" in *'No such file'*|*Failed*) continue;; esac
               case \"\$e\" in generated|transient|indirect) continue;; esac
               # static is Debian's default for units with no [Install]; keep it
               # only when the inventory names the unit as ours.
               if [ \"\$e\" = static ] && ! echo \"\$_inv\" | grep -qx \"\$u\"; then continue; fi
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
    # ★ CONVERGE THE RUNNING STATE, not just the symlinks.
    #
    # apply-inventory manipulates enable/mask symlinks; on a RUNNING fleet that
    # changes nothing by itself — a unit it just masked keeps running, and one it
    # just enabled stays down until the next boot. That left `apply` doing
    # exactly half its job: `status` still showed the old world, which is the
    # very "propagated but not applied" gap this verb exists to close.
    echo "[apply] converging running state"
    csh "
      systemctl list-units --type=service --all --no-legend --no-pager 2>/dev/null \
      | sed 's/^[^a-zA-Z]*//' | awk '{print \$1}' \
      | grep -vE '^(systemd|dbus|getty|console-|user@|user-|modprobe|e2scrub|autovt|container-getty)' \
      | grep -v '@' | sort -u | while read -r u; do
          e=\$(systemctl is-enabled \"\$u\" 2>&1); a=\$(systemctl is-active \"\$u\" 2>&1)
          case \"\$e\" in
            masked)
              [ \"\$a\" = active ] || [ \"\$a\" = activating ] && \
                systemctl stop \"\$u\" >/dev/null 2>&1 && echo \"[apply] stopped \$u (masked by this selection)\" ;;
            enabled)
              # Only start plain services. A timer-triggered unit must fire on
              # its schedule, and starting it here turns every periodic tick
              # into a startup job.
              if [ \"\$a\" = inactive ] && [ ! -f \"/etc/systemd/system/\${u%.service}.timer\" ] \
                 && [ ! -f \"/lib/systemd/system/\${u%.service}.timer\" ]; then
                systemctl start \"\$u\" >/dev/null 2>&1 && echo \"[apply] started \$u (enabled by this selection)\"
              fi ;;
          esac
        done" 2>&1
    # NO `| head -40`. The doc's promise is that "an apply that prints no action
    # lines is a genuine no-op rather than a silent failure" — a head that
    # amputates the action log breaks exactly that reading, and a large role
    # switch (a spoke->full recovery touches 21+ units) is precisely when the
    # tail matters most. Same class as the `tail -20` that made drift under-report.
    echo "{\"ok\":true,\"action\":\"apply\",\"container\":\"$CONTAINER\",\"note\":\"selection re-applied and running state converged; run 'vessel-ctl status' to confirm\"}"
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
    # NO `| tail -20`. The truncation was biased in the worst possible direction:
    # unmask lines cluster EARLY (inventory order) and disable lines dominate the
    # tail, so the preview systematically dropped the restorative half with no
    # "…N more" marker. Measured from a spoke-masked fleet: drift predicted 2
    # unmasks, apply performed 21 — and the two shown were exactly the last two
    # lines of the untruncated 73-line report.
    csh "set -a; . /etc/substrate/env 2>/dev/null || true; set +a
         DRY_RUN=1 /usr/local/bin/apply-inventory 2>&1"
    ;;

  *) echo "{\"ok\":false,\"error\":\"unknown action '$ACTION' (list|status|restart|start|stop|logs|install|uninstall|sync|deregister|apply|drift)\"}"; exit 1;;
esac
