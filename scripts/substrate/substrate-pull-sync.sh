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
# does short-circuit (vessel process gone = run definitely not in flight) and
# such markers are REAPED below (see STALE_AUTHORING_MARKER_MIN) rather than
# left to wedge convergence until an operator deletes them.
AUTHORING_MARKER_DIR="${AUTHORING_MARKER_DIR:-/workspace/authoring-inflight}"
AUTHORING_MARKER_TTL_MIN="${AUTHORING_MARKER_TTL_MIN:-40}"
# Reap threshold for LEAKED markers. Markers are (re)written at run START and a
# live run defers convergence for at most AUTHORING_MARKER_TTL_MIN, so a marker
# whose recorded pid is dead OR whose mtime is past this threshold cannot
# describe an in-flight run — it is a leak (a run that exited without
# clearAuthoringMarker). Reap it here instead of leaving it to an operator.
STALE_AUTHORING_MARKER_MIN="${STALE_AUTHORING_MARKER_MIN:-90}"
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

content_hash() { # vessel-root -> md5 over sorted src/ + sql/ (.ts/.json/.surql); "none" if missing
  [ -d "$1" ] || { echo none; return; }
  # .json included so pure-template/config edits (e.g. lifecycle *.json activity
  # templates like ribosome-extract) are detected — a .ts-only hash left a
  # .json-only change invisible to convergence, so it never mirrored/deployed.
  # .surql (and the sql/ tree) included so a migration-only change (e.g. a new
  # DEFINE FIELD on a SCHEMAFULL table) is detected — migrations live in sql/,
  # outside src/, so a src-only hash left a migration-only commit invisible: it
  # never mirrored and the unit never restarted to apply it. Scan src + sql.
  (cd "$1" && find src sql -type f \( -name '*.ts' -o -name '*.json' -o -name '*.surql' \) 2>/dev/null | sort | xargs -r md5sum | md5sum | cut -d' ' -f1)
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
      # These clones are READ-ONLY reach-oracle sources: the oracles enumerate
      # /workspace/git/super-repo/repos/<v>/src to grade counts. A dirty tree
      # (abandoned drafter files, mitosis-overlay leakage) BLOCKS `git checkout`
      # (silently, via `|| true`), stranding the clone DETACHED + behind, and the
      # untracked cruft INFLATES the oracle's file/line counts → deterministic
      # reach graded green-on-wrong denominators. Discard cruft and land on the
      # BRANCH (not detached) before pulling. No legitimate edit ever lives only
      # in a clone — all real changes flow through /vessels + git commits.
      git -C "$d" reset --hard -q HEAD 2>/dev/null || true
      git -C "$d" clean -fd -q 2>/dev/null || true
      git -C "$d" checkout -q "$BRANCH" 2>/dev/null \
        || git -C "$d" checkout -qB "$BRANCH" "origin/$BRANCH" 2>/dev/null || true
      if ! git -C "$d" pull --ff-only -q origin "$BRANCH" 2>/dev/null; then
        log "$v: ff-only pull failed — skipping"; skipped=$((skipped+1)); continue
      fi
      HEAD="$(git -C "$d" rev-parse HEAD)"
    else
      # Divergence self-heal: origin advanced while the clone holds unpushed
      # SUBSTRATE-AUTHORED landings (the stranded-cutover class — previously a
      # forever-refiled pull-sync-diverged gap an operator resolved by hand).
      # When EVERY local-only commit's author AND committer is the substrate's
      # configured git identity, rebase onto origin and push. ANY operator-
      # authored local commit, rebase conflict, or push rejection → abort the
      # rebase cleanly and fall back to the gap (naming conflicting files).
      # Never force, never touch operator work.
      SELF_ID="${SUBSTRATE_GIT_AUTHOR_NAME:-Substrate Autonomous}"
      SYS_ID="$(git -C "$d" config user.name 2>/dev/null || true)"  # setup-git-push.sh's --system identity
      FOREIGN=""
      while IFS= read -r ident; do
        [ -n "$ident" ] || continue
        [ "$ident" = "$SELF_ID" ] && continue
        [ -n "$SYS_ID" ] && [ "$ident" = "$SYS_ID" ] && continue
        FOREIGN="$ident"; break
      done < <(git -C "$d" log --format='%an%n%cn' "origin/$BRANCH..HEAD" 2>/dev/null | sort -u)
      REBASED=""
      if [ -z "$FOREIGN" ]; then
        # Discard clone CRUFT only (untracked/dirty files are never legitimate
        # in these clones — same rationale as the behind branch above); local
        # COMMITS are preserved by the rebase.
        git -C "$d" reset --hard -q HEAD 2>/dev/null || true
        git -C "$d" clean -fd -q 2>/dev/null || true
        if git -C "$d" pull --rebase -q origin "$BRANCH" 2>/dev/null \
           && git -C "$d" push -q origin "HEAD:$BRANCH" 2>/dev/null; then
          REBASED=1
          HEAD="$(git -C "$d" rev-parse HEAD)"
          log "$v: DIVERGED with only substrate-authored local commits — rebased onto origin/$BRANCH and pushed (now ${HEAD:0:10})"
        fi
      fi
      if [ -z "$REBASED" ]; then
        CONFLICT_FILES="$(git -C "$d" diff --name-only --diff-filter=U 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
        git -C "$d" rebase --abort >/dev/null 2>&1 || true
        if [ -n "$FOREIGN" ]; then
          REASON="local-only commits include non-substrate author/committer '$(echo "$FOREIGN" | tr -d '"\\')' — refusing to auto-rebase"
        elif [ -n "$CONFLICT_FILES" ]; then
          REASON="auto-rebase hit conflicts in: $CONFLICT_FILES — rebase aborted cleanly"
        else
          REASON="auto-rebase/push failed (push rejection or transport) — rebase aborted cleanly"
        fi
        log "$v: clone DIVERGED from origin/$BRANCH — $REASON (substrateGap)"
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-diverged-$v\",\"category\":\"source_divergence\",\"source\":\"substrate_detected\",\"summary\":\"$v clone at $CLONE_DIR diverged from origin/$BRANCH; $REASON; pull-sync refuses to force — needs triage\",\"status\":\"open\"}}}}"
        failed=$((failed+1)); continue
      fi
    fi
  fi

  # 2. Mirror when the live runtime's CONTENT lags the clone. A marker that
  # records a git sha can lie about a tree it doesn't describe (marker == HEAD
  # while /vessels never received the mirror -> stale runtime forever); so the
  # skip decision compares the trees themselves, and the marker records the
  # last ATTEMPTED content hash — its only remaining job is re-attempt
  # suppression after an unhealthy revert (the substrateGap owns escalation).
  MARKER="$MARKER_DIR/$v.sha"
  LAST="$(cat "$MARKER" 2>/dev/null || true)"
  CLONE_HASH="$(content_hash "$d")"
  [ -d "$RUNTIME_DIR/$v" ] || { echo "$CLONE_HASH" > "$MARKER"; continue; }  # not part of this runtime
  RUNTIME_HASH="$(content_hash "$RUNTIME_DIR/$v")"
  # dist-freshness retry: a shared package whose src is already mirrored but whose
  # last fan-out was rolled back (an unhealthy consumer) leaves dist STALE vs src
  # with no retry — the src-only comparison below never re-enters 2c. Detect the
  # skew (last successful fan-out HEAD != current HEAD) and force a re-fan-out,
  # suppressed to once per HEAD via $v.fanout-fail so a persistently-unhealthy
  # consumer cannot cause a rebuild/revert loop (a new src change clears it).
  DIST_RETRY=""
  SELF_UNIT="$(vessel_unit "$v")"
  if { [ -z "$SELF_UNIT" ] || [ "${SELF_UNIT%.service}" = "$SELF_UNIT" ]; } \
     && [ -d "$RUNTIME_DIR/$v/dist" ] \
     && grep -q '"build"[[:space:]]*:' "$RUNTIME_DIR/$v/package.json" 2>/dev/null \
     && [ "$(cat "$LAST_GOOD_DIR/$v" 2>/dev/null || true)" != "$HEAD" ] \
     && [ "$(cat "$MARKER_DIR/$v.fanout-fail" 2>/dev/null || true)" != "$HEAD" ]; then
    DIST_RETRY=1
  fi
  if [ "$CLONE_HASH" = "$RUNTIME_HASH" ]; then
    if [ -z "$DIST_RETRY" ]; then
      [ "$LAST" = "$CLONE_HASH" ] || echo "$CLONE_HASH" > "$MARKER"
      continue
    fi
    log "$v: src converged but dist stale (last-good != ${HEAD:0:10}) — re-running fan-out"
  fi
  if [ -z "$DIST_RETRY" ] && [ "$LAST" = "$CLONE_HASH" ]; then continue; fi  # this exact content already attempted (unhealthy -> reverted); don't mirror/revert loop

  # 2b. Drain-awareness: never converge a vessel whose working plane shows a
  # LIVE authoring run — a marker that is fresh (< TTL) with its recorded pid
  # alive (or unrecorded) defers mirror+restart to the next tick, exactly as
  # before. Everything else is a LEAK: a dead pid means the authoring process is
  # gone; an mtime past STALE_AUTHORING_MARKER_MIN means the run that wrote it
  # is long over (markers are rewritten at run start, and deferral itself only
  # ever lasts AUTHORING_MARKER_TTL_MIN) — either way no matching run is in
  # flight, so REAP the marker loudly and proceed with the sync instead of
  # skipping past it forever until an operator deletes it.
  DEFER_MARKER=""
  for mk in "$AUTHORING_MARKER_DIR"/*-"$v".json; do
    [ -f "$mk" ] || continue
    MPID="$(grep -o '"pid":[[:space:]]*[0-9][0-9]*' "$mk" 2>/dev/null | grep -o '[0-9]*$' | head -1)"
    PID_DEAD=""
    if [ -n "$MPID" ] && ! kill -0 "$MPID" 2>/dev/null; then PID_DEAD=1; fi
    if [ -n "$PID_DEAD" ] || [ -z "$(find "$mk" -mmin "-$STALE_AUTHORING_MARKER_MIN" 2>/dev/null)" ]; then
      log "$v: REAPING leaked authoring marker $(basename "$mk") (pid=${MPID:-none}${PID_DEAD:+ DEAD}, older-than-${STALE_AUTHORING_MARKER_MIN}m=$([ -z "$(find "$mk" -mmin "-$STALE_AUTHORING_MARKER_MIN" 2>/dev/null)" ] && echo yes || echo no)) — no matching run in flight; proceeding with sync"
      printf '{"at":"%s","actor":"pull-sync","action":"reaped_marker","vessel":"%s","marker":"%s"}\n' \
        "$(date -Iseconds)" "$v" "$(basename "$mk")" >> "$DEFERRAL_LOG" 2>/dev/null || true
      rm -f "$mk" 2>/dev/null || true
      continue
    fi
    # Young live marker: keep the deferral exactly as before.
    [ -n "$(find "$mk" -mmin "-$AUTHORING_MARKER_TTL_MIN" 2>/dev/null)" ] || continue
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
  log "$v: content ${RUNTIME_HASH:0:10} -> ${CLONE_HASH:0:10} (git ${HEAD:0:10}) — mirroring into $RUNTIME_DIR"
  if ! /usr/local/bin/mirror-to-live "$v" "$CLONE_DIR"; then
    log "$v: mirror failed — skipping"; failed=$((failed+1)); continue
  fi
  echo "$CLONE_HASH" > "$MARKER"

  # 2c. Shared-package fan-out. A mirrored clone with NO unit of its own but a
  # build step that OTHER runtime vessels file:-dep (e.g. @avigopal/ias-executor-ts,
  # imported as its BUILT dist via absolute per-file symlinks in each consumer's
  # node_modules). Mirroring src alone leaves consumers on a stale dist. Build to a
  # STAGING dir and verify BEFORE any swap (a bad build touches no consumer), atomic-
  # swap dist (consumer symlinks are absolute, so this propagates by reference), then
  # restart each consumer staggered + health-gated; any consumer unhealthy restores the
  # prior dist, restarts the already-bounced consumers, emits a gap and HALTS. Reuses
  # vessel_unit/health_port/healthy/STAGGER_SECONDS/LAST_GOOD_DIR/emit_gap. Generic:
  # consumers are discovered at use-time (no hardcoded package/consumer list).
  SELF_UNIT="$(vessel_unit "$v")"
  if { [ -z "$SELF_UNIT" ] || [ "${SELF_UNIT%.service}" = "$SELF_UNIT" ]; } \
     && [ -d "$RUNTIME_DIR/$v/dist" ] \
     && grep -q '"build"[[:space:]]*:' "$RUNTIME_DIR/$v/package.json" 2>/dev/null; then
    CONSUMERS="$(grep -lE "file:[^\"]*/$v\"" "$RUNTIME_DIR"/*/package.json 2>/dev/null | xargs -r -n1 dirname | xargs -r -n1 basename | grep -vx "$v" || true)"
    if [ -n "$CONSUMERS" ]; then
      log "$v: shared package changed -- rebuilding dist for consumers: $(echo $CONSUMERS | tr '\n' ' ')"
      STAGE="$RUNTIME_DIR/$v/.dist.stage"; rm -rf "$STAGE"
      if ! (cd "$RUNTIME_DIR/$v" && /root/.bun/bin/bun run tsc --project tsconfig.build.json --outDir "$STAGE") || [ ! -s "$STAGE/index.js" ]; then
        log "$v: BUILD FAILED -- keeping live dist, no consumer touched"; rm -rf "$STAGE"
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-build-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v build failed at ${HEAD:0:10}; live dist kept, no consumer touched\",\"status\":\"open\"}}}}"
        failed=$((failed+1)); continue
      fi
      rm -rf "$RUNTIME_DIR/$v/.dist.prev"; mv "$RUNTIME_DIR/$v/dist" "$RUNTIME_DIR/$v/.dist.prev"; mv "$STAGE" "$RUNTIME_DIR/$v/dist"
      BOUNCED=""; bad=""
      for c in $CONSUMERS; do
        CU="$(vessel_unit "$c")"; CP="$(health_port "$c")"
        [ -n "$CU" ] && [ "${CU%.service}" != "$CU" ] || continue
        systemctl is-active "$CU" >/dev/null 2>&1 || continue
        systemctl restart "$CU" 2>/dev/null || true; BOUNCED="$BOUNCED $c"; sleep "$STAGGER_SECONDS"
        if [ -n "$CP" ]; then ok=0; for _ in 1 2 3 4 5; do healthy "$CP" && { ok=1; break; }; sleep 4; done; [ "$ok" = 1 ] || { bad="$c"; break; }; fi
      done
      if [ -n "$bad" ]; then
        log "$v: consumer $bad UNHEALTHY after fan-out -- restoring prior dist, restarting bounced, HALTING"
        rm -rf "$RUNTIME_DIR/$v/dist"; mv "$RUNTIME_DIR/$v/.dist.prev" "$RUNTIME_DIR/$v/dist"
        for c in $BOUNCED; do systemctl restart "$(vessel_unit "$c")" 2>/dev/null || true; done
        echo "$HEAD" > "$MARKER_DIR/$v.fanout-fail"  # suppress fan-out retry for this HEAD; a new src change (new HEAD) clears it — prevents a rebuild/revert loop on a persistently-unhealthy consumer
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-fanout-$v\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"$v fan-out to ${HEAD:0:10} left $bad unhealthy; dist reverted, run halted\",\"status\":\"open\"}}}}"
        failed=$((failed+1)); break
      fi
      rm -rf "$RUNTIME_DIR/$v/.dist.prev"; echo "$HEAD" > "$LAST_GOOD_DIR/$v"; rm -f "$MARKER_DIR/$v.fanout-fail"; log "$v: fan-out healthy across$BOUNCED"; synced=$((synced+1)); continue
    fi
  fi

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
        # marker stays at $CLONE_HASH (last ATTEMPTED content): live code is PREV_GOOD,
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

# 4. Super-repo convergence — the glue layer the vessel loop can't see: the
# federation transport server wrapper (federation-transport-vessel's ExecStart
# runs it FROM this clone), the boot-seeded active-scripts, and this updater
# itself. Same discipline as vessels: ahead -> skip, diverged -> gap + skip,
# behind -> ff-only pull. The marker records the last ATTEMPTED sha so an
# unhealthy convergence (reverted below) is not re-attempted every tick — only
# a fresh origin commit re-arms it. Runs after the vessel loop so a bad glue
# change can never block vessel convergence. Gap: super-repo-not-in-self-update-set.
SUPER_DIR="${SUPER_REPO_DIR:-/workspace/git/super-repo}"
SUPER_MARKER="$MARKER_DIR/super-repo.sha"
if [ -d "$SUPER_DIR/.git" ] && git -C "$SUPER_DIR" fetch -q origin "$BRANCH" 2>/dev/null; then
  SHEAD="$(git -C "$SUPER_DIR" rev-parse HEAD 2>/dev/null || true)"
  SREMOTE="$(git -C "$SUPER_DIR" rev-parse "origin/$BRANCH" 2>/dev/null || true)"
  SLAST="$(cat "$SUPER_MARKER" 2>/dev/null || true)"
  if [ -n "$SHEAD" ] && [ -n "$SREMOTE" ] && [ "$SREMOTE" != "$SLAST" ]; then
    if [ "$SHEAD" != "$SREMOTE" ]; then
      if git -C "$SUPER_DIR" merge-base --is-ancestor "origin/$BRANCH" HEAD 2>/dev/null; then
        log "super-repo: clone ahead of origin (unpushed commits) — leaving for the push side"
      elif git -C "$SUPER_DIR" merge-base --is-ancestor HEAD "origin/$BRANCH" 2>/dev/null; then
        git -C "$SUPER_DIR" checkout -q "$BRANCH" 2>/dev/null || true
        if git -C "$SUPER_DIR" pull --ff-only -q origin "$BRANCH" 2>/dev/null; then
          SHEAD="$(git -C "$SUPER_DIR" rev-parse HEAD)"
        else
          log "super-repo: ff-only pull failed — skipping"
        fi
      else
        log "super-repo: clone DIVERGED from origin/$BRANCH — refusing (substrateGap)"
        emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-diverged-super-repo\",\"category\":\"source_divergence\",\"source\":\"substrate_detected\",\"summary\":\"super-repo clone at $SUPER_DIR diverged from origin/$BRANCH; pull-sync refuses to force — needs triage\",\"status\":\"open\"}}}}"
        failed=$((failed+1))
      fi
    fi
    if [ "$SHEAD" = "$SREMOTE" ] && [ "$SHEAD" != "$SLAST" ]; then
      SPREV="$(cat "$LAST_GOOD_DIR/super-repo" 2>/dev/null || true)"
      if [ -n "$SLAST" ]; then
        CHANGED="$(git -C "$SUPER_DIR" diff --name-only "$SLAST..$SHEAD" 2>/dev/null || echo all)"
      else
        CHANGED="all"  # first convergence: no baseline, refresh everything
      fi
      echo "$SHEAD" > "$SUPER_MARKER"
      log "super-repo: ${SLAST:-none} -> ${SHEAD:0:10} — refreshing glue layer"
      # Converge submodule worktrees onto the new gitlinks: repos/<v> under the
      # super-repo are the reach-oracle enumeration source, and an ff-pull alone
      # leaves those worktrees detached at the OLD pointers — the stale-oracle
      # drift class behind the green-on-wrong denominator incident. Non-fatal:
      # a lagging worktree is logged, not a sync failure.
      git -C "$SUPER_DIR" submodule update --init --quiet 2>/dev/null \
        || log "super-repo: submodule update failed — oracle worktrees may lag"
      # Updater self-refresh (atomic: the running bash keeps its old inode).
      if [ -f "$SUPER_DIR/scripts/substrate/substrate-pull-sync.sh" ]; then
        install -m 0755 "$SUPER_DIR/scripts/substrate/substrate-pull-sync.sh" /usr/local/bin/.substrate-pull-sync.new 2>/dev/null \
          && mv -f /usr/local/bin/.substrate-pull-sync.new /usr/local/bin/substrate-pull-sync 2>/dev/null || true
      fi
      # mirror-to-live is part of the same glue layer: converge it too, or a
      # repo-side mirror fix never reaches the running container (the
      # super-repo-not-in-self-update-set gap class).
      if [ -f "$SUPER_DIR/scripts/substrate/mirror-to-live.sh" ]; then
        install -m 0755 "$SUPER_DIR/scripts/substrate/mirror-to-live.sh" /usr/local/bin/mirror-to-live 2>/dev/null || true
      fi
      # Reseed the active-scripts run-dir (same source substrate-active-scripts-seed uses at boot).
      cp -f "$SUPER_DIR"/scripts/substrate/*.ts /workspace/active-scripts/ 2>/dev/null || true
      # The relay is restarted ONLY on a real relay.ts change (never on first
      # convergence): bouncing it drops every peer's reservation at once.
      if [ "$CHANGED" != "all" ] && echo "$CHANGED" | grep -q '^scripts/substrate/federation-relay/relay\.ts$' \
         && systemctl is-active federation-relay.service >/dev/null 2>&1; then
        systemctl restart federation-relay.service 2>/dev/null || true
      fi
      if { [ "$CHANGED" = "all" ] || echo "$CHANGED" | grep -q '^scripts/substrate/federation-relay/'; } \
         && systemctl is-active federation-transport-vessel.service >/dev/null 2>&1; then
        systemctl restart federation-transport-vessel.service 2>/dev/null || true
        sleep "$STAGGER_SECONDS"
        ok=0
        for _ in 1 2 3 4 5; do healthy 8401 && { ok=1; break; }; sleep 4; done
        if [ "$ok" = 0 ]; then
          log "super-repo: federation-transport UNHEALTHY after convergence — reverting clone to ${SPREV:0:10} (marker keeps ${SHEAD:0:10}; substrateGap owns escalation)"
          [ -n "$SPREV" ] && git -C "$SUPER_DIR" reset --hard -q "$SPREV" 2>/dev/null || true
          systemctl restart federation-transport-vessel.service 2>/dev/null || true
          emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"pull-sync-unhealthy-super-repo\",\"category\":\"service_failure\",\"source\":\"substrate_detected\",\"summary\":\"federation-transport-vessel unhealthy after super-repo convergence to ${SHEAD:0:10}; clone reverted to ${SPREV:0:10}\",\"status\":\"open\"}}}}"
          failed=$((failed+1))
        else
          echo "$SHEAD" > "$LAST_GOOD_DIR/super-repo"
          synced=$((synced+1))
        fi
      else
        echo "$SHEAD" > "$LAST_GOOD_DIR/super-repo"
        synced=$((synced+1))
      fi
    fi
  fi
fi

log "done — synced=$synced skipped=$skipped failed=$failed"
exit 0
