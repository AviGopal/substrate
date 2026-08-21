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
  # 2>&1, NOT 2>/dev/null: apply-inventory logs to STDERR, so discarding it
  # discards the very line being matched — the check would then read "models
  # absent" for every selection and silently disable the arms everywhere.
  if ! DRY_RUN=1 ENABLED_ROLES="$ENABLED_ROLES" /usr/local/bin/apply-inventory 2>&1 \
       | grep -Eq 'expands to:.*(^| )models( |$)'; then
    _models_wanted=0
  fi
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
  ln -sf "../$_b" "/etc/systemd/system/multi-user.target.wants/$_b"; _want="$_want $_b"
  echo "[arms] enabled $_b"
done

# At boot there is no systemd to talk to yet — the wants-symlinks above ARE the
# instruction. At runtime the symlinks alone change nothing until units are
# actually started and stopped, which is the whole point of `vessel-ctl apply`.
if [ "${RELOAD:-0}" = 1 ]; then
  systemctl daemon-reload >/dev/null 2>&1
  for b in $_drop; do systemctl stop "$b" >/dev/null 2>&1 && echo "[arms] stopped $b"; done
  for b in $_want; do
    systemctl start "$b" >/dev/null 2>&1 \
      && echo "[arms] started $b" \
      || echo "[arms] $b not started (ExecCondition skip is normal for a keyless arm)"
  done
fi
