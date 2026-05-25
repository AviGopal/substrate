# Design: Impulse Lifecycle Events

## Context

`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` §61 declares lifecycle
events are impulses of shape `lifecycle:*`, routed through subscribed
meta-activities. The system has implemented this idiom at the task and
execution layers but not at the impulse layer itself. The pool
(`repos/ias-executor-ts/src/impulses.ts:29-110`) mutates silently —
`create`, `put`, `update`, `unload`, `findByShape`, `formatForContext`
all manipulate the store without an event surface.

The substrate's interface to the environment IS the impulse layer. A
filesystem mutation lands as a stale `fileContents` impulse; a peer-vessel
state shift lands as an invalidated cross-vessel impulse; a TTL crossing
lands as an expired session impulse. Without a lifecycle event class at
this layer, the substrate cannot observe environmental change.

This design extends the existing lifecycle hook idiom (Idiom 4 in
`docs/CORE_IDIOMS.md:152-185`) downward to cover impulse-layer events. It
does not introduce a new primitive — events flow through
`LifecycleSubscriberVessel`, dispatch through the R3 observer, and update
posteriors through the normal recommend pipeline.

## §A — The event taxonomy

Seven event classes. All carry a base payload `{ impulse_id, shape,
timestamp }` plus the event-specific fields listed below. All emit through
the host's `LifecycleSubscriberVessel.emit()`.

### A.1 — `lifecycle:impulse:created`

Fires when an impulse first enters the pool via `ImpulseStore.create()` or
`ImpulseStore.put()` for a previously-unknown id.

Payload extension:
```
{
  pointer: ImpulsePointer,
  metadata: ImpulseMetadata,
  produced_by_task_id?: string,
  produced_by_execution_id?: string
}
```

Emit site: `ImpulseStore.create`, `ImpulseStore.put` (when id is new).
Expected subscribers: vessels that want to react to new shape arrivals
(e.g., `extract-concepts-from-doc` on `fileContents` for docs/ paths).
Failure mode: if subscribers crash, dispatch swallows per Idiom 4; the
created impulse remains in the pool.

### A.2 — `lifecycle:impulse:loaded`

Fires when an impulse's content is materialized — `loaded` transitions
from `false` to `true`.

Payload extension:
```
{
  bytes_loaded: number,
  resolver_id: string,
  resolver_tier: "deterministic" | "pattern" | "llm",
  latency_ms: number
}
```

Emit site: end of resolver dispatch (after `impulseStore.update(id, {
loaded: true, content })`). Expected subscribers: cost-tracking activities,
loaded-content cache primers, low-priority impulse-relevance learners.

### A.3 — `lifecycle:impulse:consumed`

Fires when an impulse is read by a task's resolver — i.e. it appears in
`input_impulse_ids` of a `lifecycle:task:completed` payload.

Payload extension:
```
{
  consumed_by_task_id: string,
  consumed_by_template_id: string,
  consumed_by_execution_id: string
}
```

Emit site: piggybacks on `lifecycle:task:completed`; one consumed event
per input impulse. Distinguishing the per-impulse event from the per-task
event matters for shape-conditional learning — a subscriber that cares
about a specific shape doesn't have to demux the task-event payload.

### A.4 — `lifecycle:impulse:stale`

Fires when the producer of an impulse detects that the underlying source
has changed and the cached content no longer reflects truth. This is the
**environmental change** signal.

Payload extension:
```
{
  reason: "file_modified" | "ttl_expired" | "peer_state_change" |
           "explicit_invalidation" | "watch_signal",
  detector_vessel_id: string,
  detected_at: ISO-8601,
  source_change?: { type: string, ...detector-specific }
}
```

Emit site: explicit `impulseStore.markStale(id, reason)` call from any
vessel, OR TTL crossing on the pool's TTL sweeper, OR watch-handler
emission from a vessel-owned watcher. See §C for the three mechanisms.

### A.5 — `lifecycle:impulse:invalidated`

Fires when an upstream impulse in the provenance chain has been marked
stale or invalidated, and the cascade reaches this impulse.

Payload extension:
```
{
  root_cause_impulse_id: string,
  cascade_depth: number,
  cascade_path: string[]   // impulse ids from root to self
}
```

Emit site: provenance walker. When `markStale(X)` is called, walker
queries the producer-chain index, finds impulses that consumed X (or were
produced from X), and emits `invalidated` for each. See §D.

### A.6 — `lifecycle:impulse:expired`

Fires when a TTL-bound impulse crosses its expiry timestamp without
having been refreshed.

Payload extension:
```
{
  expired_at: ISO-8601,
  ttl_ms: number,
  was_loaded: boolean
}
```

Emit site: pool TTL sweeper (interval-based, default 10s). Distinct from
`stale` because `expired` is a time-based property of the impulse's own
contract, not a detection of source change.

### A.7 — `lifecycle:impulse:unloaded`

Fires when an impulse's content is released to free memory —
`loaded` transitions from `true` to `false` via
`ImpulseStore.unload(id)`.

Payload extension:
```
{
  reason: "memory_pressure" | "explicit_unload" | "expired_cascade",
  bytes_freed: number
}
```

Emit site: `ImpulseStore.unload`. Expected subscribers: low-priority
metrics; this is the least-load-bearing event of the seven.

## §B — Pool mutation emit hook

`ImpulseStore` gains an optional `emitter: LifecycleEmitter` reference set
at construction. The emitter interface:

```typescript
interface LifecycleEmitter {
  emit(event: { type: string; timestamp: string; data: Record<string, unknown> }): void;
}
```

The store's mutation methods become emit-aware:

- `create(input)` — emit `lifecycle:impulse:created` **after** the
  Map.set completes (atomic; failure of the subscriber doesn't unwind
  the store mutation).
- `put(impulse)` — same as create when id is new; emits
  `lifecycle:impulse:stale` (reason: `explicit_invalidation`) when id
  exists and the new metadata differs from the old.
- `update(id, patch)` — emits `lifecycle:impulse:loaded` when
  `loaded: true` is in the patch and the prior state was `false`.
- `unload(id)` — emits `lifecycle:impulse:unloaded` with the freed
  byte count.
- `markStale(id, reason)` (new method) — emits `lifecycle:impulse:stale`
  and triggers provenance cascade per §D.
- `expireSweep()` (new method, called on interval) — scans for
  TTL-crossing impulses and emits `lifecycle:impulse:expired`.

**Atomic vs. batched.** `created`, `loaded`, `unloaded` emit
synchronously alongside the mutation; the cost is one method call per
mutation. `consumed`, `stale`, `invalidated`, `expired` may be batched
when emission rate exceeds 100/sec — the emitter coalesces by
`(event_type, shape)` and flushes every 100ms. The pool publishes its
configured batching policy as a metric.

**Where this lands**: `repos/ias-executor-ts/src/impulses.ts` gains the
emitter wiring; `repos/ias-executor-ts/src/lifecycle-subscriber.ts`
gains a no-op default emitter so `ImpulseStore` works in isolation
without a subscriber attached.

## §C — Stale detection mechanisms

Three independent mechanisms, all routing through
`impulseStore.markStale(id, reason)`. Vessels owning a shape choose which
mechanism (or combination) fits.

### C.1 — Explicit invalidation

Vessel code calls `impulseStore.markStale(id, "explicit_invalidation")`
when it knows from out-of-band signal that an impulse is stale. This is
the simplest path and the one used by sync-on-write scenarios (e.g., a
write resolver that mutates a file knows the read impulse is stale).

### C.2 — TTL-based

The impulse pointer carries an optional `staleAt: ISO-8601` field. The
pool's `expireSweep` (interval-based, default 10s) scans for crossings
and emits `lifecycle:impulse:expired`. Distinct from stale: expired is
a contractual lifecycle property; stale is a freshness assertion.
Vessels may subscribe to `expired` and refresh by re-resolving the
pointer, which produces a new `created` event on the refreshed
impulse.

### C.3 — Watch-based

Vessels register watchers at startup. Three concrete forms:

- **Filesystem watch** — local-tools-vessel registers `Bun.fs.watch()`
  callbacks on directories that have produced `fileContents` impulses.
  On change, the vessel calls `markStale` for each affected impulse.
- **WebSocket peer** — concept-db-vessel subscribes to activity-api's
  `/ws` and on relevant `task.completed` events calls `markStale` for
  concept-graph impulses that referenced the affected concept.
- **Time tick** — boredom-vessel emits `lifecycle:substrate:idle` per
  Finding 3 of substrate-explicit-vessels; this is a degenerate
  watch-based mechanism where the "source" is wall-clock time and no
  individual impulse is marked stale.

Watch-based detection is the only mechanism that requires per-vessel
implementation effort. The vessel registration extension (§F) is where
that effort is declared.

## §D — Provenance graph

Each trace already records per-task `input_impulse_ids` and
`output_impulse_ids` (CLAUDE.md "Execution Trace Model"). The
provenance graph is the transitive closure: impulse Y is in the
provenance of impulse X iff some chain of tasks produced X from Y.

This spec does NOT introduce a new storage layer. Instead, it defines
two query operations on the existing trace store:

- `provenance(impulse_id) → impulse_id[]` — returns all impulses
  in this impulse's provenance.
- `descendants(impulse_id) → impulse_id[]` — returns all impulses
  produced (directly or transitively) from this impulse.

Implementation: walks `activity_execution_traces` rows joining on
`output_impulse_ids` → `input_impulse_ids`. Bounded by a max-depth
(default 16, matching the existing composition_chain cap) and a
per-request memoization cache.

**Transitive invalidation.** When `markStale(X)` is called:
1. Emit `lifecycle:impulse:stale` for X.
2. Walk `descendants(X)` up to max-depth.
3. For each descendant D, emit `lifecycle:impulse:invalidated`
   with `cascade_path` populated.

The cascade is rate-limited: more than 50 `invalidated` events from a
single root within 1s collapse into one batched event with
`cascade_path` listing all affected ids. This prevents thrash on
high-fanout shapes (e.g., a `directoryTree` impulse whose descendants
include hundreds of `fileContents` reads).

## §E — Subscription clause extension

Activity templates gain an optional `subscription` array. Each entry:

```typescript
type Subscription = {
  event: string;                              // "lifecycle:impulse:stale" etc.
  shape?: string;                             // filter to specific impulse shape
  state_filter?: Record<string, unknown>;     // filter on event payload fields
  priority: number;                           // 0-100; ties broken by Thompson
  applicability_filter?: ImpulsePointer;      // computed pointer returning bool
};
```

Examples:

```json
{
  "subscription": [
    {
      "event": "lifecycle:impulse:stale",
      "shape": "fileContents",
      "state_filter": { "reason": "file_modified" },
      "priority": 80
    }
  ]
}
```

```json
{
  "subscription": [
    {
      "event": "lifecycle:impulse:expired",
      "shape": "session",
      "priority": 100
    }
  ]
}
```

The existing slot-binding / validator-dispatch / boredom-eligible
subscriptions use the same form. This spec generalizes the schema; no
existing subscription needs migration.

Thompson Sampling keys posteriors on `(template_id, event_signature)`
where `event_signature = event + shape + canonicalize(state_filter)`.
Phase 24 conditional posteriors extend naturally — the event_signature
becomes another condition.

## §F — Vessel registration extension

Discovery-vessel's `RegisterRequest` (today shapes + resolver contracts)
gains an optional `registered_activities` field:

```typescript
type RegisterRequest = {
  vessel_id: string;
  shapes: string[];
  resolver_contract: ResolverContract;
  // NEW
  registered_activities?: Array<{
    template_id: string;
    template_body: ActivityTemplate;          // includes subscription clause
    ownership: "vessel_local" | "global";     // see §H
  }>;
};
```

The registration flow becomes:

1. Vessel boots. Loads its resolver implementations + activity templates
   from disk.
2. Vessel POSTs to `discovery-vessel:8100/register` with shapes,
   resolver contract, AND `registered_activities`.
3. Discovery-vessel stores resolver contracts as before AND forwards
   `registered_activities` to activity-api via the existing
   `activityTemplate_update` impulse path. Each template is upserted with
   `owner_vessel_id` set.
4. Subscription clauses on those templates are indexed by event class so
   the R3 observer can resolve subscribers in O(1) per event.
5. On vessel deregistration (graceful or TTL), templates marked
   `ownership: vessel_local` are removed from the subscriber index.
   Templates marked `ownership: global` survive deregistration (the
   vessel was the author but the template is the substrate's).

**Backward compatibility.** Vessels that omit `registered_activities`
work exactly as today — they advertise resolvers and own nothing else.

## §G — Dispatch flow

When any `lifecycle:impulse:*` event fires:

1. `ImpulseStore` calls `emitter.emit(event)`.
2. `LifecycleSubscriberVessel` receives the event, looks up subscribers
   indexed by `(event_class, shape)`, applies `state_filter` and
   `applicability_filter` per subscriber, retains only matches.
3. The matching set is passed to the development-vessel lifecycle
   observer (R3 dispatch table extension): the observer calls
   `POST /v2/activities/recommend` with `expected_output_shapes` and
   `subscriber_template_ids` constraining the Thompson sample.
4. Activity-api returns the recommendation; observer dispatches via
   the standard slot-binding → execute pipeline.
5. The execution emits its own `lifecycle:task:*` events; outcomes
   update posteriors keyed on `(template_id, event_signature)` per §E.

Multiple subscribers to the same event are handled by:
- Sorting by `priority` first (deterministic ordering).
- Thompson sampling within priority ties.
- If `must_fire` semantics are required (e.g., validators), the
  subscription clause sets `must_fire: true` and that subscriber is
  dispatched unconditionally alongside the Thompson winner.

No special path for vessel-local vs. global templates; both flow
through this dispatch.

## §H — Two layers of template ownership

The system gains two distinguishable template populations:

| Layer | Owner | Discovery presence | Trust model | Use case |
|---|---|---|---|---|
| **Global** | activity-api registry | Thompson-tracked, shared, all vessels see them | Substrate-wide trust root (identity-vessel) | Cross-cutting activities (debug-null-pointer, etc.) |
| **Vessel-local** | Registered by a vessel | Indexed in subscriber table; visible via `owner_vessel_id` | Scoped to vessel's authority | Lifecycle responsibilities for vessel-owned shapes |

Both populations flow through identical execution machinery. The
distinction matters for:

- **Trust** — a vessel-local template can only be dispatched in the
  vessel's authority context. A future H3 (signed scope attestations)
  enforces this; today it is advisory.
- **Lifecycle** — vessel-local templates are deregistered with the
  vessel. Global templates persist.
- **Accountability** — verifier_negative outcomes on vessel-local
  templates are attributed to the vessel, not the substrate at large.

The substrate's `propose-spec` flow (post-lift) can promote a
vessel-local template to global after sufficient cross-context evidence
accumulates.

## §I — Composes with existing patterns

This spec is an extension, not a replacement.

- **Idiom 4 (lifecycle hook subscription)** — same machinery; this spec
  adds the `lifecycle:impulse:*` event class to the families that
  already include `lifecycle:task:*` and `lifecycle:execution:*`.
- **Topology-discovery-loop R3 (observer dispatch)** — the R3 dispatch
  table extends with one new event class. The observer's contract is
  unchanged.
- **Finding 3 of substrate-explicit-vessels (boredom)** — that finding's
  `lifecycle:substrate:idle` is one specific event class. This spec
  generalizes the pattern. Boredom-vessel remains the emitter for
  substrate-idle; the present spec's emitters live in
  `ImpulseStore` and per-vessel watchers.
- **Phase 24 conditional posteriors** — the event_signature naturally
  becomes a posterior condition. No change to the Phase 24 mechanism.

## §J — Resolved questions

- **"Won't this flood the event bus?"** Yes for high-frequency events
  (`consumed`, `loaded`). Mitigation per §B: synchronous emit for
  low-frequency events (`created`, `unloaded`, `stale`); coalesced
  batched emit for high-frequency events. Subscribers further filter
  by shape + state_filter, so most events are dropped before dispatch.

- **"How does Thompson learn over these events?"** Posteriors are keyed
  on `(template_id, event_signature)` where event_signature canonicalizes
  the event class, shape, and state_filter. Phase 24 conditional
  posteriors already key on context tuples; this is one more dimension.

- **"What about event ordering?"** Events emit in causal order from
  their source. Multiple emitters across vessels have no global
  ordering guarantee; each vessel's emissions are causally ordered
  within that vessel. Subscribers MUST tolerate concurrent emission
  from peer vessels.

- **"What about idempotency?"** Each event carries a `(emitter_vessel_id,
  sequence_number)` pair. The R3 observer dedupes on this pair with a
  5-minute window (per the existing `lifecycle-subscriber.ts` dedupe
  mechanism). Subscribers that need stronger idempotency (e.g.,
  cache-expired-completion) include the event sequence in their own
  state.

- **"Why not put this in the existing task/execution lifecycle?"** The
  task and execution layers cover *substrate-internal* transitions. The
  impulse layer is the substrate's *interface* to its environment. The
  two are orthogonal; an external file change is not a substrate task
  completing.

## Open questions

- **Q1**: Should `lifecycle:impulse:loaded` carry the loaded content or
  just metadata? Recommendation: metadata-only; subscribers that need
  content re-fetch the impulse. Matches the "metadata-first" principle
  in foundation §124.

- **Q2**: When a vessel deregisters, what happens to in-flight
  subscriptions on its templates? Recommendation: pending dispatches
  complete; new dispatches go to the next-priority subscriber. Tracked
  as Phase 6 implementation detail.

## Cross-references

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` §61 (lifecycle
  events are `lifecycle:*`-shaped impulses), §124 (metadata-first).
- `docs/CORE_IDIOMS.md:152-185` Idiom 4 (lifecycle hook subscription).
- `openspec/changes/2026-05-23-topology-discovery-loop/specs/topology-discovery/spec.md`
  R3 (observer dispatch table this spec extends).
- `openspec/changes/2026-05-23-substrate-explicit-vessels/proposal.md`
  (vessel registration surface this spec extends).
- `openspec/changes/2026-05-23-substrate-explicit-vessels/findings/validation.md`
  Finding 3 (boredom-as-lifecycle-observer, the special case this
  generalizes) and Finding 4 (per-vessel hook breakdown for this spec).
- `repos/ias-executor-ts/src/impulses.ts` (the pool emit-hook site).
- `repos/ias-executor-ts/src/lifecycle-subscriber.ts` (the dispatch
  vessel this spec routes through).
