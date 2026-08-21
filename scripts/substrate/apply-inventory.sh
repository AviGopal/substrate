#!/bin/bash
# apply-inventory.sh — select which vessel units run, from vessels.inventory.json.
#
# Run by entrypoint.sh AFTER gen-env and BEFORE `exec systemd`, so unit selection
# happens offline (systemctl disable just removes the *.wants symlinks the Dockerfile
# created). The image bakes the FULL enable-list; this trims it down to a subset.
#
# Selection (env, highest precedence first):
#   ENABLED_VESSELS=unit,unit   explicit allow-list (exact unit names); overrides roles
#   ENABLED_ROLES=role,role     roles to keep (role-GROUP aliases hub/spoke/full expand
#                               via inventory.roles); everything else is disabled
#   DISABLED_VESSELS=unit,unit  always disabled, even if selected above
# DEFAULT (neither ENABLED_* set) = keep everything = identical to today (no-op).
# DRY_RUN=1 prints the plan without changing anything.
#
# Manifest-installed units (federation-*: "manifest":true) are NOT baked-enabled, so
# they are never disabled here — they're installed on demand via vessel-ctl.sh.
set -euo pipefail

# Prefer the substrate-writable volume copy (seeded by entrypoint) so the
# substrate's own edits to its fleet definition govern boot selection.
INV="${VESSELS_INVENTORY:-/workspace/substrate/fleet/vessels.inventory.json}"
[ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[apply-inventory] $*" >&2; }

if [ ! -f "$INV" ]; then log "no inventory at $INV — keeping all units (no-op)"; exit 0; fi
if ! command -v jq >/dev/null 2>&1; then log "jq missing — keeping all units (no-op)"; exit 0; fi

# No selection env → keep everything.
if [ -z "${PROFILE:-}" ] && [ -z "${ENABLED_VESSELS:-}" ] && [ -z "${ENABLED_ROLES:-}" ] && [ -z "${DISABLED_VESSELS:-}" ]; then
  log "no ENABLED_ROLES/ENABLED_VESSELS/DISABLED_VESSELS set — all units enabled (default)"
  exit 0
fi

csv() { echo "$1" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' || true; }

# Expand ENABLED_ROLES: a token may be a role (e.g. "compute") or a role-GROUP alias
# defined in inventory.roles (e.g. "hub" -> ["store","control",...]).
# A token is either a role-GROUP alias (hub/spoke/full, expanded from .roles) or
# a bare role name carried by at least one unit. Anything else is a typo, and a
# typo must not be survivable: an unrecognised token used to pass straight
# through as a role name, match no unit, and contribute nothing — so
# ENABLED_ROLES=spok booted a container with almost every vessel masked and said
# nothing. That is the same failure PROFILE guards against fatally two functions
# below; roles were the gap in the same rule.
expand_roles() {
  local out="" known_roles
  known_roles="$(jq -r '[.vessels[].role] | unique | .[]' "$INV" 2>/dev/null)"
  for tok in $(csv "${ENABLED_ROLES:-}"); do
    local grp
    grp="$(jq -r --arg t "$tok" '.roles[$t] // empty | .[]?' "$INV" 2>/dev/null || true)"
    if [ -n "$grp" ]; then
      out="$out $grp"
    elif echo "$known_roles" | grep -qx "$tok"; then
      out="$out $tok"
    else
      # Reported, NOT exited: this function is always called as $(expand_roles),
      # so an exit here would kill only the subshell and boot would continue
      # with an empty role set — the very silence being fixed. The caller sees
      # this sentinel on stdout and aborts in the parent shell.
      echo "__INVALID_ROLE__:$tok"
      return 0
    fi
  done
  echo "$out" | tr ' ' '\n' | grep -v '^$' | sort -u
}

manageable_units() { jq -r '.vessels[] | select((.manifest // false) | not) | .unit' "$INV"; }
role_of() { jq -r --arg u "$1" '.vessels[] | select(.unit==$u) | .role' "$INV"; }

# PROFILE names an explicit unit list in inventory.profiles. It outranks both
# ENABLED_VESSELS and ENABLED_ROLES: a profile IS the hand-written allow-list
# those deploy scripts used to carry inline, so nothing should be able to widen
# it silently. An unknown name is FATAL rather than a fall-through — falling
# through would boot the coarse role group, which is the whole failure a profile
# exists to prevent, and it would do so looking like a success.
DESIRED=""
if [ -n "${PROFILE:-}" ]; then
  DESIRED="$(jq -r --arg p "$PROFILE" '.profiles[$p] // empty | .[]?' "$INV" 2>/dev/null || true)"
  if [ -z "$DESIRED" ]; then
    log "FATAL: PROFILE='$PROFILE' names no entry in .profiles — known: $(jq -r '.profiles // {} | keys | join(", ")' "$INV" 2>/dev/null)"
    exit 1
  fi
  log "explicit PROFILE '$PROFILE': $(echo $DESIRED | tr '\n' ' ')"
elif [ -n "${ENABLED_VESSELS:-}" ]; then
  DESIRED="$(csv "${ENABLED_VESSELS}")"
  log "explicit ENABLED_VESSELS: $(echo $DESIRED | tr '\n' ' ')"
elif [ -n "${ENABLED_ROLES:-}" ]; then
  ROLES="$(expand_roles)"
  # Fatal in the PARENT shell — see the note in expand_roles about why the check
  # cannot abort from inside a command substitution.
  if echo "$ROLES" | grep -q '^__INVALID_ROLE__:'; then
    _bad="$(echo "$ROLES" | sed -n 's/^__INVALID_ROLE__://p' | tr '\n' ' ')"
    log "FATAL: ENABLED_ROLES contains unknown token(s): $_bad"
    log "  role groups: $(jq -r '.roles // {} | keys | join(", ")' "$INV" 2>/dev/null)"
    log "  bare roles:  $(jq -r '[.vessels[].role] | unique | join(", ")' "$INV" 2>/dev/null)"
    exit 1
  fi
  log "ENABLED_ROLES expands to: $(echo $ROLES | tr '\n' ' ')"
  for u in $(manageable_units); do
    r="$(role_of "$u")"
    if echo "$ROLES" | grep -qx "$r"; then DESIRED="$DESIRED
$u"; fi
  done
else
  DESIRED="$(manageable_units)"   # only DISABLED_VESSELS set → start from all
fi

# Additive extra vessels: kept ON TOP of the ENABLED_ROLES/ENABLED_VESSELS
# selection (unlike ENABLED_VESSELS, which overrides roles). Use case: a hub
# deployed with ENABLED_ROLES=hub that should also run a single compute-role
# vessel (e.g. development-vessel) without pulling in the whole compute fleet.
# No-op when unset; runs before the DISABLED subtraction so DISABLED still wins.
if [ -n "${ENABLED_EXTRA_VESSELS:-}" ]; then
  EXTRA="$(csv "${ENABLED_EXTRA_VESSELS}")"
  log "ENABLED_EXTRA_VESSELS (additive): $(echo $EXTRA | tr '\n' ' ')"
  DESIRED="$DESIRED
$EXTRA"
fi

# A DESIRED .timer pulls in the .service it triggers.
#
# Every selection route above can name a .timer without its .service: an
# explicit ENABLED_VESSELS or PROFILE list is the whole desired set, so a unit
# it forgets is masked. systemd does not degrade gracefully here — it refuses
# the timer outright ("Refusing to start, unit X.service to trigger not
# loaded"), so the timer reads as enabled while no schedule exists at all.
#
# Observed 2026-08-08 on a UI-only spoke: ENABLED_VESSELS named
# substrate-pull-sync.timer and self-recovery.timer but neither .service. Both
# services were masked, both timers refused to start every boot, and the box
# could neither converge to origin/dev nor restart its own surface — 13 commits
# behind with nothing reporting a fault. The failure is silent by construction,
# which is why this closes the set rather than only warning about it.
#
# Runs BEFORE the DISABLED subtraction, so an operator who deliberately masks a
# .service still wins — this supplies an omission, it does not override intent.
# Only pairs the inventory actually ships are added.
_paired=""
for _t in $DESIRED; do
  case "$_t" in
    *.timer) ;;
    *) continue ;;
  esac
  _svc="${_t%.timer}.service"
  if echo "$DESIRED" | grep -qx "$_svc"; then continue; fi
  if manageable_units | grep -qx "$_svc"; then
    _paired="$_paired $_svc"
    DESIRED="$DESIRED
$_svc"
  fi
done
[ -n "$_paired" ] && log "paired with a desired .timer (would have been masked):$_paired"

# Subtract DISABLED_VESSELS.
DISABLED_EXPLICIT="$(csv "${DISABLED_VESSELS:-}")"

is_desired() { echo "$DESIRED" | grep -qx "$1" && ! echo "$DISABLED_EXPLICIT" | grep -qx "$1"; }

disabled_count=0
for u in $(manageable_units); do
  if is_desired "$u"; then
    # clear a stale mask left by a previous role selection
    #
    # DRY_RUN must mean DRY RUN. This branch was unguarded, so `DRY_RUN=1` still
    # unmasked units on disk — and `vessel-ctl drift`, which exists to REPORT
    # the gap without touching anything, mutated the fleet every time it ran
    # (without a daemon-reload, so `status` then reported a stale state).
    if [ -L "/etc/systemd/system/$u" ] && [ "$(readlink "/etc/systemd/system/$u")" = "/dev/null" ]; then
      if [ "$DRY_RUN" = "1" ]; then
        log "DRY-RUN would unmask: $u"
      else
        rm -f "/etc/systemd/system/$u" && log "unmasked: $u"
      fi
    fi
    # ENABLE a desired unit that has never been enabled.
    #
    # This loop only ever disabled. Enable symlinks are baked into the image at
    # build time, so a unit ADDED to units/ afterwards was installed by
    # pull-sync's converge_units and then sat `disabled` forever — it could not
    # run on any existing container without an image rebuild, which is the
    # opposite of a fleet that updates itself from git. Observed 2026-08-08:
    # development-vessel-seed.service converged, showed `disabled; preset:
    # enabled`, and never ran.
    #
    # NOT a blanket enable. A .service whose .timer is in the inventory is
    # TIMER-TRIGGERED and must stay disabled — enabling it would fire it at boot
    # instead of on its schedule, turning every periodic tick into a startup job.
    #
    # No [Install] probe: this runs BEFORE systemd is PID 1, where anything
    # needing dbus (`systemctl cat`) is unreliable. `enable` and `is-enabled`
    # only manipulate/read symlinks, so they work offline — and `enable` already
    # fails harmlessly on a unit with no [Install]. Attempt it and log only on
    # success, rather than asking a question we cannot reliably ask here.
    if [ "$DRY_RUN" != "1" ] && [ "$(systemctl is-enabled "$u" 2>/dev/null)" = "disabled" ]; then
      _timer="${u%.service}.timer"
      if [ "$u" != "${u%.service}" ] && echo "$DESIRED" | grep -qx "$_timer"; then
        :  # timer-triggered; its timer schedules it
      else
        systemctl enable "$u" >/dev/null 2>&1 && log "enabled: $u (was never enabled — new unit)"
      fi
    fi
    continue
  fi
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN would disable: $u"
  else
    systemctl disable "$u" >/dev/null 2>&1 || log "warn: could not disable $u"
    # disable alone doesn't survive Wants= pulls from enabled units — mask the
    # unit with an /etc-level /dev/null link (units are vendored in /usr/lib,
    # which /etc outranks). /etc persists across container restarts, so the
    # desired-units loop below unmasks anything re-enabled by a role change.
    if [ -f "/etc/systemd/system/$u" ] && [ ! -L "/etc/systemd/system/$u" ]; then
      log "warn: $u has a real unit file in /etc — cannot mask (dynamic vessel?)"
    else
      ln -sf /dev/null "/etc/systemd/system/$u" 2>/dev/null || log "warn: could not mask $u"
    fi
    log "disabled+masked: $u"
  fi
  disabled_count=$((disabled_count + 1))
done
log "done — $disabled_count unit(s) $( [ "$DRY_RUN" = "1" ] && echo 'would be' || echo '' ) disabled; the rest stay enabled"

# Conformance: role selection can only govern units the inventory names, so any
# shipped unit missing from it runs unconditionally in EVERY role. That is silent
# by construction — the composition is simply wrong with nothing reporting it.
# It has bitten once already: the inventory listed boredom-vessel.timer but not
# boredom-vessel.service, so the selection loop ran on a hub whose role group
# excludes compute, could not reach its (correctly masked) dispatch conduit, and
# recorded a failure outcome per template — writing infrastructure absence into
# the shared learning store as arm quality.
# Warn only. Masking an unlisted unit here would let a packaging omission take a
# vessel down at boot, which is strictly worse than running one too many.
# Identify substrate units SEMANTICALLY — a unit whose ExecStart runs out of the
# vessel or script trees is ours regardless of what it is called. Name patterns
# were tried first and were far too narrow (they matched 19 of 364 unit files and
# missed llm-resolver-*.service, which do not end in "-vessel"). Mitosis clones
# are excluded: they are generated at runtime and cannot be pre-declared.
# Corpus-tested against the live hub image: 5 true positives, 0 false positives,
# and it does flag the boredom-vessel.service omission that motivated it.
unmanaged="$(comm -13 \
  <(manageable_units | sort -u) \
  <(cd /usr/lib/systemd/system 2>/dev/null \
      && grep -lE '/vessels/|/usr/local/share/substrate|/opt/substrate' -- *.service *.timer 2>/dev/null \
      | grep -v -- '-mitosis-' | sort -u) 2>/dev/null || true)"
if [ -n "$unmanaged" ]; then
  log "warn: $(echo "$unmanaged" | wc -l) shipped unit(s) absent from the inventory — ungoverned by ENABLED_ROLES, they run in every role:"
  for u in $unmanaged; do log "warn:   unmanaged: $u"; done
else
  log "inventory conformance: every shipped vessel unit is governed by role selection"
fi
