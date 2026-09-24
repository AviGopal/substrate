#!/bin/bash
# apply-inventory.sh — select which vessel units run, from vessels.inventory.json.
#
# Run by entrypoint.sh AFTER gen-env and BEFORE `exec systemd`, so unit selection
# happens offline (systemctl disable just removes the *.wants symlinks the Dockerfile
# created). The image bakes the FULL enable-list; this trims it down to a subset.
#
# Selection (env, highest precedence first):
#   PROFILE=name                a named composition from the inventory (below);
#                               outranks every other selection variable
#   ENABLED_VESSELS=unit,unit   explicit allow-list (exact unit names); overrides roles
#   ENABLED_ROLES=role,role     roles to keep (role-GROUP aliases hub/spoke/full expand
#                               via inventory.roles); everything else is disabled
#   DISABLED_VESSELS=unit,unit  always disabled, even if selected above
# DEFAULT (neither ENABLED_* set) = keep everything = identical to today (no-op).
# DRY_RUN=1 prints the plan without changing anything.
#
# A profile name resolves in one namespace across two keys of the inventory:
#   profiles.<name>          ["unit", ...]  an explicit unit list
#   composed_profiles.<name> {"roles": [...], "vessels": [...]}  role groups /
#                            roles expanded exactly as ENABLED_ROLES would, plus
#                            named units
# The keys are separate on purpose: a selector that predates composition looks
# only in `profiles`, finds no entry for a composed name, and refuses loudly —
# rather than iterating the object as if it were a unit list.
# inventory.profile_aliases maps a deprecated profile name to its replacement;
# the replacement's definition is used and the old name is reported.
#
# `apply-inventory --profile-roles` prints the role list of the PROFILE in the
# environment when it is role-composed (nothing for a unit-list profile) and
# exits, changing nothing. Callers that decide by role — whether the LLM arms
# belong to this selection, for one — ask this instead of re-reading the file.
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

# No selection env → every manageable unit is desired. FALL THROUGH; do not exit.
#
# This branch used to `exit 0` on the theory that "want everything" needs no
# work. It needs two kinds of work, and skipping them made the default topology
# the one selection that could never repair itself:
#
#   1. UNMASK. Masks are on-disk state left by a PREVIOUS selection, not by this
#      one. After `vessel-ctl apply` with ENABLED_ROLES=spoke masked seven
#      vessels, the documented recovery — a bare `vessel-ctl apply`, which both
#      the inventory header and `drift` call "all units enabled" — returned here,
#      printed that line, and exited without clearing a single mask. Measured on
#      a live fleet: 58 units masked, 9 core vessels dead, `{"ok":true}`, and
#      `drift` issuing a clean all-clear at that same moment. `start` refuses a
#      masked unit, `restart` refuses it and advises "unmask it deliberately",
#      and there is no `unmask` verb — so the fleet had no documented way back.
#   2. ENABLE. Enable symlinks are baked at image build; a unit added to units/
#      afterwards is installed by pull-sync and then sits `disabled` forever.
#      The enable pass below is what fixes that, and it sat past this exit — so
#      13 timers plus development-vessel-seed.service, all present in
#      /lib/systemd/system, were enabled on NO default-topology container.
#
# Falling through costs one loop over the inventory and reaches both passes:
# DESIRED becomes every manageable unit (the else-branch below), DISABLED_EXPLICIT
# is empty, so nothing is disabled and everything masked is restored.
QUERY="${1:-}"
case "$QUERY" in
  ""|--profile-roles) ;;
  *) log "FATAL: unknown argument '$QUERY' (the only one accepted is --profile-roles)"; exit 2 ;;
esac
if [ -z "$QUERY" ] && [ -z "${PROFILE:-}" ] && [ -z "${ENABLED_VESSELS:-}" ] && [ -z "${ENABLED_ROLES:-}" ] && [ -z "${DISABLED_VESSELS:-}" ]; then
  log "no ENABLED_ROLES/ENABLED_VESSELS/DISABLED_VESSELS set — all units enabled (default)"
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
expand_roles() { # expand_roles [csv] — defaults to ENABLED_ROLES
  local out="" known_roles src="${1-${ENABLED_ROLES:-}}"
  known_roles="$(jq -r '[.vessels[].role] | unique | .[]' "$INV" 2>/dev/null)"
  for tok in $(csv "$src"); do
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
all_units() { jq -r '.vessels[].unit' "$INV"; }

# Resolve an operator-supplied token to an inventory UNIT name.
#
# Every selection list below is matched against unit names with `grep -qx`, so a
# bare vessel name silently matched nothing. That is not a cosmetic strictness —
# it inverted three separate settings, each of which reported success:
#
#   ENABLED_VESSELS=activity-api          DISABLED activity-api (it matched no
#                                         unit, so the allow-list was empty and
#                                         every unit fell through to the mask)
#   ENABLED_EXTRA_VESSELS=boredom-vessel  logged "(additive): boredom-vessel"
#                                         and masked it two lines later
#   DISABLED_VESSELS=bootstrap-seeder     disabled nothing — and that exact
#                                         string is what the README hands the
#                                         reader as the hardening step for a
#                                         spoke you do not fully trust
#
# The grammar was stated only in this file's own header comment. An operator
# writes the name they know; deriving the unit suffix is the system's job.
# Accept `x`, `x.service` and `x.timer`; prefer an exact match, then .service,
# then .timer.
resolve_token() {
  local t="$1"
  if all_units | grep -qx "$t"; then echo "$t"; return 0; fi
  if all_units | grep -qx "$t.service"; then echo "$t.service"; return 0; fi
  if all_units | grep -qx "$t.timer"; then echo "$t.timer"; return 0; fi
  return 1
}

# Resolve a whole CSV list, reporting unknown tokens through the OUTPUT.
#
# Unknown tokens are FATAL, matching the PROFILE and ENABLED_ROLES guards. A
# typo here has always been survivable-but-wrong, which is the failure mode
# those two guards exist to prevent; leaving the remaining three lists silent
# meant .env.example's claim that an unknown name "is now a BOOT ERROR ... rather
# than a container that silently comes up nearly empty" was true of two of the
# five selection variables. Bare names now RESOLVE rather than erroring, so a
# config that worked before still works — only genuine typos become loud.
#
# The sentinel goes on STDOUT for the same reason expand_roles' does, and this
# was got wrong once first: an earlier draft accumulated unresolved tokens in a
# shell variable, but every caller invokes this as $(resolve_list ...), so the
# assignment happened in a SUBSHELL and the parent always saw it empty. The
# guard was unreachable — a typo exited silently with no diagnostic at all.
# Two independent failures in one function, in the exact shape the comment
# fifty lines above warns about.
#
# `|| true` on the final pipe is also load-bearing: when every token is
# unresolved $out is empty, `grep -v '^$'` exits 1, pipefail propagates, and
# set -e would kill the script before the caller could read the sentinel.
resolve_list() {
  local out="" tok r
  for tok in $(csv "$1"); do
    if r="$(resolve_token "$tok")"; then out="$out $r"; else out="$out __UNRESOLVED__:$tok"; fi
  done
  echo "$out" | tr ' ' '\n' | grep -v '^$' || true
}

# Abort in the PARENT shell on any sentinel, and echo the list with sentinels
# stripped so a caller can use it directly when nothing failed.
fatal_if_unresolved() {
  local what="$1" list="$2" bad
  bad="$(echo "$list" | sed -n 's/^__UNRESOLVED__://p' | tr '\n' ' ')"
  [ -n "$bad" ] || return 0
  log "FATAL: $what names no unit in the inventory: $bad"
  log "  known vessels: $(all_units | sed 's/\.\(service\|timer\)$//' | sort -u | tr '\n' ' ')"
  exit 1
}

# PROFILE names a composition in the inventory. It outranks both
# ENABLED_VESSELS and ENABLED_ROLES: a profile IS the hand-written allow-list
# those deploy scripts used to carry inline, so nothing should be able to widen
# it silently. An unknown name is FATAL rather than a fall-through — falling
# through would boot the coarse role group, which is the whole failure a profile
# exists to prevent, and it would do so looking like a success.
#
# Two forms (see the header). A unit list is the whole desired set. A composed
# profile names role groups the same way ENABLED_ROLES does, plus the units no
# role expression can select on its own — the compute vessels a hub needs share
# the coarse 'compute' role with everything else, so they are named. Composing
# from roles, not listing units, is what keeps a profile correct as units are
# added: a new store-role unit joins every profile whose roles include store.
profile_canonical() { # profile_canonical <name> — follow profile_aliases one step
  local a
  a="$(jq -r --arg p "$1" '.profile_aliases[$p] // empty' "$INV" 2>/dev/null || true)"
  if [ -n "$a" ]; then echo "$a"; else echo "$1"; fi
}
profile_kind() { # profile_kind <name> -> list | composed | ambiguous | none
  jq -r --arg p "$1" '(.profiles // {})[$p] as $l | (.composed_profiles // {})[$p] as $c
    | if $l != null and $c != null then "ambiguous"
      elif ($l | type) == "array" then "list"
      elif ($c | type) == "object" then "composed"
      else "none" end' "$INV" 2>/dev/null || echo none
}
profile_field_csv() { # profile_field_csv <name> <roles|vessels>
  jq -r --arg p "$1" --arg f "$2" '.composed_profiles[$p][$f] // [] | join(",")' "$INV" 2>/dev/null || true
}
unknown_profile() {
  log "FATAL: PROFILE='$1' names no entry in .profiles or .composed_profiles — known: $(jq -r '[(.profiles // {} | keys[]), (.composed_profiles // {} | keys[]), (.profile_aliases // {} | keys[])] | unique | join(", ")' "$INV" 2>/dev/null)"
  exit 1
}
ambiguous_profile() {
  log "FATAL: PROFILE='$1' is defined in both .profiles and .composed_profiles; one name must mean one composition"
  exit 1
}

if [ "$QUERY" = "--profile-roles" ]; then
  [ -n "${PROFILE:-}" ] || exit 0
  _qp="$(profile_canonical "$PROFILE")"
  case "$(profile_kind "$_qp")" in
    composed) profile_field_csv "$_qp" roles ;;
    list) : ;;
    ambiguous) ambiguous_profile "$_qp" ;;
    *) unknown_profile "$PROFILE" ;;
  esac
  exit 0
fi

DESIRED=""
if [ -n "${PROFILE:-}" ]; then
  _profile="$(profile_canonical "$PROFILE")"
  if [ "$_profile" != "$PROFILE" ]; then
    log "PROFILE '$PROFILE' is a deprecated name; using its replacement '$_profile'"
  fi
  case "$(profile_kind "$_profile")" in
    list)
      DESIRED="$(jq -r --arg p "$_profile" '.profiles[$p][]?' "$INV" 2>/dev/null || true)"
      [ -n "$DESIRED" ] || unknown_profile "$PROFILE"
      log "explicit PROFILE '$_profile': $(echo $DESIRED | tr '\n' ' ')"
      ;;
    composed)
      _p_roles="$(profile_field_csv "$_profile" roles)"
      _p_units="$(profile_field_csv "$_profile" vessels)"
      if [ -z "$_p_roles$_p_units" ]; then unknown_profile "$PROFILE"; fi
      ROLES="$(expand_roles "$_p_roles")"
      if echo "$ROLES" | grep -q '^__INVALID_ROLE__:'; then
        log "FATAL: PROFILE '$_profile' names unknown role token(s): $(echo "$ROLES" | sed -n 's/^__INVALID_ROLE__://p' | tr '\n' ' ')"
        exit 1
      fi
      for u in $(manageable_units); do
        r="$(role_of "$u")"
        if echo "$ROLES" | grep -qx "$r"; then DESIRED="$DESIRED
$u"; fi
      done
      if [ -n "$_p_units" ]; then
        _p_named="$(resolve_list "$_p_units")"
        fatal_if_unresolved "PROFILE '$_profile' vessels" "$_p_named"
        DESIRED="$DESIRED
$_p_named"
      fi
      log "PROFILE '$_profile' expands to roles: $(echo $ROLES | tr '\n' ' ')${_p_units:+ plus units: $(echo "$_p_units" | tr ',' ' ')}"
      ;;
    ambiguous) ambiguous_profile "$_profile" ;;
    *) unknown_profile "$PROFILE" ;;
  esac
elif [ -n "${ENABLED_VESSELS:-}" ]; then
  DESIRED="$(resolve_list "${ENABLED_VESSELS}")"
  fatal_if_unresolved "ENABLED_VESSELS" "$DESIRED"
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
  EXTRA="$(resolve_list "${ENABLED_EXTRA_VESSELS}")"
  fatal_if_unresolved "ENABLED_EXTRA_VESSELS" "$EXTRA"
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

# ...and the converse: a desired .service whose .timer the inventory ships.
#
# resolve_token maps a bare vessel name to `<name>.service`, so
# ENABLED_EXTRA_VESSELS=boredom-vessel selects the service and leaves its timer
# masked. The unit then survives — but the enable pass below only skips a
# service when its timer IS desired, so it gets enabled outright and fires once
# at boot instead of on its schedule. For a timer-driven vessel that turns a
# periodic tick into a startup job and then never runs again.
#
# An operator naming a vessel means "let this vessel run", and for a
# timer-driven vessel the timer IS how it runs. Same rule as above: supply the
# omission, and run before the DISABLED subtraction so an explicit mask wins.
_paired_t=""
for _s in $DESIRED; do
  case "$_s" in
    *.service) ;;
    *) continue ;;
  esac
  _tmr="${_s%.service}.timer"
  if echo "$DESIRED" | grep -qx "$_tmr"; then continue; fi
  if manageable_units | grep -qx "$_tmr"; then
    _paired_t="$_paired_t $_tmr"
    DESIRED="$DESIRED
$_tmr"
  fi
done
[ -n "$_paired_t" ] && log "paired with a desired .service (its schedule):$_paired_t"

# Subtract DISABLED_VESSELS.
DISABLED_EXPLICIT="$(resolve_list "${DISABLED_VESSELS:-}")"
fatal_if_unresolved "DISABLED_VESSELS" "$DISABLED_EXPLICIT"

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

# DISABLED_VESSELS must be able to say no to MANIFEST units too. The loop above
# iterates manageable_units, which excludes "manifest": true entries — correct
# for SELECTION (a manifest vessel is installed on demand, never auto-selected),
# but it silently dropped an explicit DISABLED_VESSELS naming one: the operator
# said no, resolve_list resolved it (all_units includes manifest), and then no
# pass acted on it. Measured 2026-09-15: DISABLED_VESSELS=
# federation-transport-vessel.service had no effect — the spoke entrypoint
# auto-enabled the unit anyway (that auto-enable now honors DISABLED_VESSELS
# itself; this pass covers the previously-installed-unit case, where the real
# file already sits in /etc from an earlier boot).
for u in $DISABLED_EXPLICIT; do
  case "$u" in __UNRESOLVED__:*) continue ;; esac
  manageable_units | grep -qx "$u" && continue   # handled by the loop above
  all_units | grep -qx "$u" || continue          # not inventory-named at all
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN would disable (manifest): $u"; continue
  fi
  systemctl disable "$u" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/multi-user.target.wants/$u" 2>/dev/null || true
  if [ -f "/etc/systemd/system/$u" ] && [ ! -L "/etc/systemd/system/$u" ]; then
    # a real installed unit file: removing the wants-symlink is the offline
    # disable; masking would require deleting the operator-installed file
    log "disabled (manifest, wants-symlink removed): $u"
  else
    ln -sf /dev/null "/etc/systemd/system/$u" 2>/dev/null || log "warn: could not mask $u"
    log "disabled+masked (manifest): $u"
  fi
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
# Compare against EVERY unit the inventory names, manifest ones included.
#
# The baseline was manageable_units(), which deliberately excludes
# "manifest": true — correct for SELECTION (a manifest vessel must stay
# unselectable), wrong for this warning. Any manifest vessel that had actually
# been installed was therefore reported as "absent from the inventory —
# ungoverned", i.e. as a packaging omission, when the inventory names it and
# flags it on purpose. Measured: human-surface-vessel.service flagged on a fleet
# where `jq` finds it at role `ui`, manifest true. The function's own comment
# claimed zero false positives, corpus-tested — the corpus had no manifest
# vessel installed.
#
# Widen the comparison set only; manageable_units() itself is untouched, so
# selection semantics are unchanged.
all_inventory_units() { jq -r '.vessels[].unit' "$INV"; }
unmanaged="$(comm -13 \
  <(all_inventory_units | sort -u) \
  <(cd /usr/lib/systemd/system 2>/dev/null \
      && grep -lE '/vessels/|/usr/local/share/substrate|/opt/substrate' -- *.service *.timer 2>/dev/null \
      | grep -v -- '-mitosis-' | sort -u) 2>/dev/null || true)"
if [ -n "$unmanaged" ]; then
  log "warn: $(echo "$unmanaged" | wc -l) shipped unit(s) absent from the inventory — ungoverned by ENABLED_ROLES, they run in every role:"
  for u in $unmanaged; do log "warn:   unmanaged: $u"; done
else
  log "inventory conformance: every shipped vessel unit is governed by role selection"
fi
