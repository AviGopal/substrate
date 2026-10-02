# Design notes

Every mechanism below is anchored to a verified seam in the live source (container
`/vessels/*` is authoritative; host `repos/*` lags). File:line refs are from the
2026-07-09 code survey.

## 0. The architecture being restored

The intended pool-lifecycle: shapes flow into a pool → selection is conditioned on
pool content → activities consume/produce shapes → new shapes trigger the next
selection → flow continues until no standing intent is serviceable. The timers replaced
step "new shapes trigger the next selection" with wall-clock, which meant (a) every
tick pays cold-start (pool is empty), (b) latency floor = interval, (c) ticks run with
nothing to do and write idle traces, (d) synchronized ticks contend for the single
writer. Restoring the trigger removes the timers' reason to exist; they remain only as
watchdogs for the degraded mode where the event path itself is down.

## 1. Standing pool (cuts 1 + 4)

**Store.** development-vessel owns a persistent standing pool beside the gap store:
`WORKSPACE_ROOT/pool/standing.json`, atomic tmp+rename writes (the `saveGaps` pattern,
substrate-gap.ts:163). Entries:

```ts
interface StandingImpulse {
  id: string;            // stable, upsert-by-id
  shape: string;         // e.g. "substrateGap", "objective"
  body: unknown;         // gap snapshot or objective text
  source: string;        // detector/operator/consumer that injected it
  status: "open" | "consumed" | "retired";
  injected_at: string; updated_at: string;
}
```

**Surface.** `poolImpulse` (read: filters `id | shape | status | limit`) and
`poolImpulse_write` (upsert) registered per the three-place rule (config.ts shapes,
routes/impulses.ts dispatch, resolver file). Two producers initially:
- `substrateGap_write` mirrors open gaps into the standing pool (status follows the
  gap: closed/rejected gap → retired standing impulse) — gaps *are* standing intents.
- Operators/consumers inject coarse objectives directly via `poolImpulse_write`.

**Walk seeding (cut 1).** `runGoalAsPoolWalk` seed block (goal-host
index.ts:1210-1214): after seeding the goal impulse, fetch
`poolImpulse {status:"open", limit:20}` from development-vessel via discovery and
`addToPool(shape, body)` each standing impulse. Failure to fetch is non-fatal
(swallow-and-log): the walk degrades to today's behavior. Standing impulses are
*context*, not targets — `targetMet()` is unchanged; the walk does not have to satisfy
them, it can now *see* them.

**Selection conditioning (cut 4).** `compute_state_signature`
(development-vessel compute-state-signature.ts, hash-field assembly ~:350-380) gains a
`standing_intent_shapes` field: the sorted distinct shapes + route classes of open
standing impulses (bounded: top 8 by age), read from the local standing pool file
(O(1), no DB). This keys `context_thompson_scores` selection on "what the substrate is
supposed to be working toward", so posteriors learned while e.g. a
`trace_store_reconciliation` intent is open are conditioned on that fact.

**Why not persist the walk pool itself:** the walk pool contains execution-scoped
intermediates (walk-<shape>-<seq> ids) that are meaningless across executions and
would grow without bound. The standing pool holds only *intents* — the durable subset —
and the walk pool is hydrated from it. Pool teardown stays (it is correct GC); what was
missing is the durable layer underneath.

## 2. Route class as gap data (no operator routing lanes)

`SubstrateGap` (substrate-gap.ts:76-88) gains:

```ts
route?: "dispatchable" | "composable" | "human_required";
remedy?: { vessel: string; impulse_type?: string; goal?: string };  // pinned drain path
```

The **detector** that emits the gap declares the route — it is data flowing with the
gap, not a switch statement in a router. Defaults preserve today's behavior: absent
`route` ⇒ `composable` (drains through gap-to-feature's landability pick, unchanged).
Known pinned remedies land with their detectors, e.g. `trace_store_health_observer`
emits `route: "dispatchable", remedy: { vessel: "development-vessel", impulse_type:
"trace_store_reconcile" }`. `human_required` routes to the existing Obsidian
solicitation path.

Dispatchable gaps **bypass the compose-budget landability pick** — they are not
authoring work; ranking them against composable gaps both starves them and wastes
compose budget.

## 3. Event-triggered drain (cut 3)

**Emit.** `resolveSubstrateGapWrite` (substrate-gap.ts:208), after the store write,
POSTs `POST /v2/events/publish` on activity-api with type `devvessel.gap.written`
(matches the existing `<source>.<noun>.<verb>` regex, events.ts:35), body
`{ gap_id, category, route, remedy?, status }`. Fire-and-forget with a 2s timeout;
publish failure never fails the write (the watchdog covers the lost-event case).

**Consume.** A `GapDrainObserver` service inside development-vessel (the gap store
lives there; resolvers live where data lives), modeled line-for-line on concept-db's
`execution-observer.ts`: connect activity-api `/ws` → `{type:"authenticate", token}` →
`{type:"catchup", lastSeenSequence}` on reconnect → exponential backoff 1s→30s → every
handler swallows and logs. Subscriptions:

- `devvessel.gap.written` with `route:"dispatchable"` + `remedy` → **dispatch the
  remedy now**: resolve `remedy.impulse_type` on `remedy.vessel` directly (same-vessel
  remedies are a local resolver call; remote go via discovery), or POST goal-host
  `/run-goal` when `remedy.goal` is set. Debounced per gap class (one in-flight remedy
  per class; re-fire after completion if the gap is still open).
- `devvessel.gap.written` with `route:"composable"` → mark the gap drain-eligible and
  nudge one `gap_to_feature` cycle **iff none ran in the last 5 min** (the compose
  budget still applies; the event replaces the 20-min wait, not the budget).
- `execution_completed` → **flow handoff (cut 2)**: re-read the standing pool; if open
  standing intents exist whose remedy/compose path is idle, trigger the matching drain
  as above. This is what makes flow *contiguous*: reach ends the goal, the completion
  event immediately re-evaluates standing intents. The walk loop itself is untouched —
  termination-on-reach is correct per-goal; continuation is the drain consumer's job
  (bounded walks, no runaway MAX_STEPS inflation).

**Guards.** Every drain action goes through the pausable-citizen guard: check
`maintenanceLease("trace_store")` and the change-window (§5) before dispatching;
held → defer (the completion/next event retries). The consumer keeps a small in-memory
in-flight set so a burst of gap writes cannot fan out into a dispatch herd (max 2
concurrent drains).

**Latency budget:** gap write → event publish (≤2s) → WS delivery (ms) → dispatch
(immediate) ⇒ seconds-to-minutes, vs the 30–60 min timer floor.

## 4. Timers → watchdogs

Demoted units are **re-pointed, not deleted**, using the existing `run-dir.conf`
active-scripts mechanism (ExecStart → `/workspace/active-scripts/<script>.ts`, hot-
swappable without container rebuild). Each demoted tick script is replaced by a
watchdog variant with self-recovery semantics:

```
watchdog(unit):
  intents = poolImpulse { status: "open" }          # local file read
  if intents empty            → exit 0 (silent, NO trace, no resolve call)
  relevant = intents this unit's flow would service
  if relevant empty           → exit 0 (silent)
  activity = drain-consumer heartbeat + last dispatch/walk touching those intents
  if activity within N min    → exit 0 (silent)     # flow is alive; do nothing
  else → restart flow: log loudly, re-emit the drain trigger (re-publish gap.written
         or directly fire the old tick's resolver ONCE), write ONE trace attributing
         information_yield: "watchdog_restart"
```

N defaults to 3× the expected drain latency (15 min). The quiet path makes **zero**
writes — this is what turns idle hours write-silent. Demotion order (blast radius):
first `gap-compose` + `funnel-drain` (pure drain bridges, fully covered by §3), then
`compose-teacher`, `operator-goal-generator`, `boredom-vessel` tick (its selector value
moves behind the drain consumer), then observer ticks only after the detector-emission
path is event-clean. Recovery-class timers (`self-recovery`, `coherence-recover`,
`light-dispatch-healthcheck`, `db-maintenance`, `substrate-pull-sync`, obsidian-*) are
**not** demoted — they are already watchdogs/infra.

Load-shed drop-ins (in-container `*.timer.d/load-shed.conf`, 1–2h stretches) stay
until the cadence proof passes, then are removed in the same commit as the VERIFY doc.

## 5. Change-window (generalized lease) + atomic change-sets

`maintenance-lease.ts` (landed 2026-07-08) already supports named leases. Generalize by
convention, not new code shape: a well-known lease name `change_window` with
`holder = <cutover/change-set id>`. Consumers added to the pausable-citizen guard:

- `self-recovery` tick: a failing unit whose vessel is named in the held change-window
  is **not** restarted/reverted (the cutover is allowed to look broken mid-swap).
- `substrate-pull-sync`: defers the pull while a change-window is held.
- The drain consumer + demoted watchdogs: defer, retry next event/tick.

**Atomic change-sets.** `feature_compose`/cutover acquires `change_window` before the
first file lands and releases after restart-verify. A change-set = resolver + wiring +
test + unit + seed landing as **one verify + one cutover**, dependency-ordered from the
data (imports before importers, config/routes with the resolver they register), and the
gap closes only after the *running* vessel serves the new shape (resolve it
post-restart) — not after typecheck. TTL (default 10 min) keeps a crashed cutover from
wedging the fleet; expiry = release.

## 6. Failure attribution: fix vs environment

`classifyComposeFailure` (feature-compose.ts:932) classes are all draft-blame today.
Add a disjoint environment set, detected *before* draft-blame classification:

- `env_change_window_held` — land/cutover refused because lease/change-window held;
- `env_cutover_race` — target vessel restarted/mutated between draft and land
  (manifest hash mismatch, git non-ff);
- `env_boot_race` — target unit not yet active when verify ran;
- `env_stale_manifest` — spec drafted against source that changed underneath.

Environment failures: **no** `bumpFailedAttempts`, no `failure_lessons` append, no
category calibration input; the attempt re-queues (standing intent stays open, drain
retries after the condition clears — the completion event or watchdog re-fires it).
Fix failures: exactly today's path (gap-scoped penalty + lesson + narrowed-child at 3).
The split is recorded on the attempt record (`failure_kind: "fix" | "environment"`) so
the oracle corpus can audit the boundary.

## 7. Gap lifecycle: decisions at age boundaries

gap-lifecycle-scan.ts today closes on staleness (48h stale_low_value, 336h
expired_not_redetected) and buries on landability score — passive decay. Change to
decisions:

- **Age-boundary re-verify:** at each boundary (48h, 7d, 14d) the scan re-runs the
  gap's *condition* where cheaply checkable (detector re-emission counts as
  verification — upsert-by-id already refreshes `updated_at`; for detector-less gaps,
  re-resolve the emitting observer once). Condition still true → **age up**: bump a
  `verified_age_boundaries` counter, raise (not lower) drain priority. Condition gone →
  close `condition_cleared` (honest, distinct from `stale_low_value`).
- **Escalation after N losses:** on the 3rd *fix*-failure of a `route:"dispatchable"`
  or blocking gap, escalate visibly instead of narrowing silently: emit route
  `human_required` (Obsidian solicitation) OR decompose (existing
  investigate-and-decompose-gap activity) OR park with explicit
  `parked_reason`. Composable gaps keep today's narrowed-child behavior.
- **Critical-gap burial guard:** `gap-landability-model` auto-close is forbidden for
  gaps with `verified_age_boundaries ≥ 1` or `route:"dispatchable"` — a verified-true
  or directly-drainable gap may be parked with reason, never silently buried.

## 8. What is NOT changing

- Walk termination semantics (`targetMet()`, early-reach break, MAX_STEPS) — reach
  still ends the goal; contiguity comes from the event handoff, keeping walks bounded.
- The landability-ranked compose pick — still governs *composable* gaps.
- The 2026-07-08 reconcile mechanism (counters, copy-forward, db-admin `reconcile`).
- Timer unit *files* — drop-in/active-script re-pointing only.

## SurrealDB + citizen constraints (restated, enforced in review)

- `type::datetime()` function, never `<datetime>` cast.
- ROOT path (`surrealDB.query`) for DDL/deletes; never `queryWithAuth` for maintenance.
- Omit absent optional fields; never JSON `null` into `option<X>`.
- No unbounded global `ORDER BY` / `GROUP BY` — every "recent" read is WHERE-bounded.
- Every new periodic/reactive consumer checks the lease/change-window (pausable
  citizen) before touching the trace store.
