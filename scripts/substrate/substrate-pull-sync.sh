#!/usr/bin/env bash
# substrate-pull-sync.sh — the substrate pulls its OWN source updates from git.
#
# Inverts host-pull-sync.sh / federation-pull-sync.sh: instead of a host pushing
# source into containers (docker cp), each substrate converges itself to
# origin/dev. Code flows ONLY through git remotes — this is both the update
# channel for a single substrate and how a fleet of substrates converges with no
# host mediating. Runs in-container as substrate-pull-sync.service:
#   - at boot (After=git-push-setup): converges the possibly-stale image-baked
#     /vessels runtime to the clones' origin/dev HEAD
#   - on substrate-pull-sync.timer: picks up changes landed on origin since
#
# Per vessel clone in $CLONE_DIR:
#   ahead of origin  -> skip (unpushed local cutover commits; push side owns it)
#   diverged         -> substrateGap + skip (never force)
#   behind           -> ff-only pull
#   HEAD != last-mirrored marker -> mirror-to-live + (if unit active) restart,
#     staggered + health-gated; a restart that goes unhealthy reverts to the
#     previous last-good pin and HALTS the run (emit substrateGap).
# Successful healthy mirror records /workspace/.last-good/<v> — the pin
# self-recovery reverts to (git-based, replacing revert-to-host-source).
#
# Skips the whole run while a mitosis cutover is in flight (fresh
# /workspace/mitosis-pending.json) so a pull can never clobber a mid-cutover
# mirror. Fail-open: no PAT / no network -> warn once and no-op (a substrate
# without pull access is frozen-but-functional).
set -uo pipefail

CLONE_DIR="${MITOSIS_PUSH_CLONE_DIR:-/workspace/git/vessels}"
RUNTIME_DIR="${MITOSIS_RUNTIME_DIR:-/vessels}"
INV="${VESSELS_INVENTORY:-/workspace/substrate/fleet/vessels.inventory.json}"
[ -f "$INV" ] || INV=/usr/local/share/substrate/vessels.inventory.json
MARKER_DIR=/workspace/.pull-sync
LAST_GOOD_DIR=/workspace/.last-good
BRANCH="${BRANCH:-dev}"
STAGGER_SECONDS="${STAGGER_SECONDS:-8}"
DEV_VESSEL="${DEV_VESSEL_ENDPOINT:-http://127.0.0.1:8090}"
MITOSIS_LOCK=/workspace/mitosis-pending.json
MITOSIS_LOCK_TTL_MIN="${MITOSIS_LOCK_TTL_MIN:-30}"
# Durable authoring-in-flight markers written by the working plane
# (patch_with_tools / feature_compose); pull-sync is a lifecycle actor and must
# consume them before converging a vessel. Deferral is FRESHNESS-only: the
# marker pid is the vessel server process (it outlives runs), so pid-liveness
# must not extend a deferral — a leaked marker would defer forever. A dead pid
# does short-circuit (vessel process gone = run definitely not in flight; the
# killed-run detector owns that marker).
AUTHORING_MARKER_DIR="${AUTHORING_MARKER_DIR:-/workspace/authoring-inflight}"
AUTHORING_MARKER_TTL_MIN="${AUTHORING_MARKER_TTL_MIN:-40}"
DEFERRAL_LOG=/workspace/pull-sync-deferrals.jsonl

mkdir -p "$MARKER_DIR" "$LAST_GOOD_DIR"
log() { echo "[pull-sync $(date -Iseconds)] $*"; }
emit_gap() {
  curl -s --max-time 8 -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$1" >/dev/null 2>&1 || true
}

# A cutover mid-flight owns /vessels mutation; never race it.
if [ -f "$MITOSIS_LOCK" ] && [ -n "$(find "$MITOSIS_LOCK" -mmin "-$MITOSIS_LOCK_TTL_MIN" 2>/dev/null)" ]; then
  log "mitosis cutover in flight ($MITOSIS_LOCK fresh) — skipping this run"
  exit 0
fi

# Change-window (2026-07-09 contiguous-shape-flow §5): a held change_window lease
# means a change-set is landing; pull-sync defers rather than converging mid-swap.
# TTL-bounded on the lease side, so a crashed holder cannot defer us forever.
CW_HELD="$(curl -s --max-time 5 -X POST "$DEV_VESSEL/v2/impulses/resolve" \
  -H 'Content-Type: application/json' \
  -d '{"impulse":{"type":"maintenanceLease","name":"change_window"}}' 2>/dev/null \
  | grep -o '"held":true' || true)"
if [ -n "$CW_HELD" ]; then
  log "change_window lease held — deferring this run"
  echo "{\"at\":\"$(date -Iseconds)\",\"actor\":\"pull-sync\",\"action\":\"deferred_change_window\"}" >> "$DEFERRAL_LOG" 2>/dev/null || true
  exit 0
fi

# Vessel -> unit map from the inventory (fallback: every clone dir, unit <v>.service).
vessel_unit() { # vessel -> systemd unit or empty
  if command -v jq >/dev/null 2>&1 && [ -f "$INV" ]; then
    jq -r --arg v "$1" '.vessels[] | select(.repo == $v) | .unit' "$INV" | head -1
  else
    echo "$1.service"
  fi
}

health_port() { # vessel -> port or empty
  if command -v jq >/dev/null 2>&1 && [ -f "$INV" ]; then
    jq -r --arg v "$1" '.vessels[] | select(.repo == $v) | .health_port // empty' "$INV" | head -1
  fi
}

healthy() { # port -> 0 if 200
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$1/health" 2>/dev/null | grep -q '^200$'
}

synced=0; skipped=0; failed=0
for d in "$CLONE_DIR"/*/; do
  [ -d "$d/.git" ] || continue
  v="$(basename "$d")"

  # 1. Fetch + classify vs origin.
  if ! git -C "$d" fetch -q origin "$BRANCH" 2>/dev/null; then
    log "$v: fetch failed (network/PAT?) — skipping"; skipped=$((skipped+1)); continue
  fi
  HEAD="$(git -C "$d" rev-parse HEAD 2>/dev/null || true)"
  REMOTE="$(git -C "$d" rev-parse "origin/$BRANCH" 2>/dev/null || true)"
  [ -n "$HEAD" ] && [ -n "$REMOTE" ] || { skipped=$((skipped+1)); continue; }

  if [ "$HEAD" != "$REMOTE" ]; then
    if git -C "$d" merge-base --is-ancestor "origin/$BRANCH" HEAD 2>/dev/null; then
      log "$v: clone ahead of origin (unpushed cutover commits) — leaving for the push side"
      skipped=$((skipped+1)); continue
    elif git -C "$d" merge-base --is-ancestor HEAD "origin/$BRANCH" 2>/dev/null; then
      git -C "$d" checkout -q "$BRANCH" 2>/dev/null || true
      if ! git -C "$d" pull --ff-only -q origin "$BRANCH" 2>/dev/null; then
        log "$v: ff-only pull failed — skipping"; skipped=$((skipped+1)); continue
      fi
      HEAD="$(git -C "$d" rev-parse HEAD)"
    else
      log "$v: clone DIVERGED from origin/$BRANCH — refusing (substrateGap)"
      emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-diverged-$v\",\"category\":\"source_divergence\",\"source\":\"substrate_detected\",\"summary\":\"$v clone at $CLONE_DIR diverged from origin/$BRANCH; pull-sync refuses to force — needs triage\",\"status\":\"open\"}}}}"
      failed=$((failed+1)); continue
    fi
  fi

  # 2. Mirror when the live runtime lags the clone.
  MARKER="$MARKER_DIR/$v.sha"
  LAST="$(cat "$MARKER" 2>/dev/null || true)"
  if [ "$HEAD" = "$LAST" ]; then continue; fi
  [ -d "$RUNTIME_DIR/$v" ] || { echo "$HEAD" > "$MARKER"; continue; }  # not part of this runtime

  # 2b. Drain-awareness: never converge a vessel whose working plane shows a
  # LIVE authoring run. Marker is live when its mtime is fresh (< TTL) OR its
  # recorded pid still exists; defer mirror+restart to the next tick. A marker
  # that is stale AND pid-dead is a KILLED run — ignored here, the killed-run
  # detector (self_interference_scan) owns that case.
  DEFER_MARKER=""
  for mk in "$AUTHORING_MARKER_DIR"/*-"$v".json; do
    [ -f "$mk" ] || continue
    [ -n "$(find "$mk" -mmin "-$AUTHORING_MARKER_TTL_MIN" 2>/dev/null)" ] || continue
    MPID="$(grep -o '"pid":[[:space:]]*[0-9][0-9]*' "$mk" 2>/dev/null | grep -o '[0-9]*$' | head -1)"
    if [ -n "$MPID" ] && ! kill -0 "$MPID" 2>/dev/null; then
      continue  # vessel process dead: not in flight; killed-run detector owns this marker
    fi
    DEFER_MARKER="$mk"; break
  done
  if [ -n "$DEFER_MARKER" ]; then
    log "$v: authoring run in flight ($DEFER_MARKER) — deferring convergence to next tick"
    printf '{"deferred_at":"%s","vessel":"%s","marker":"%s","head":"%s"}\n' \
      "$(date -Iseconds)" "$v" "$DEFER_MARKER" "$HEAD" >> "$DEFERRAL_LOG" 2>/dev/null || true
    emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-deferred-$v\",\"category\":\"convergence_deferral\",\"source\":\"substrate_detected\",\"summary\":\"pull-sync deferred converging $v to ${HEAD:0:10}: authoring marker $(basename "$DEFER_MARKER") is live (fresh or pid alive); retrying next tick instead of killing the in-flight run\",\"status\":\"open\"}}}}"
    skipped=$((skipped+1)); continue
  fi

  PREV_GOOD="$(cat "$LAST_GOOD_DIR/$v" 2>/dev/null || true)"
  log "$v: ${LAST:0:10} -> ${HEAD:0:10} — mirroring into $RUNTIME_DIR"
  if ! /usr/local/bin/mirror-to-live "$v" "$CLONE_DIR"; then
    log "$v: mirror failed — skipping"; failed=$((failed+1)); continue
  fi
  echo "$HEAD" > "$MARKER"

  # 3. Restart + health-gate (only for active long-running units).
  UNIT="$(vessel_unit "$v")"
  PORT="$(health_port "$v")"
  if [ -n "$UNIT" ] && [ "${UNIT%.service}" != "$UNIT" ] && systemctl is-active "$UNIT" >/dev/null 2>&1; then
    systemctl restart "$UNIT" 2>/dev/null || true
    sleep "$STAGGER_SECONDS"
    if [ -n "$PORT" ]; then
      ok=0
      for _ in 1 2 3 4 5; do healthy "$PORT" && { ok=1; break; }; sleep 4; done
      if [ "$ok" = 0 ]; then
        log "$v: UNHEALTHY after mirror+restart — reverting to last-good ${PREV_GOOD:0:10} and HALTING run"
        if [ -n "$PREV_GOOD" ] && git -C "$d" checkout -q "$PREV_GOOD" -- . 2>/dev/null; then
          /usr/local/bin/mirror-to-live "$v" "$CLONE_DIR" || true
          git -C "$d" checkout -q "$BRANCH" 2>/dev/null || true
          git -C "$d" reset --hard -q "$HEAD" 2>/dev/null || true
          systemctl restart "$UNIT" 2>/dev/null || true
        fi
        # marker stays at $HEAD (last ATTEMPTED sha): live code is PREV_GOOD,
        # but re-attempting the same bad commit every tick would be a mirror/
        # revert loop — the substrateGap below owns the escalation instead.
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-unhealthy-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v unhealthy after pull-sync to ${HEAD:0:10}; reverted to ${PREV_GOOD:0:10} and halted the sync run\",\"status\":\"open\"}}}}"
        failed=$((failed+1))
        break
      fi
    fi
  fi
  echo "$HEAD" > "$LAST_GOOD_DIR/$v"
  synced=$((synced+1))
done

log "done — synced=$synced skipped=$skipped failed=$failed"
exit 0
