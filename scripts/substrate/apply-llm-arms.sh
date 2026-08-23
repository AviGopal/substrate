#!/usr/bin/env bash
# apply-llm-arms.sh — render the declarative LLM arm fleet, retire the static
# units it supersedes, and enable exactly the arms the current vessel selection
# asks for.
#
# WHY THIS IS ITS OWN FILE
#   This logic runs from TWO callers: entrypoint.sh at boot (pre-systemd) and
#   `vessel-ctl apply` at runtime. It used to live only in the entrypoint, which
#   meant the only way to change which arms run was to restart the container.
#   Two copies of it would be the producer/consumer drift this tree keeps paying
#   for — one caller fixed, the other quietly serving the old behaviour — so
#   there is exactly one copy and both callers exec it.
#
#   It is idempotent and safe to re-run: every branch either creates or removes a
#   wants-symlink, and rendering overwrites unit files in place.
#
# WHAT IT DECIDES
#   The rendered arms (llm-opus / llm-haiku / llm-google, from llm-arms.json) are
#   created AFTER apply-inventory, under names the inventory never contains — so
#   no selection lever reaches them by itself. They serve models, so they belong
#   to role `models`; if the selection in force excludes that role, they are not
#   enabled. `spoke` excludes it by design: a spoke resolves models on its hub.
#
# USAGE
#   apply-llm-arms.sh            # render + enable per current /etc/substrate/env
#   RELOAD=1 apply-llm-arms.sh   # also systemctl daemon-reload + start/stop units
#                                #   (runtime callers want this; boot does not,
#                                #   because systemd is not running yet)
set -uo pipefail

# The selection knobs live in the env file, which is the only place a running
# fleet's current selection is legible.
set -a; . /etc/substrate/env 2>/dev/null || true; set +a

RENDER=""
for c in /usr/local/bin/render-llm-arms \
         /usr/local/share/substrate/super-repo/scripts/substrate/render-llm-arms.sh \
         "$(dirname "$0")/render-llm-arms.sh"; do
  if [ -x "$c" ]; then RENDER="$c"; break; fi
done
if [ -z "$RENDER" ]; then
  echo "[arms] no renderer found — nothing to do" >&2
  exit 0
fi

echo "[arms] rendering LLM arm units ($RENDER)"
if ! "$RENDER"; then
  echo "[arms] render-llm-arms failed — leaving the current arm set untouched" >&2
  exit 1
fi

# ── Does this selection want role `models`? ────────────────────────────────────
_models_wanted=1
if [ -n "${ENABLED_ROLES:-}" ] && [ -x /usr/local/bin/apply-inventory ]; then
  # Ask the same expander apply-inventory uses, so the two cannot drift.
  #
  # 2>&1, NOT 2>/dev/null: apply-inventory logs to STDERR, so discarding it
  # discards the very line being matched.
  #
  # ★ CAPTURE FIRST, THEN MATCH — do NOT pipe into `grep -q`.
  # `grep -q` exits the moment it matches, closing the pipe; the still-writing
  # apply-inventory then takes SIGPIPE, and under `set -o pipefail` the whole
  # pipeline reports failure EVEN THOUGH THE MATCH SUCCEEDED. The `if !` branch
  # therefore fired on success and set _models_wanted=0, disabling every arm
  # under ANY explicit selection — including `full` and `hub`, which both
  # contain `models`. It went unnoticed because the guard above skips this
  # block entirely when ENABLED_ROLES is empty, which is the default topology
  # everything gets tested on.
  _expansion="$(DRY_RUN=1 ENABLED_ROLES="$ENABLED_ROLES" /usr/local/bin/apply-inventory 2>&1 || true)"
  case "$_expansion" in
    *"expands to:"*) printf '%s' "$_expansion" | grep -Eq 'expands to:.*(^| )models( |$)' || _models_wanted=0 ;;
    # No expansion line at all means the expander could not tell us; leave the
    # arms alone rather than silently disabling them on an unreadable answer.
    *) : ;;
  esac
fi
# An explicit PROFILE or ENABLED_VESSELS is a hand-written allow-list; the
# rendered arms are not on it unless named there.
if [ -n "${PROFILE:-}" ] || [ -n "${ENABLED_VESSELS:-}" ]; then
  _models_wanted=0
  case ",${ENABLED_VESSELS:-}," in *,llm-*) _models_wanted=1 ;; esac
fi

# ── Assert no static twin has reappeared ───────────────────────────────────────
#
# The static llm-resolver-{opus,haiku,google} units are DELETED — from the image,
# the units directory and the inventory. They were duplicates of the rendered
# arms on the SAME PORTS (8221/8223/8225), so exactly one of each pair won the
# bind and the loser died EADDRINUSE and retried forever, reporting `activating`
# and never `failed` — invisible to any no-failed-units check while the fleet
# burned a process every ~25s.
#
# This is now an assertion, not a repair: a twin can only come back via a stale
# image or a hand-placed unit, and silently disabling it would hide exactly the
# regression worth shouting about. llm-resolver-vessel (8220) is NOT a twin — it
# is the shared base resolver on its own port.
for _r in /etc/systemd/system/llm-*.service; do
  [ -f "$_r" ] || continue
  _id="$(basename "$_r" .service)"; _id="${_id#llm-}"
  _static="llm-resolver-${_id}.service"
  if [ -f "/lib/systemd/system/$_static" ] || [ -f "/etc/systemd/system/$_static" ]; then
    echo "[arms] WARNING: $_static exists and duplicates rendered llm-${_id}.service on the same port." >&2
    echo "[arms] WARNING: these units were deleted; a stale image or a hand-placed file has reintroduced one." >&2
    echo "[arms] WARNING: expect an EADDRINUSE restart loop reporting 'activating', never 'failed'." >&2
    rm -f "/etc/systemd/system/multi-user.target.wants/$_static"
    [ "${RELOAD:-0}" = 1 ] && systemctl stop "$_static" >/dev/null 2>&1
  fi
done

# ── Enable exactly the arms this selection asks for ────────────────────────────
mkdir -p /etc/systemd/system/multi-user.target.wants
_want=""; _drop=""
for u in /etc/systemd/system/llm-*.service; do
  [ -f "$u" ] || continue
  _b="$(basename "$u")"
  case ",${DISABLED_VESSELS:-}," in
    *",$_b,"*)
      rm -f "/etc/systemd/system/multi-user.target.wants/$_b"; _drop="$_drop $_b"
      echo "[arms] $_b left DISABLED (DISABLED_VESSELS)"; continue ;;
  esac
  if [ "$_models_wanted" = 0 ]; then
    rm -f "/etc/systemd/system/multi-user.target.wants/$_b"; _drop="$_drop $_b"
    echo "[arms] $_b NOT enabled — role 'models' is not in this selection"; continue
  fi
  # REPORT ONLY A CHANGE. This echoed unconditionally after `ln -sf`, which is a
  # no-op when the symlink already points there — so a converged fleet printed
  # three "enabled" lines on every run, and the documented converged signal
  # ("an apply that prints no action lines is a genuine no-op") was unreachable.
  if [ -L "/etc/systemd/system/multi-user.target.wants/$_b" ]; then _was_linked=1; else _was_linked=0; fi
  ln -sf "../$_b" "/etc/systemd/system/multi-user.target.wants/$_b"; _want="$_want $_b"
  [ "$_was_linked" = 1 ] || echo "[arms] enabled $_b"
done

# At boot there is no systemd to talk to yet — the wants-symlinks above ARE the
# instruction. At runtime the symlinks alone change nothing until units are
# actually started and stopped, which is the whole point of `vessel-ctl apply`.
if [ "${RELOAD:-0}" = 1 ]; then
  systemctl daemon-reload >/dev/null 2>&1
  for b in $_drop; do systemctl stop "$b" >/dev/null 2>&1 && echo "[arms] stopped $b"; done
  for b in $_want; do
    # ASK WHAT HAPPENED, don't infer from the exit code. `systemctl start`
    # returns 0 both for a unit it started and for one that was ALREADY running,
    # and also for one systemd declined to run via ExecCondition — so this
    # printed "started llm-google.service" about a unit sitting
    # inactive/ConditionResult=no, and the honest fallback text below was
    # unreachable. Compare state across the call.
    _pre=$(systemctl show "$b" -p ActiveState --value 2>/dev/null)
    systemctl start "$b" >/dev/null 2>&1 || true
    _post=$(systemctl show "$b" -p ActiveState --value 2>/dev/null)
    _cond=$(systemctl show "$b" -p ConditionResult --value 2>/dev/null)
    if [ "$_pre" = "$_post" ]; then
      # NO STATE CHANGE = NOT AN ACTION. Applies to an arm that was already
      # running AND to one systemd keeps declining (a keyless arm, every tick
      # forever). Both are steady state; printing either makes the documented
      # converged signal ("no action lines") unreachable, and an operator cannot
      # tell a standing condition from something that just happened.
      :
    elif [ "$_post" = active ] || [ "$_post" = activating ]; then
      echo "[arms] started $b"
    elif [ "$_cond" = no ]; then
      echo "[arms] $b not started (ExecCondition skip — normal for a keyless arm)"
    else
      echo "[arms] $b FAILED to start (state=$_post)"
    fi
  done
fi
