# Spec — Impulse Lifecycle Events

Normative requirements. Each is testable. Terminology aligns with
`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` and
`docs/CORE_IDIOMS.md` Idiom 4.

## ADDED Requirements

### Requirement: Seven event classes defined

The substrate MUST recognize the following lifecycle event classes at
the impulse layer: `lifecycle:impulse:created`, `lifecycle:impulse:loaded`,
`lifecycle:impulse:consumed`, `lifecycle:impulse:stale`,
`lifecycle:impulse:invalidated`, `lifecycle:impulse:expired`,
`lifecycle:impulse:unloaded`. Each event carries the base payload
`{ impulse_id, shape, timestamp }` plus the event-specific payload
defined in design §A.

#### Scenario: Event class is emit-validated

- **WHEN** a vessel calls `emitter.emit({ type, data })` with an event
  type starting `lifecycle:impulse:` but not in the seven-class list
- **THEN** the emitter MUST reject the emission with a typed error and
  log a `verifier_negative` self-trace.

#### Scenario: Payload shape conforms to design §A

- **WHEN** a `lifecycle:impulse:stale` event is emitted
- **THEN** the payload MUST contain `reason`, `detector_vessel_id`,
  `detected_at` fields conforming to §A.4.

---

### Requirement: Pool mutation emits events

`ImpulseStore` MUST emit `lifecycle:impulse:created` after a successful
`create()` or `put()` that introduces a new id;
`lifecycle:impulse:loaded` after an `update()` that transitions `loaded`
from `false` to `true`; `lifecycle:impulse:unloaded` after `unload()`.

#### Scenario: Created event emits after store mutation

- **WHEN** `ImpulseStore.create({ id: "imp-1", pointer, metadata })` is
  called
- **THEN** the impulse MUST be present in the store **before** the emit
  completes, so subscribers can `store.get("imp-1")` synchronously.

#### Scenario: Subscriber crash does not unwind mutation

- **WHEN** a subscriber to `lifecycle:impulse:created` throws an error
- **THEN** the store mutation MUST remain durable; the impulse is in
  the pool; the error is logged and swallowed per Idiom 4.

---

### Requirement: Stale-detection mechanisms

The substrate MUST support three independent mechanisms for emitting
`lifecycle:impulse:stale`: explicit invalidation via
`impulseStore.markStale(id, reason)`; TTL-based emission via
`expireSweep()` (interval ≤ 10s) when `pointer.staleAt` is reached;
watch-based emission from vessel-registered watchers.

#### Scenario: Explicit invalidation emits

- **WHEN** a vessel calls
  `impulseStore.markStale("imp-1", "explicit_invalidation")`
- **THEN** a `lifecycle:impulse:stale` event MUST fire with
  `reason: "explicit_invalidation"` and `detector_vessel_id` set to the
  calling vessel.

#### Scenario: TTL expiry emits

- **WHEN** an impulse with `pointer.staleAt = T` exists in the pool and
  wall-clock time reaches T
- **THEN** within ≤ 10s, a `lifecycle:impulse:expired` event MUST fire
  carrying `expired_at` and `ttl_ms`.

#### Scenario: Watch-based detection emits

- **WHEN** a vessel-registered filesystem watcher fires for a file that
  produced impulse `imp-2`
- **THEN** the vessel MUST call `markStale("imp-2", "file_modified")`
  and a `lifecycle:impulse:stale` event with
  `reason: "file_modified"` MUST fire.

---

### Requirement: Provenance-based transitive invalidation

When `markStale(X)` is called, the substrate MUST emit
`lifecycle:impulse:invalidated` for every descendant of X in the
provenance graph, bounded by max-depth 16 and rate-limited to 50
cascade-events per second from a single root.

#### Scenario: Two-hop cascade

- **GIVEN** impulse A produced via task T1 from input B; B produced via
  task T0 from input C
- **WHEN** `markStale("C", ...)` is called
- **THEN** events MUST fire: `lifecycle:impulse:stale` for C;
  `lifecycle:impulse:invalidated` for B with
  `cascade_path: ["C", "B"]`; `lifecycle:impulse:invalidated` for A
  with `cascade_path: ["C", "B", "A"]`.

#### Scenario: High-fanout cascade collapses into batched event

- **WHEN** `markStale(directoryTreeId)` triggers 200 descendant
  invalidations within 1s
- **THEN** the emitter MUST collapse to one batched
  `lifecycle:impulse:invalidated` event carrying `cascade_path` with all
  200 ids.

---

### Requirement: Subscription clause schema

Activity templates MUST accept an optional `subscription` array of
entries shaped per design §E:
`{ event, shape?, state_filter?, priority, applicability_filter?,
must_fire? }`. The clause is backward-compatible: templates without
`subscription` MUST behave exactly as today.

#### Scenario: Subscription with state_filter matches selectively

- **GIVEN** a template with
  `subscription: [{ event: "lifecycle:impulse:stale",
  shape: "fileContents", state_filter: { reason: "file_modified" } }]`
- **WHEN** a `lifecycle:impulse:stale` event fires with
  `reason: "ttl_expired"`
- **THEN** the template MUST NOT be dispatched.
- **WHEN** a `lifecycle:impulse:stale` event fires with
  `reason: "file_modified"`
- **THEN** the template MUST be a candidate for dispatch (subject to
  Thompson selection per priority).

---

### Requirement: Vessel registration extension

Discovery-vessel's `RegisterRequest` MUST accept an optional
`registered_activities` array. Each entry contains `template_id`,
`template_body`, and `ownership: "vessel_local" | "global"`.
Discovery-vessel MUST forward each entry to activity-api via the
`activityTemplate_update` impulse with `owner_vessel_id` set.

#### Scenario: Vessel-local template is removed on deregistration

- **GIVEN** vessel V registered with one `ownership: "vessel_local"`
  template T
- **WHEN** V deregisters (graceful or TTL)
- **THEN** T MUST be removed from the subscriber index. Subsequent
  events MUST NOT dispatch to T.

#### Scenario: Global template survives deregistration

- **GIVEN** vessel V registered with one `ownership: "global"` template
  T
- **WHEN** V deregisters
- **THEN** T MUST remain in the subscriber index, attributed to V as
  its original author.

#### Scenario: Backward compatibility

- **GIVEN** a vessel that POSTs `/register` without
  `registered_activities`
- **THEN** registration MUST succeed and behave identically to the
  pre-change registration.

---

### Requirement: Dispatch flow uses R3 observer

`lifecycle:impulse:*` events MUST flow through the development-vessel
lifecycle observer (per topology-discovery-loop R3) using the standard
recommend → slot-binding → execute pipeline. The observer MUST NOT be
duplicated.

#### Scenario: Observer dispatch table extends

- **WHEN** the R3 dispatch table is inspected
- **THEN** `lifecycle:impulse:*` MUST appear as a recognized event
  class with subscriber resolution by `(event_class, shape)`.

#### Scenario: Thompson selection across multiple subscribers

- **GIVEN** three templates subscribed to `lifecycle:impulse:stale`
  for shape `fileContents` with priorities 80, 80, 50
- **WHEN** the event fires
- **THEN** the two priority-80 templates MUST compete via Thompson
  sample; the priority-50 template MUST NOT dispatch this round
  unless `must_fire: true` is set.

---

### Requirement: Two-layer template ownership

The substrate MUST distinguish `ownership: "vessel_local"` templates
from `ownership: "global"` templates. Both flow through identical
execution machinery; the distinction is recorded for trust attribution,
deregistration lifecycle, and accountability.

#### Scenario: verifier_negative attribution

- **GIVEN** a vessel-local template T owned by vessel V
- **WHEN** T produces a `verifier_negative` outcome
- **THEN** the trace MUST record `attributed_vessel_id = V` so the
  learning loop can attribute outcomes per-vessel.

---

### Requirement: Tests

The implementation MUST include:
- per-event-class unit tests with payload-schema assertions;
- a provenance-cascade test verifying transitive invalidation;
- a vessel-registration test exercising the
  `registered_activities` path;
- a rate-limit test verifying batched cascade emission;
- a backward-compatibility test confirming existing subscription
  clauses (slot-binding, validator-dispatch) continue to dispatch.

#### Scenario: Test suite passes

- **WHEN** `bun test` runs in `repos/ias-executor-ts/`
- **THEN** all new lifecycle-event tests MUST pass (≥ existing
  baseline + 30 new tests).

---

### Requirement: Acceptance gates

- **G1** — `bun test` and `bun run lint` clean in ias-executor-ts and
  activity-api.
- **G2** — In-container smoke: modify a file resolved by
  `local-tools-vessel`; observe `lifecycle:impulse:stale` emit and the
  corresponding `reload-stale-file` hook execute.
- **G3** — Provenance cascade observed in-container: at least 3
  descendants emit `lifecycle:impulse:invalidated` with contiguous
  `cascade_path`.
- **G4** — Thompson learning verified: ≥ 10 hook dispatches over 30
  minutes shift posterior α/β on at least one subscribed template.
- **G5** — Vessel template lifecycle: register a vessel with
  `registered_activities`, observe template appearance in the
  subscriber index; deregister, observe vessel_local template removal.

#### Scenario: Gates green

- **WHEN** an operator runs the substrate smoke-test suite
- **THEN** all five gates MUST be observable green.
