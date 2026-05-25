# Tasks: Impulse Lifecycle Events

## §1 — Event class definitions

- [ ] 1.1 Add the seven event class strings (`lifecycle:impulse:created`,
  `loaded`, `consumed`, `stale`, `invalidated`, `expired`, `unloaded`) to
  the canonical lifecycle-event registry in
  `repos/ias-executor-ts/src/ontology.ts`.
- [ ] 1.2 Define payload schemas per design §A; add TypeScript types in
  `repos/ias-executor-ts/src/lifecycle-events.ts` (new file).
- [ ] 1.3 Update discovery-vessel's known-lifecycle-events list so vessel
  hosts can validate subscription clauses at registration time.

## §2 — Pool mutation emit hook

- [ ] 2.1 Add an optional `emitter: LifecycleEmitter` constructor argument
  to `ImpulseStore` in `repos/ias-executor-ts/src/impulses.ts`.
- [ ] 2.2 Wire emit in `create`, `put`, `update`, `unload` per design §B.
- [ ] 2.3 Add `markStale(id, reason)` and `expireSweep()` methods.
- [ ] 2.4 Implement coalesced batched emission with a 100ms flush window
  for `consumed`, `stale`, `invalidated`, `expired`.
- [ ] 2.5 Default emitter is a no-op so ImpulseStore works without a
  subscriber attached (preserves existing call sites).

## §3 — Stale detection mechanisms

- [ ] 3.1 Implement explicit invalidation path: `markStale(id, reason)`
  emits and triggers provenance cascade.
- [ ] 3.2 Implement TTL sweeper: `expireSweep()` runs on 10s interval,
  scans for `staleAt` crossings, emits `lifecycle:impulse:expired`.
- [ ] 3.3 Define the watch-registration interface for vessels; provide
  example `BunFsWatcher` adapter in `repos/ias-executor-ts/src/adapters/`.

## §4 — Provenance graph

- [ ] 4.1 Implement `provenance(impulse_id)` query in activity-api
  (`repos/metabob-activity-api/src/services/provenance.ts`), bounded at
  depth 16 with memoization.
- [ ] 4.2 Implement `descendants(impulse_id)` query (forward traversal).
- [ ] 4.3 Wire the `markStale` provenance cascade per design §D, including
  the 50-event-per-second rate limit with batched cascade_path emission.

## §5 — Subscription clause schema extension

- [ ] 5.1 Extend `ActivityTemplate.subscription` schema in
  `repos/ias-executor-ts/src/ontology.ts` and the activity-api SurrealDB
  schema (new migration).
- [ ] 5.2 Add `applicability_filter: ImpulsePointer` evaluation path in
  `lifecycle-subscriber.ts`.
- [ ] 5.3 Add `must_fire: boolean` segregation in subscriber dispatch.
- [ ] 5.4 Verify backward compatibility: existing templates without
  `subscription` continue to work.

## §6 — Vessel registration extension

- [ ] 6.1 Extend `RegisterRequest` schema in discovery-vessel to accept
  optional `registered_activities` array.
- [ ] 6.2 Discovery-vessel forwards registered activities to activity-api
  via `activityTemplate_update` impulse with `owner_vessel_id` set.
- [ ] 6.3 On vessel deregistration, remove `ownership: vessel_local`
  templates from the subscriber index; preserve `ownership: global`.
- [ ] 6.4 Update `VesselDaemon` (from substrate-explicit-vessels Phase 0)
  to accept a `registered_activities` argument and forward to the
  registration loop.

## §7 — Dispatch flow integration

- [ ] 7.1 Add `lifecycle:impulse:*` to the R3 observer dispatch table in
  development-vessel.
- [ ] 7.2 Subscriber resolution: implement O(1) lookup by
  `(event_class, shape)` in `lifecycle-subscriber.ts`.
- [ ] 7.3 Thread Thompson recommendation through subscribers — the
  observer calls `POST /v2/activities/recommend` with
  `subscriber_template_ids` constraining the sample.
- [ ] 7.4 Update Phase 24 conditional posterior key derivation to include
  `event_signature` per design §E.

## §8 — Tests

- [ ] 8.1 Per-event-class unit tests in
  `repos/ias-executor-ts/test/lifecycle-events.test.ts`. Each event:
  emit → subscriber receives → payload matches schema.
- [ ] 8.2 Provenance cascade integration test: mark root stale, assert
  descendants emit `invalidated` with correct `cascade_path`.
- [ ] 8.3 Vessel registration test: register vessel with
  `registered_activities`, assert subscriber index reflects them, then
  deregister and assert vessel_local templates are removed.
- [ ] 8.4 Rate-limit test: emit 100 cascading invalidations in 1s, assert
  collapsed batched event.
- [ ] 8.5 Backward-compatibility test: existing subscription clauses
  (slot-binding, validator-dispatch) continue dispatching without code
  change.

## §S — Acceptance gates

- [ ] S.1 `bun test` in `repos/ias-executor-ts/` passes (≥ existing
  baseline + 30 new tests).
- [ ] S.2 `bun run lint` clean in ias-executor-ts and activity-api.
- [ ] S.3 In-container smoke test: in a fresh substrate, modify a file
  resolved by local-tools-vessel; observe `lifecycle:impulse:stale`
  emit; observe the registered hook activity dispatch via
  `GET /v2/activities/execution-traces?tag=intent:lifecycle_hook`.
- [ ] S.4 Provenance cascade in-container: trigger a root invalidation;
  verify ≥3 descendants emit `lifecycle:impulse:invalidated` with
  contiguous `cascade_path`.
- [ ] S.5 Thompson learning verification: 10 boredom-fired hook
  dispatches over 30 minutes; verify `total_selections > 0` and
  posterior α/β shift on at least one subscriber template (closing the
  Finding 3 §"Thompson learning is dead" regression).
- [ ] S.6 Documentation: add a section to
  `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` showing how a new
  vessel ships activity templates + subscriptions alongside its
  resolver contracts.
