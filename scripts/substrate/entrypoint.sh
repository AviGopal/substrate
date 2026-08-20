#!/bin/bash
# entrypoint.sh — substrate container entry point
# Generates env file from container env vars, then execs systemd as PID 1.
set -euo pipefail

echo "[substrate] generating /etc/substrate/env"
/usr/local/bin/gen-env

# Fleet definition lives in the VOLUME (substrate-writable — the substrate can
# alter its own membership); the image ships defaults. First boot copies them
# in; later boots keep the volume copies authoritative. Readiness, doctor,
# self-recovery, pull-sync and vessel-ctl all prefer $FLEET_DIR.
FLEET_DIR=/workspace/substrate/fleet
mkdir -p "$FLEET_DIR"
for f in vessels.inventory.json vessels.manifest.json; do
  if [ ! -f "$FLEET_DIR/$f" ] && [ -f "/usr/local/share/substrate/$f" ]; then
    cp "/usr/local/share/substrate/$f" "$FLEET_DIR/$f"
    echo "[substrate] seeded $FLEET_DIR/$f from image default"
  fi
done

# Select which vessel units run (subset support). Reads /etc/substrate/env for
# ENABLED_ROLES / ENABLED_VESSELS / DISABLED_VESSELS. Default = keep everything.
if [ -x /usr/local/bin/apply-inventory ]; then
  echo "[substrate] applying vessel inventory selection"
  # shellcheck disable=SC1091
  set -a; . /etc/substrate/env 2>/dev/null || true; set +a
  # ★ FAIL-OPEN IS ONLY SAFE WHEN NOTHING WAS ASKED FOR.
  #
  # apply-inventory exits 1 on an unrecognised PROFILE / ENABLED_ROLES token —
  # a guard added precisely so a typo could not silently change the fleet. This
  # line then swallowed it into "keeping all units", which is the WORST possible
  # response: the operator asked for a subset, and the substrate answers by
  # enabling EVERYTHING the image bakes in. `ENABLED_ROLES=spok` does not get you
  # a spoke minus a typo; it gets you a full node running the LLM arms, the
  # autonomy timers and the trace store you deliberately excluded — the exact
  # outcome the guard exists to prevent, defeated one layer above it.
  #
  # So: fail-open ONLY when no selection was requested (a bare `docker run`,
  # where "run everything" IS the intent). If any selection knob is set, a
  # failure to apply it aborts the boot — a container that will not start is
  # diagnosable; one silently running the wrong fleet is not.
  if ! /usr/local/bin/apply-inventory; then
    if [ -n "${PROFILE:-}${ENABLED_ROLES:-}${ENABLED_VESSELS:-}${ENABLED_EXTRA_VESSELS:-}${DISABLED_VESSELS:-}" ]; then
      echo "[substrate] FATAL: apply-inventory failed while a vessel selection was requested." >&2
      echo "[substrate] FATAL: PROFILE='${PROFILE:-}' ENABLED_ROLES='${ENABLED_ROLES:-}' ENABLED_VESSELS='${ENABLED_VESSELS:-}' ENABLED_EXTRA_VESSELS='${ENABLED_EXTRA_VESSELS:-}' DISABLED_VESSELS='${DISABLED_VESSELS:-}'" >&2
      echo "[substrate] FATAL: refusing to boot the full baked fleet in place of the requested subset. Fix the selection (see the error above) and restart." >&2
      exit 1
    fi
    echo "[substrate] apply-inventory failed; no selection was requested, so keeping all units (default topology)"
  fi
fi

# Point-and-go spoke federation (folds the former manual spoke-federate.sh into boot):
# when this container is a spoke — HUB_DISCOVERY_URL is derived from DISCOVERY_ENDPOINT
# by gen-env — render + boot-enable the federation-transport-vessel so ingress/egress
# fall out of the discovery anchor alone. The transport self-derives its relay from
# ${HUB_DISCOVERY_URL}/bootstrap and its peer id from FED_VESSEL_ID (both set by gen-env),
# so no RELAY_MULTIADDR / FED_* need be supplied. Spoke-only: a plain root never starts
# it (no crash loop), and a failed transport unit never blocks the rest of the boot.
set -a; . /etc/substrate/env 2>/dev/null || true; set +a
if [ -n "${HUB_DISCOVERY_URL:-}" ] && [ -x /usr/local/bin/vessel-ctl ]; then
  echo "[substrate] spoke federation: enabling federation-transport-vessel (hub=${HUB_DISCOVERY_URL})"
  /usr/local/bin/vessel-ctl install federation-transport-vessel >/dev/null 2>&1 || true
  # vessel-ctl's `systemctl enable --now` no-ops pre-systemd; make boot-start deterministic
  # with an offline wants-symlink (the unit is WantedBy=multi-user.target).
  if [ -f /etc/systemd/system/federation-transport-vessel.service ]; then
    mkdir -p /etc/systemd/system/multi-user.target.wants
    ln -sf ../federation-transport-vessel.service \
      /etc/systemd/system/multi-user.target.wants/federation-transport-vessel.service
  fi
fi

# LLM arm fleet: render one unit per declared arm (llm-arms.json / LLM_ARMS env)
# via render-llm-arms.sh, then boot-enable the rendered llm-<id>.service units.
# Fail-open: no renderer found => skip (the static opus/haiku/google units still
# run — parallel-run migration; retiring them is a later change). Enable mirrors
# the federation-transport pattern above: `systemctl enable --now` no-ops
# pre-systemd, so boot-start is made deterministic with offline wants-symlinks
# (the rendered units are WantedBy=multi-user.target).
RENDER_LLM_ARMS=""
for c in /usr/local/bin/render-llm-arms \
         /usr/local/share/substrate/super-repo/scripts/substrate/render-llm-arms.sh \
         "$(dirname "$0")/render-llm-arms.sh"; do
  if [ -x "$c" ]; then RENDER_LLM_ARMS="$c"; break; fi
done
if [ -n "$RENDER_LLM_ARMS" ]; then
  echo "[substrate] rendering LLM arm units ($RENDER_LLM_ARMS)"
  if "$RENDER_LLM_ARMS"; then
    # ★ THE RENDERED ARMS MUST HONOUR THE ROLE SELECTION THAT ALREADY RAN.
    #
    # These units are rendered AFTER apply-inventory, under names the inventory
    # never contains (llm-opus / llm-haiku / llm-google, vs the inventory's
    # llm-resolver-*), so NO selection lever reached them: not ENABLED_ROLES,
    # not DISABLED_VESSELS (its mask loop iterates inventory-named units only),
    # and not an operator's `systemctl disable` — this very loop re-created the
    # wants-symlink on the next boot. Moving the llm-resolver-* units to role
    # `models` therefore fixed the names nothing renders, while the arms that
    # actually run stayed ungoverned.
    #
    # The arms serve models, so they belong to role `models`. If the selection
    # in force excludes that role, do not enable them. `spoke` excludes it by
    # design: a spoke resolves models on its hub.
    _models_wanted=1
    if [ -n "${ENABLED_ROLES:-}" ] && [ -x /usr/local/bin/apply-inventory ]; then
      # Ask the same expander apply-inventory used, so the two cannot drift.
      # 2>&1, NOT 2>/dev/null: apply-inventory logs to STDERR, so discarding it
      # discards the very line being matched — the check would then read "models
      # absent" for every selection, silently disabling the arms everywhere.
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

    # ★ RETIRE THE STATIC ARM EACH RENDERED ARM SUPERSEDES.
    #
    # The migration to rendered arms shipped BOTH sets and called it a
    # "parallel run". They are not parallel — they are duplicates on the SAME
    # PORT: llm-resolver-{opus,haiku,google} (/lib/systemd/system, 8221/8223/
    # 8225) against rendered llm-{opus,haiku,google} (/etc/systemd/system, the
    # same three ports, from llm-arms.json). Exactly one of each pair wins the
    # bind; the loser dies EADDRINUSE and Restart=on-failure retries it forever.
    # Measured on a fresh clean-room fleet: NRestarts=95 within 40 minutes, two
    # of three arms looping, and WHICH unit won differed per arm — a boot race.
    #
    # It stayed invisible because a unit in a restart loop reports `activating`,
    # never `failed`, so `systemctl list-units --state=failed` is empty and the
    # doctor's "no failed units" check PASSES while the fleet burns a process
    # every ~25s. (Same signature as the one-shot-install crash-loop already on
    # record — the class recurred in a new place.)
    #
    # llm-resolver-vessel (8220) is NOT superseded: it is the shared base
    # resolver on its own port, not an arm. Only retire a static unit when the
    # rendered arm of the same id actually exists.
    for _r in /etc/systemd/system/llm-*.service; do
      [ -f "$_r" ] || continue
      _id="$(basename "$_r" .service)"; _id="${_id#llm-}"
      _static="llm-resolver-${_id}.service"
      if [ -f "/lib/systemd/system/$_static" ] || [ -f "/etc/systemd/system/$_static" ]; then
        rm -f "/etc/systemd/system/multi-user.target.wants/$_static"
        echo "[substrate] retired static $_static — superseded by rendered llm-${_id}.service (same port)"
      fi
    done

    mkdir -p /etc/systemd/system/multi-user.target.wants
    for u in /etc/systemd/system/llm-*.service; do
      [ -f "$u" ] || continue
      _b="$(basename "$u")"
      case ",${DISABLED_VESSELS:-}," in
        *",$_b,"*)
          rm -f "/etc/systemd/system/multi-user.target.wants/$_b"
          echo "[substrate] rendered LLM arm $_b left DISABLED (DISABLED_VESSELS)"
          continue ;;
      esac
      if [ "$_models_wanted" = 0 ]; then
        rm -f "/etc/systemd/system/multi-user.target.wants/$_b"
        echo "[substrate] rendered LLM arm $_b NOT enabled — role 'models' is not in this selection"
        continue
      fi
      ln -sf "../$_b" "/etc/systemd/system/multi-user.target.wants/$_b"
      echo "[substrate] enabled rendered LLM arm $_b"
    done
  else
    echo "[substrate] render-llm-arms failed (keeping static LLM units only)"
  fi
fi

echo "[substrate] handing off to systemd"
exec /lib/systemd/systemd
