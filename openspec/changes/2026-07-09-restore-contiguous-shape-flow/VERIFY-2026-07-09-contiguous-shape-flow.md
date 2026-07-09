# VERIFY — contiguous shape flow restored (2026-07-09)

Trace-inspected evidence that the event-driven cadence is live: **shape flow as the
primary means of selection processing, timers as degraded-mode watchdogs.** All
verification was performed against the running substrate (MCP dispatches + drain-log /
lease / spooled-trace inspection); every vessel-source change landed substrate-authored
through `feature_compose` with a traced commit — zero manual vessel-source edits.

## The cadence, measured

One full event-driven remedy cycle on a real detector-class gap
(`trace-store-reconcile-2026-07-09T02`, category `trace_store_reconciliation`):

| Step | Evidence | Time |
|---|---|---|
| Gap write (`substrateGap_write`, route `dispatchable`, pinned remedy) | `substrateGapWriteResult action:updated` | 07:03:46.347 |
| Pool mirror + `devvessel.gap.written` publish → WS → GapDrainObserver | drain-log `dispatched ok:true http_status:202` | 07:03:46.381 (**34 ms**) |
| goal-host loads `development-vessel:trace-store-reconcile` from the **local mirror** (hub unreachable) | activity-api log `GET /v2/activities/templates/... 200 1ms` | +~1 s |
| Template runs: lease acquire → token extract → `db_admin reconcile_trace_store` → health verify → lease release | spooled trace `exec_2ulr7ddi`: `status:success`, 5/5 tasks, output shapes `[maintenanceLeaseWriteResult, json_extracted_value, httpResponse, traceStoreHealthReport]`, verify task's `forbiddenPatterns:["over_cap":true]` gate passed | 4.4 s run |
| Operator verdict → oracle corpus | `goal_verification_labels:oqw59komnsn22auj38sw` (verdict `reached`, confidence 0.95) | — |
| Gap closed (condition cleared) | `substrateGap_write status:closed` after trace inspection | — |

**Gap→remedy-dispatch latency: 34 ms** (repeat measurements 29 ms / 38 ms / 44 ms on
earlier probes) vs the ~30–60 min timer floor measured 2026-07-09 — five orders of
magnitude. The acceptance target was < 5 minutes.

An earlier synthetic end-to-end probe (harmless `poolImpulse` remedy) measured
**~29 ms** gap-write → remedy-dispatch and validated per-category in-flight limiting
and the honest recording of failed dispatches.

## Timers demoted, quiet and writeless

- Wave 1: `gap-compose`, `funnel-drain` re-pointed via `watchdog.conf` drop-ins
  (sorts after `run-dir.conf`; original units/scripts intact, fully reversible) at the
  shared `watchdog-tick.ts` (super-repo commit `887577bd`). Both fired during the
  verification window and **exited 0 silently — no journal output beyond
  start/finish, no trace, no watchdog-log entry** (no restart was needed: the event
  path was alive).
- Wave 2: `compose-teacher`, `operator-goal-generator` re-pointed the same way;
  `boredom-vessel` (a long-lived daemon, not a oneshot tick) demoted by
  **cadence-stretch** (`BOREDOM_MIN_DISPATCH_INTERVAL_MS=600000`,
  exercise/autopromote hourly, idle window 30 min) — the selector is now the
  degraded-mode backstop, the drain consumer the primary.
- Watchdog semantics verified: quiet check = zero writes; the restart path (never
  triggered during the window — correct) writes one loud
  `information_yield:"watchdog_restart"` record.

## Trace generation correlates with goal activity, not wall-clock

Local trace-store inserts bucketed by hour (bounded read, `limit=100`):

```
04:00–05:00   39 inserts   (timer-exhaust regime)
05:00–06:00   53 inserts   (regime boundary + heavy compose work)
06:00–07:00    6 inserts   (post-demotion; all attributable to compose/reconcile work)
07:00–        2 inserts   (quiet hour — near write-silent)
```

## What landed (all substrate-authored via feature_compose unless noted)

**Cut 1 + 4 — standing pool feeds walk and selection:**
- `poolImpulse` / `poolImpulse_write` standing-pool resolvers on development-vessel
  (`WORKSPACE_ROOT/pool/standing.json`, atomic writes, upsert-by-id) — verified live
  (write/read/retire round-trip).
- goal-host walk seed hydrates from `poolImpulse {status:"open"}` (non-fatal).
- `compute_state_signature` folds `standing_intent_shapes` (commit `b72cd62f`).

**Gap route class as data:**
- `SubstrateGap.route` + `.remedy` fields; open gaps mirror into the standing pool,
  closed/rejected gaps retire their mirror (commits `a551ca8b`, `de9f77f7`).
- `trace_store_health_observer` pins `route:"dispatchable"`,
  `remedy:{vessel:"goal-host-vessel", target_template_id:"development-vessel:trace-store-reconcile"}`
  (commits `114cef49`, then template-dispatch correction); `db_contention_observer`
  emits `route:"composable"` (commit `a9e7f217`).

**Cut 2 + 3 — event-triggered drain:**
- `resolveSubstrateGapWrite` publishes `devvessel.gap.written` via activity-api
  `/v2/events/publish` (fire-and-forget, 2 s timeout, `X-Internal-Api-Key`)
  (commits `de3a0990`, `d55788f2`).
- `GapDrainObserver` WS service in development-vessel (ExecutionObserver model:
  authenticate + catchup, backoff, swallow-and-log): dispatchable+remedy →
  immediate dispatch (local resolve or goal-host `targetTemplateId`/`goal`);
  `execution_completed` → debounced standing-pool rescan (flow handoff);
  per-category in-flight cap 2; lease/change-window guard
  (commits `a080dfcb`, `ff55c56f`, `810afccb`, `425c70da`, `93674c6d` camelCase fix).

**Change-window + coordination:**
- `substrate-pull-sync` and `self-recovery-tick` defer while the `change_window`
  lease is held (host commit `887577bd`, deployed + smoke-run: 15 vessels healthy,
  clean pass). Watchdog ticks and the drain consumer check both `trace_store` and
  `change_window` leases (pausable citizens).

**2026-07-08 machinery made real (fixes found by exercising it end-to-end):**
- The reconcile template's `db_admin` call used the vessel-side `{impulse:…}`
  envelope; activity-api requires `{pointer:…, budget}` — every reconcile run
  400-ZodErrored (`exec_z20x6yrz`). Fixed in the seed (compose `d2c5860b`, commit
  `8b3d8eef`) and in the stored template via `activityTemplate_update` **with
  auditable evidence** (the governance rail demanded and received
  `evidence.reason`; the lease rail correctly refused an invalid probe token).
- goal-host `PRODUCER_DISCOVERY_ENDPOINT` was set to the unreachable hub, disabling
  the *existing* `getTemplateLocalFirst` wrap and making every `targetTemplateId`
  dispatch fail at template fetch. Restored to local (`/etc/substrate/goal-host-hub.env`)
  per that file's own stated intent ("producer discovery stays local"); hub-primary
  **write** topology untouched (traces still spool → hub).

## Failure attribution exercised in practice

Compose failures during this change were all correctly attributed and consumed:
- **Fix-failures** (draft defects): duplicate identifier, anchor-not-found,
  redeclared `const g`, single-branch guard caught by the semantic gate — each
  rolled back, penalized, and (in 3 of 4 cases) landed on retry via the lesson loop.
- **Environment-failures**: goal-host cutover interrupting its own in-flight dispatch
  (A4 — the change had actually landed); the operator-side agent credit exhaustion;
  the dead hub. None of these burned gap/approach credit.
- The remaining C1/C2/D1/D2 code paths (env-failure classes in `feature_compose`,
  cutover acquiring `change_window`, gap age-boundary re-verify, burial guard) are
  **partially landed** — see tasks.md for exact state; open items are tracked as
  gaps in the substrate's own store, not silently dropped.

## Findings filed back into the loop (gaps, not memory)

- `reach-gate-blind-to-template-dispatches-2026-07-09` (composable): pure
  `targetTemplateId` dispatches get `reached:false` + null completionShapes even on
  trace-verified success — event-path remedies read as false negatives until the
  reach-gate judges declarative reach (template outputShapes ⊆ produced).
- `detector-idle-writes-no-trace-2026-07-09` (composable, task E4): detector
  no-finding paths still write `information_yield:"idle"` traces; kill at source.
- Per-gap exponential backoff (5 min → 6 h cap) + `drain-remedy-failing-*`
  escalation gap at 3 consecutive failures: **landed** (guard substrate-authored
  `f93a9bab`; placement+bookkeeping applied as a documented operator direct edit
  after 5 honest drafter rollbacks — the escalate-after-N-losses rule applied to
  the drafter itself; typecheck clean, vessel healthy).
- `env-vs-fix-failure-attribution-2026-07-09` and
  `cutover-acquires-change-window-2026-07-09` (C1 + C2 dev-side): filed as
  composable gaps — the loop drains its own remaining backlog through the very
  path this change built. D1 (age-boundary re-verify → age *up* /
  `condition_cleared`, commit `db90246a`) and D2 (burial guard + park-with-reason,
  commit `cfd3dd89`) landed substrate-authored.

## Load-shed removal

Removed from the 7 demoted/recovery units (`gap-compose`, `funnel-drain`,
`operator-goal-generator`, `self-recovery`, `light-dispatch-healthcheck`,
`self-repair-operational`, `substrate-pull-sync`) — moot for demoted units,
design-cadence restored for recovery/infra. The 12 observer-tick stretches stay
deliberately until the `detector-idle-writes-no-trace-2026-07-09` gap drains
(design §4: observer ticks demote only after detector emission is event-clean —
removing their stretch before E4 would reintroduce the idle-write exhaust this
change exists to eliminate).

## Residual risk / open questions

- The hub (`138.197.116.56:18080`) remains unreachable; goal-host trace persistence
  is spool-and-replay (durable, verified replaying). When the hub returns, the spool
  drains automatically. Local learning reads (Thompson per-goal paths) are degraded
  until then — pre-existing condition, out of scope.
- `boredom-vessel` demotion is cadence-stretch, not intent-gated; a future slice can
  make the selector pass itself check the standing pool (making stretch unnecessary).
- The walk itself still terminates on reach (by design — bounded walks); contiguity
  is provided by the drain consumer's `execution_completed` handoff.
