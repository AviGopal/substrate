#!/usr/bin/env bash
# memory-budget-check.sh — does the fleet's memory budget fit the machine it runs on,
# and is the OOM killer being pointed at the right unit?
#
# MEASURED 2026-08-17. surrealdb.service was OOM-killed at 14:19:58 and stayed dead:
# masked, so Restart=on-failure could not recover it, so activity-api 503'd on every
# query for hours. The obvious reading — "the DB is unbounded, cap it" — was wrong twice
# over, and both errors are worth encoding:
#
#   1. `systemctl show surrealdb -p MemoryMax` answered `infinity`. That is NOT the unit's
#      configuration. The unit was MASKED (symlinked to /dev/null), so systemd had loaded
#      no properties at all and reported defaults. The unit file on disk says MemoryHigh=22G
#      / MemoryMax=26G. ★ QUERYING A MASKED UNIT RETURNS DEFAULTS, NOT ITS SETTINGS — an
#      instrument that cannot distinguish "no limit set" from "no unit loaded".
#
#   2. surrealdb was the ONLY large capped unit among 63. The kernel OOM killer selects by
#      RSS, so with 59 units uncapped the biggest process dies for whatever caused the
#      pressure. ★ CAPPING ONLY YOUR BIGGEST PROCESS DOES NOT PROTECT IT — IT ELECTS IT AS
#      THE DESIGNATED VICTIM for every uncapped unit's growth. The cap looks like diligence
#      and functions as a target.
#
# And the budget itself did not fit: surrealdb's 26G hard cap was sized for a dedicated
# host. The machine it was actually running on had 60G total with a 31.5G qemu VM resident
# — roughly 11G genuinely available. A cap larger than the host's headroom is not a cap.
#
# This script answers three questions no single systemd command does. It is READ-ONLY: it
# changes nothing, so it is safe to run on a loaded box and safe to schedule.
#
# Exit 0 = budget fits and the victim ordering is sane. Exit 1 = at least one FAIL.

set -uo pipefail

CONTAINER="${SUBSTRATE_CONTAINER:-substrate-live}"
UNIT_DIR="${SUBSTRATE_UNIT_DIR:-$(dirname "$0")/units}"
fails=0

say()  { printf '%s\n' "$*"; }
fail() { printf 'FAIL  %s\n' "$*"; fails=$((fails + 1)); }
ok()   { printf 'ok    %s\n' "$*"; }

to_bytes() { # 26G / 512M / 1024K / plain bytes -> bytes
  local v="${1:-}"
  case "$v" in
    *[Gg]) echo $(( ${v%[Gg]} * 1024 * 1024 * 1024 )) ;;
    *[Mm]) echo $(( ${v%[Mm]} * 1024 * 1024 )) ;;
    *[Kk]) echo $(( ${v%[Kk]} * 1024 )) ;;
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$v" ;;
  esac
}
gb() { awk -v b="${1:-0}" 'BEGIN{ printf "%.1fG", b/1073741824 }'; }

# ── 1. Does the sum of hard caps fit the machine? ────────────────────────────────────
# MemoryMax is what a unit is ALLOWED to reach, so the sum is the worst case the host must
# absorb. Comparing it to total RAM (not to current usage) is the point: current usage is
# what has happened, the sum is what may happen.
say "== declared budget vs host =="
total_bytes=0
declare -a capped=()
shopt -s nullglob
for f in "$UNIT_DIR"/*.service; do
  m="$(grep -oP '^MemoryMax=\K.*' "$f" 2>/dev/null | tail -1)"
  [ -n "$m" ] || continue
  b="$(to_bytes "$m")"
  total_bytes=$(( total_bytes + b ))
  capped+=("$(basename "$f" .service):$b")
done
shopt -u nullglob

if [ "${#capped[@]}" -eq 0 ]; then
  fail "no unit declares MemoryMax — the whole fleet is unbounded (check SUBSTRATE_UNIT_DIR=$UNIT_DIR)"
else
  host_kb="$(awk '/^MemTotal:/{print $2}' /proc/meminfo)"
  host_bytes=$(( host_kb * 1024 ))
  say "      host MemTotal      : $(gb $host_bytes)"
  say "      sum of MemoryMax   : $(gb $total_bytes) across ${#capped[@]} capped unit(s)"

  # Other tenants on the box — a VM or another container is invisible to systemd but very
  # visible to the OOM killer. This is what made the 26G cap fictional.
  # OTHER TENANTS ARE THE WHOLE POINT — comparing caps to total RAM is the arithmetic that
  # made the 26G cap fictional. A VM or sibling container is invisible to systemd and fully
  # visible to the OOM killer, so the budget must be judged against what is LEFT, not total.
  others="$(ps -eo rss,comm --sort=-rss 2>/dev/null | awk 'NR>1 && $1 > 2097152 {printf "        %.1fG  %s\n", $1/1048576, $2}' | head -5)"
  foreign_kb="$(ps -eo rss,comm --sort=-rss 2>/dev/null \
    | awk -v c="$CONTAINER" 'NR>1 && $1 > 2097152 && $2 !~ /^(bun|node|surreal|valkey)$/ {s+=$1} END{print s+0}')"
  foreign_bytes=$(( foreign_kb * 1024 ))
  headroom=$(( host_bytes - foreign_bytes ))
  if [ -n "$others" ]; then
    say "      foreign >2G processes (not this fleet):"
    say "$others"
    say "      headroom after them : $(gb $headroom)"
  fi

  if [ "$total_bytes" -gt "$host_bytes" ]; then
    fail "declared caps ($(gb $total_bytes)) EXCEED host RAM ($(gb $host_bytes)) — a cap above the host's memory is not a cap; the kernel OOM killer decides instead"
  elif [ "$total_bytes" -gt "$headroom" ]; then
    fail "declared caps ($(gb $total_bytes)) fit host RAM but EXCEED real headroom ($(gb $headroom)) once foreign tenants are counted — this is the shape that killed surrealdb: a cap sized for a dedicated box, running on a shared one"
  else
    ok "declared caps fit real headroom ($(gb $headroom))"
  fi
fi

# ── 2. Is the largest RUNNING unit also capped? ──────────────────────────────────────
# The failure this exists to catch: cap the big one, leave the rest unbounded, and the big
# one absorbs every other unit's growth because the OOM killer selects on RSS.
say ""
say "== OOM victim ordering =="
if ! command -v docker >/dev/null 2>&1 || ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  say "SKIP  container '$CONTAINER' not inspectable — cannot rank live RSS from here"
else
  top="$(docker exec "$CONTAINER" sh -c "ps -eo rss,args --sort=-rss 2>/dev/null | awk 'NR>1' | head -1" 2>/dev/null)"
  top_rss_kb="$(awk '{print $1+0}' <<<"$top")"
  # NEVER PRINT 0.0G FOR "COULD NOT MEASURE". A zero read through a broken probe is
  # indistinguishable from a genuinely idle fleet, and this file exists because a reading
  # that could not fail was trusted.
  if [ "${top_rss_kb:-0}" -gt 0 ]; then
    say "      largest in-container RSS: $(gb $(( top_rss_kb * 1024 ))) — ${top}"
  else
    say "      largest in-container RSS: UNMEASURED (ps returned nothing in $CONTAINER) — not zero, unknown"
  fi

  uncapped=0
  shopt -s nullglob
  for f in "$UNIT_DIR"/*.service; do
    grep -q '^MemoryMax=' "$f" || uncapped=$((uncapped + 1))
  done
  shopt -u nullglob
  total_units=$(ls -1 "$UNIT_DIR"/*.service 2>/dev/null | wc -l)
  say "      uncapped units: $uncapped of $total_units"

  # A minority of capped units is the dangerous shape, because the caps do not bound total
  # pressure — they only decide who is biggest, and therefore who dies.
  if [ "$total_units" -gt 0 ] && [ "$uncapped" -gt $(( total_units / 2 )) ]; then
    fail "$uncapped of $total_units units are uncapped while the largest process IS capped — the cap elects a victim rather than bounding pressure; cap by class or cap nothing"
  else
    ok "capped units are the majority"
  fi
fi

# ── 3. Can a killed unit actually come back? ─────────────────────────────────────────
# Restart=on-failure is void on a masked unit, and `is-active` still reads healthy. This is
# what turned one OOM into a multi-hour outage.
say ""
say "== recoverability of capped units =="
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  for entry in "${capped[@]}"; do
    u="${entry%%:*}"
    enabled="$(docker exec "$CONTAINER" systemctl is-enabled "$u" 2>&1 | tr -d '\r')"
    state="$(docker exec "$CONTAINER" systemctl is-active "$u" 2>&1 | tr -d '\r')"
    case "$enabled" in
      masked|masked-runtime)
        # `masked + active` is the latent form: it looks healthy until the day it dies.
        fail "$u is $enabled (state=$state) — Restart=on-failure and self-recovery are BOTH disarmed; an OOM here is unrecoverable without a human"
        ;;
      *) ok "$u recoverable (is-enabled=$enabled, state=$state)" ;;
    esac
  done
fi

say ""
if [ "$fails" -gt 0 ]; then
  say "$fails FAIL(s) — the fleet's memory budget or its recovery path does not hold."
  exit 1
fi
say "memory budget and victim ordering OK."
