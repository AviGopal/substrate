# Tasks

Ordering is dependency-ordered from the data: store/shape surfaces first, emitters
second, consumers third, demotions only after the event path they replace is verified,
proof last. Vessel-source tasks dispatch through the substrate (feature_compose);
units/scripts/openspec are ungated direct edits.

## A. Standing pool + route class (cuts 1, 4 + gap data)

- [ ] A1. development-vessel: standing-pool store (`WORKSPACE_ROOT/pool/standing.json`,
      atomic writes) + `poolImpulse` / `poolImpulse_write` resolvers, three-place
      registration, upsert-by-id.
- [ ] A2. development-vessel: `SubstrateGap` gains optional `route` + `remedy` fields;
      `substrateGap_write` accepts + persists them; open gaps mirror into the standing
      pool (status follows gap lifecycle).
- [ ] A3. development-vessel: `trace_store_health_observer` (and db_contention_observer)
      emit `route:"dispatchable"` + pinned `remedy` on their gaps.
- [ ] A4. goal-host-vessel: walk seed block hydrates from `poolImpulse {status:"open"}`
      via discovery (non-fatal on failure, bounded to 20).
- [ ] A5. development-vessel: `compute_state_signature` folds
      `standing_intent_shapes` (top 8 open, sorted, from local file) into the hash
      fields.

## B. Event emission + drain consumer (cuts 2, 3)

- [ ] B1. development-vessel: `resolveSubstrateGapWrite` publishes
      `devvessel.gap.written` via activity-api `/v2/events/publish`
      (fire-and-forget, 2s timeout).
- [ ] B2. development-vessel: `GapDrainObserver` WS service (ExecutionObserver model:
      authenticate + catchup, backoff 1s→30s, swallow-and-log) subscribing to
      `devvessel.gap.written` + `execution_completed`; dispatch matrix per design §3;
      max 2 concurrent drains; per-class debounce; lease/change-window guard.
- [ ] B3. Verify end-to-end on the running substrate: write a synthetic dispatchable
      gap → observer dispatches remedy in seconds → remedy trace lands.

## C. Failure attribution + change-window (§5, §6)

- [ ] C1. development-vessel: environment-failure classes
      (`env_change_window_held | env_cutover_race | env_boot_race |
      env_stale_manifest`) detected before draft-blame classification;
      `failure_kind` recorded on the attempt; env failures skip `bumpFailedAttempts`
      + lessons + calibration; standing intent stays open for retry.
- [ ] C2. Change-window: cutover/change-set path acquires lease name `change_window`
      (TTL 10 min) before first file lands, releases after restart-verify;
      self-recovery + pull-sync + drain/watchdogs defer while held. Change-set =
      one verify + one cutover; gap closes only after the running vessel serves the
      new shape.

## D. Gap lifecycle decisions (§7)

- [ ] D1. development-vessel gap-lifecycle-scan: age-boundary re-verify (48h/7d/14d),
      condition-true → age *up* (`verified_age_boundaries`), condition-gone → close
      `condition_cleared`.
- [ ] D2. Escalation after 3 fix-failures on dispatchable/blocking gaps: visible
      escalate (human_required via Obsidian / decompose / park-with-reason), never
      silent burial; landability auto-close forbidden for verified/dispatchable gaps.

## E. Timer demotion (§4) — only after B3 passes

- [ ] E1. Watchdog tick script (shared template): open-intents check → relevant-flow
      check → recent-activity check → silent exit (no trace) OR loud restart-flow
      (one trace, `information_yield:"watchdog_restart"`).
- [ ] E2. Demote wave 1: `gap-compose`, `funnel-drain` → watchdog variant via
      active-scripts re-point. Confirm drains still happen (event path) and quiet
      ticks write nothing.
- [ ] E3. Demote wave 2: `compose-teacher`, `operator-goal-generator`,
      `boredom-vessel` tick. Same confirmation.
- [ ] E4. Observer ticks reviewed: detectors that emit gaps keep running (they are the
      *sources* of standing intents) but their no-finding path writes no trace
      (kill `information_yield:"idle"` writes at the source).

## F. Cadence proof (MCP-only) + cleanup

- [ ] F1. Inject (or let a detector emit) a standing intent; observe WS drain consume
      it with no timer firing; `goal_status` → `reached: true`; `goal_reasoning`
      inspected.
- [ ] F2. Telemetry: `trace_store_counters` insert-rate correlates with goal activity;
      gap→remedy latency < 5 min measured on a dispatchable gap.
- [ ] F3. Remove load-shed drop-ins; record cadence in VERIFY doc; `provide_feedback`
      on the proof dispatch.
