# Restore contiguous shape flow (timers demoted to watchdogs)

## Why

The timers colonized the primary selection pathway and became a self-degrading loop.
Measured on the live substrate 2026-07-08/09:

- **Tick exhaust bloated the trace store**: `activity_execution_traces` reached ~220k
  rows / ~13 GB, a large fraction of it `information_yield: "idle"` administrative
  writes — scan resolvers dispatched on cadence that ran, found no work, and recorded a
  trace anyway. The 2026-07-08 reconciliation change capped the *accumulation* (lease +
  counters + copy-forward reconcile, landed in the container source); this change
  removes the *generation*.
- **Synchronized timer bursts caused the write contention** that wedged the event-driven
  paths (the 2026-06-21 coalescing fix treated a symptom of the same herd), which then
  justified more timer backstops — funnel-drain exists *explicitly because* the resolver
  it fires was starved in the selector; gap-compose exists because gap drain had no
  event trigger. Timers begat timers.
- **The gap→remedy latency floor is the timer interval**: ~30–60 min measured 2026-07-09
  (gap-compose at 20 min stretched to 1 h by load-shed). A `substrateGap` written at
  minute 1 waits for the next tick even though the write itself is the perfect trigger.

The architecture already contains everything needed for contiguous flow — an impulse
pool, a shape-graph walk, a WS event broadcaster with an open event vocabulary, a gap
store, state-conditioned selection — but four seams are cut, so every one of the ~9
authoring timers exists to bridge a cut that should not exist:

1. **Per-execution pool teardown** — the walk pool is function-local in
   `goal-host-vessel/src/index.ts` (`runGoalAsPoolWalk`, seeded ~:1210, GC'd on
   return). Nothing persists between executions, so nothing can *flow*; every cadence
   starts cold.
2. **Walk termination on reach rather than intent exhaustion** — the walk loop
   (`while (chain.length < MAX_STEPS && !targetMet())` + early-reach break) ends the
   *flow* when it ends the *goal*. Open standing intents are never consulted; the next
   selection waits for a timer.
3. **Polling where the WS lifecycle channel already exists** — `substrateGap_write`
   lands in `gaps.json` silently (no event); boredom-vessel polls goal-host completion
   in a 10s loop; development-vessel has zero WS subscriptions — while ribosome-vessel
   and concept-db's ExecutionObserver demonstrate the working subscribe pattern against
   the same broadcaster, and `POST /v2/events/publish` accepts arbitrary
   `<source>.<noun>.<verb>` events today.
4. **State-conditioned selection starved of standing-intent shapes** — neither the
   environment state-signature (`compute_state_signature`) nor the pool-shape context
   bucket (`context_thompson_scores` `effectiveShapes`) includes open gaps/objectives,
   so selection cannot condition on what the substrate is *supposed to be working
   toward*.

## What changes

Restore the pool-lifecycle architecture: **contiguous shape flow as the primary means
of selection processing, timers demoted to degraded-mode watchdogs.** Expressed in
existing primitives — no new tiers or categories.

- **Standing intents are pool-resident shapes.** A persistent standing pool owned by
  development-vessel (co-located with the gap store), exposed as `poolImpulse` /
  `poolImpulse_write` impulse shapes. Open `substrateGap`s and coarse objectives inject
  as standing pool impulses. Goal-host seeds every walk pool from the standing pool
  (cut 1), and standing-intent shapes fold into the state-signature / context-bucket
  keys (cut 4).
- **Detectors emit gaps with their route class as data.** `SubstrateGap` gains
  `route: "dispatchable" | "composable" | "human_required"` and optional
  `remedy: { vessel, impulse_type | activity }` fields. No operator-authored routing
  lanes in TypeScript — the detector that understands the gap declares how it drains.
  Dispatchable gaps with a pinned remedy (e.g. `trace_store_reconciliation` →
  `development-vessel:trace-store-reconcile`) dispatch on the event path, not through
  the compose-budget landability pick.
- **Event-triggered drain (cut 3).** `substrateGap_write` publishes a
  `devvessel.gap.written` event through activity-api `/v2/events/publish`; a drain
  consumer in development-vessel subscribes to `/ws` (ExecutionObserver model —
  authenticate + catchup handshake, exponential backoff, swallow-and-log) and services
  the gap within seconds: dispatchable→dispatch pinned remedy, composable→mark for
  compose, human_required→Obsidian solicitation. The same consumer subscribes to
  `execution_completed` to hand flow to the next standing intent (cut 2): reach ends
  the goal, the event path immediately re-evaluates the standing pool.
- **Timers become watchdogs.** Each demoted timer's tick is re-pointed (via the
  existing `run-dir.conf` active-scripts mechanism — units are not deleted) at a
  watchdog check: "open intents exist AND no corresponding pool/walk activity for N
  minutes" → restart flow (self-recovery semantics). Quiet check = **no trace written**.
  The in-container load-shed drop-ins (1–2 h stretches) stay until the event path is
  verified, then are removed as part of the cadence proof.
- **Failure attribution splits fix vs environment.** Landing failures classify into
  fix-failures (draft wrong → gap-scoped penalty + lesson, the existing
  `classifyComposeFailure` classes) and environment-failures (cutover race, boot race,
  held lease/change-window, stale manifest → **no** gap penalty, retry after the
  condition clears). `bumpFailedAttempts` and category calibration consume only
  fix-failures.
- **Change-window primitive.** The `maintenanceLease` landed 2026-07-08 generalizes to
  a pool-visible change-window: while a cutover/change-set holds it, self-recovery
  defers, pull-sync defers, competing ticks defer; release re-enables. Change-sets land
  atomically (resolver + wiring + test + unit + seed = one verify + one cutover),
  dependency-ordered from data, verified against the *running* state before the gap
  closes.
- **Gap lifecycle is decisions, not decay.** At age boundaries the gap's condition is
  re-verified (still true → age *up*, not buried); after N fix-failure losses on a
  blocking gap, escalate visibly (decompose / solicit human via the Obsidian resolver
  path / park-with-reason). Silent score-burial of a critical gap is a defect.

## Non-goals

- Deleting timer units (they are re-pointed, kept as degraded-mode recovery).
- Touching the reconcile/lease/counters mechanism from 2026-07-08 beyond generalizing
  the lease to the change-window.
- New selection tiers: the event drain *feeds* the existing walk/Thompson machinery; it
  does not replace it.

## Acceptance (the cadence proof, verified via MCP only)

1. A standing intent (injected or detector-emitted) is consumed by the WS-triggered
   drain **without any timer firing**; the dispatch's reach-gate reports
   `reached: true` (judged by `reached`, not `status`).
2. Gap→remedy latency for a dispatchable gap **< 5 minutes** (vs the ~30–60 min timer
   floor).
3. Watchdog timers stay quiet-and-writeless during the healthy window.
4. Trace-insert rate (via `trace_store_counters`) correlates with goal activity, not
   wall-clock — idle hours near write-silent.
5. Load-shed drop-ins removed after (1)–(4) hold; cadence recorded in a VERIFY doc and
   `provide_feedback` on the dispatch.

## SurrealDB constraints (carried forward, non-negotiable)

`type::datetime()` never `<datetime>` cast; ROOT path for DDL/deletes; omit optional
fields rather than sending null; no unbounded global ORDER BY / GROUP BY anywhere. All
new consumers go through the pausable-citizen guard.
