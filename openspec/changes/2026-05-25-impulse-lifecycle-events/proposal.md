# Proposal: Impulse Lifecycle Events as the Substrate's Environment-Driven Event Class

## Why

The substrate today is internally reactive but **not environment-driven**.

Lifecycle events exist at two layers:

- **Task layer** — `lifecycle:task:preBinding`, `lifecycle:task:completed`
  (emitted from `repos/ias-executor-ts/src/activity-executor.ts` and
  `repos/minibob/src/activity.ts`).
- **Execution layer** — `lifecycle:execution:succeeded`,
  `lifecycle:execution:failed` (used by ribosome and the harness-as-lifecycle
  observer).

These two layers cover *what the substrate did to itself*. They do **not**
cover *what changed in the environment*. The interface to the environment is
the impulse layer — pointers refer out to filesystem state, peer API state,
LLM cache state, time-bound resources. When that environment changes, the
substrate has no notice. Pool mutations happen silently: an impulse is
created, loaded, consumed, expired, or invalidated, and no event fires.

This is the structural gap. `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
§61 declares that lifecycle events ARE impulses of shape `lifecycle:*`, and
the four-primitive minimum admits any number of lifecycle event classes. The
substrate already has the dispatch machinery (`lifecycle-subscriber.ts`,
Idiom 4 in `docs/CORE_IDIOMS.md:152-185`, R3 observer dispatch in
`openspec/changes/2026-05-23-topology-discovery-loop/specs/topology-discovery/spec.md:62-84`).
What is missing is the **event class at the impulse layer** and the
mechanism that **emits** it on pool mutation.

Finding 3 of `2026-05-23-substrate-explicit-vessels` (boredom-as-lifecycle-observer)
already proposed `lifecycle:substrate:idle` and showed how Thompson learning
collapses when the dispatch path bypasses subscription. That finding is a
**special case** of the more general pattern this spec defines: any change
to the substrate's environment that the substrate ought to react to
(stale file, expired session, peer-vessel update, time-based decay) should
fire as a lifecycle impulse, route through the subscription machinery, and
update posteriors normally.

## What changes

This change introduces:

1. **Seven impulse lifecycle event classes** —
   `lifecycle:impulse:created`, `loaded`, `consumed`, `stale`, `invalidated`,
   `expired`, `unloaded`. Each carries the impulse id and shape plus
   event-specific payload fields (see §A of design.md).

2. **A pool-mutation-emit hook in `repos/ias-executor-ts/src/impulses.ts`** —
   atomic synchronous emission for created/loaded/consumed/unloaded;
   coalesced async emission for high-frequency cases. The emit path goes
   through the host's `LifecycleSubscriberVessel`.

3. **Three stale-detection mechanisms** — explicit invalidation
   (`impulseStore.markStale(id, reason)`), TTL-based decay
   (`pointer.staleAt`), and watch-based detection (vessel-registered
   filesystem watchers, WebSocket peers, time-tick observers).

4. **A provenance-graph query and transitive invalidation chain** — each
   impulse carries `producer_chain` from trace metadata. When an impulse is
   marked stale or invalidated, downstream impulses produced from it emit
   `lifecycle:impulse:invalidated` cascading through the chain.

5. **A `subscription` clause on activity templates** — extends the existing
   slot-binding / validator-dispatch / boredom-eligible subscription form
   to include `event` (any `lifecycle:*` class), optional `shape`,
   `state_filter`, `priority`, and `applicability_filter`.

6. **An extension of vessel registration with `registered_activities`** —
   discovery-vessel's registration payload accepts an array of activity
   templates the vessel owns alongside its resolver contracts. A vessel
   that owns shape X also owns the lifecycle responsibilities for X.

7. **Dispatch flow integration with the existing R3 observer** — the
   `lifecycle:impulse:*` event class becomes another entry in the
   development-vessel lifecycle observer's dispatch table; the
   filter/recommend/slot-bind/execute pipeline is reused without
   modification.

## Vessel-registered hooks (the architectural shift)

A vessel today is a collection of resolvers advertised through discovery.
A vessel after this change is a **bundle of three things**:

- **Shapes + resolver contracts** (existing) — what the vessel can produce.
- **Activity templates** (NEW) — what the vessel does in response to events
  on the shapes it owns.
- **Event subscriptions** (NEW) — which lifecycle events those templates
  attach to.

The shift is from "vessels = resolvers" to "vessels = resolvers + the
lifecycle responsibilities for the shapes they own". A file-vessel that
advertises `fileContents` also ships a `reload-stale-file` activity
subscribed to `lifecycle:impulse:stale` for that shape. An identity-vessel
that advertises `session` also ships a `refresh-session` activity subscribed
to `lifecycle:impulse:expired`. The substrate gains environmental reactivity
without any central coordinator — each vessel handles its own shape's
lifecycle.

This composes cleanly with the substrate-explicit-vessels work: the six
explicit vessels named in that change each gain their owned activity
templates and subscriptions as part of their package. Finding 4 of that
spec's validation document spells this out per vessel.

## Self-application

The spec is itself substrate-extensible. Post-lift, the substrate can author
new vessel hook activities via `make-activity` / `propose-spec`: a new
`lifecycle:impulse:*` subscriber is just an activity template with a
subscription clause, and the recommend-pipeline will sample over the
expanding subscriber set automatically. No central registry edit required.

Per-vessel ownership means a new vessel introduces its own lifecycle
responsibilities at registration time, without touching the substrate core.
This is the same self-extensibility property that activity templates and
shapes already have, extended to environmental reactivity.

## Dependencies

- `2026-05-23-substrate-explicit-vessels` — provides `VesselDaemon` and the
  per-vessel registration surface this spec extends. The
  `registered_activities` payload extension lives on the discovery-client
  shipped by that change's Phase 0 toolkit.
- `2026-05-23-topology-discovery-loop` R3 — the observer-dispatch table
  this spec extends with the `lifecycle:impulse:*` event class.
- `docs/CORE_IDIOMS.md` Idiom 4 — the existing pattern this spec extends.
  No new primitive is introduced.

## Phase 27 binding

Informational, not a new gate. The IAL `2026-04-26-impulse-activity-loop`
Phase 27 lift criterion requires the substrate to sustain its own
topology-discovery loop without external developer input. Environmental
reactivity is part of that sustenance — a substrate that cannot notice file
changes, session expiries, or peer-vessel updates cannot adapt its own
behaviour autonomously. Closing this gap strengthens the lift readiness
position but does not gate it; the existing R8 gates of
topology-discovery-loop and the 27.3.c gates of substrate-explicit-vessels
remain authoritative.

## Out of scope

- **Cross-substrate event federation** — events emitted on substrate A do
  not propagate to substrate B in this spec. That is the vessel-federation
  (`2026-05-23-vessel-federation`) territory and depends on
  zk-trace-attestations.
- **Removing existing inline pool-mutation logging** — pool operations
  today carry no event surface; nothing inline is removed because nothing
  inline exists. This spec adds emission to existing mutation sites.
- **Reworking the existing task / execution lifecycle events** — those
  remain unchanged. This spec adds a third layer; it does not refactor the
  prior two.
