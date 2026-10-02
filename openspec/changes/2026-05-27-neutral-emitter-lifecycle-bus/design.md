# Design — neutral-emitter lifecycle bus

## Architectural anchor

Activity-api's WebSocket broadcaster (`repos/metabob-activity-api/src/websocket/broadcaster.ts`) is already a neutral, multi-consumer event bus. The handshake protocol (`{type:"authenticate", token}` then optional `{type:"catchup", lastSeenSequence}`) plus the `emit / emitToSession / emitToOrg` surface form a working pattern that concept-db (`ExecutionObserver`), workbench (overlay), and the activity-monitor vessel already subscribe to.

The architectural defect is NOT a missing bus. It's that lifecycle events from `ias-executor-ts` and registration events from `discovery-vessel` never reach the bus. Once they do, every existing subscriber gets them for free.

This framing keeps the change small. We're not building infrastructure; we're connecting two pipes to existing infrastructure.

## Why publish via HTTP, not direct WS-from-emitter

Two options for getting events from a vessel into the broadcaster:

**A. Each vessel opens a WS client to activity-api and pushes through it.**
- Pros: one connection model substrate-wide.
- Cons: each emitter must maintain reconnection state, handshake, auth. Lifecycle events fire from synchronous code paths (engine.ts:96, registry.ts mutations) — converting those to async-WS-aware is invasive. Connection-failure during a critical lifecycle path could silently swallow events.

**B. Each vessel POSTs to `/v2/events/publish`; activity-api's WS broadcaster fans out to subscribers.**
- Pros: emit becomes a fire-and-forget HTTP call. Reconnection-state lives in subscribers, where it belongs. Existing API-key auth covers the publish surface. Existing failure-mode (HTTP timeout) is well-understood.
- Cons: one extra HTTP hop per event. Latency typically <5ms intra-container; not material for lifecycle events.

Choose B. The pipe-asymmetry (publish-via-HTTP, subscribe-via-WS) mirrors how trace storage already works (`POST /v2/activities/execution-traces` to publish, query endpoints to read). It is consistent with the rest of the substrate.

## Event taxonomy

A minimal vocabulary covering the trapped events plus an open extension path:

```
lifecycle.task.pre_binding         (from ias-executor-ts engine.ts)
lifecycle.task.completed           (from ias-executor-ts engine.ts — distinct from task.completed which is the activity-api trace-level event)
lifecycle.execution.succeeded      (from ias-executor-ts engine.ts)
lifecycle.execution.failed         (from ias-executor-ts engine.ts)
lifecycle.gap.classified           (from ias-executor-ts engine.ts)
lifecycle.llm.dispatched           (from ias-executor-ts llm-prompt.ts)

vessel.registered                  (from discovery-vessel on register)
vessel.heartbeat                   (from discovery-vessel on heartbeat)
vessel.deregistered                (from discovery-vessel on explicit deregister)
vessel.expired                     (from discovery-vessel on TTL expiry)
```

Event payload shape:
```
{
  type: "lifecycle.task.pre_binding" | ...,
  timestamp: number,        // ms epoch
  source_vessel_id: string, // who emitted
  data: { ... }             // type-specific
}
```

The activity-api broadcaster wraps this into its WS-message envelope. Existing `task.*` / `tool.call` / `impulse.resolved` types are preserved verbatim — this change adds NEW types, doesn't modify existing ones.

## Goal-host reactive proxy registration

Current (broken):
```typescript
// goal-host-vessel startup:
const r = await fetch(`${DEV_VESSEL_ENDPOINT}/shapes`);
if (!r.ok) console.warn("...not registered"); return;  // ← F-129 lands here
for (const shape of shapes) host.registerProxy(shape);
```

After:
```typescript
// goal-host-vessel startup:
await tryRegisterProxiesFromDevVessel();  // initial attempt, may register zero
const wsClient = new WSClient(activityApi);
wsClient.on("vessel.registered", (evt) => {
  if (evt.data.vessel_id === DEV_VESSEL_ID) {
    tryRegisterProxiesFromDevVessel();  // re-fetch /shapes, register any new
  }
});
```

Registration becomes *eventually consistent*. The race goes away: even if goal-host starts before dev-vessel, the registration fires when dev-vessel comes up.

Idempotency: `registerProxy(shape)` is already idempotent (re-registering an existing resolver replaces it). No new bookkeeping needed.

`vessel.expired` handling is optional and conservative — leave proxies registered even when a vessel expires. Stale proxies fail at call time with a clear error rather than silently disappearing. Operator can prune by restarting goal-host.

## Trade-offs

**Event loss is acceptable for lifecycle events.** They are observability/reactivity signals, not durable records. Traces continue to flow through the trace-storage endpoint (`POST /v2/activities/execution-traces`) which has retry + persistence semantics. If a lifecycle event drops, the trace remains; subscribers can backfill from the trace store. This means `/v2/events/publish` failures (HTTP timeout, broadcaster unavailable) are logged but never throw or block the emitter's main work.

**Per-org / per-account scoping is preserved.** The existing `emitToOrg` + `emitToSession` surface remains. The `/v2/events/publish` endpoint accepts an optional `scope` field to choose `emit` / `emitToOrg` / `emitToSession`. Default is `emit` (broadcast to all clients) for substrate-internal lifecycle events; vessel-registration events default to broadcast since topology is substrate-public.

**No replay log.** WS clients can use the existing `catchup` protocol for trace events. Lifecycle/registration events are not retained — a subscriber that reconnects sees only events after re-handshake. For consumers that need durability (e.g. concept-db re-deriving usage on restart), the canonical persistence is the trace store; the bus is a hot reactivity channel.

## Risks and mitigations

- **Risk**: `/v2/events/publish` becomes a hot path; broadcaster fan-out saturates.
  **Mitigation**: existing broadcaster handles `task.completed` at much higher volume already; the addition is proportionally small. Lifecycle events fire at task granularity (a few per execution), not per-token.

- **Risk**: subscriber misses an event during reconnection and gets stuck.
  **Mitigation**: subscribers should re-derive critical state from the trace store on reconnect (concept-db already does this). The bus is "wake me up when X happens", not "tell me everything that has ever happened."

- **Risk**: WS-client code in goal-host adds reconnection complexity.
  **Mitigation**: copy the existing concept-db `ExecutionObserver` pattern verbatim (exponential backoff 1s → 30s, swallow-and-log on handler errors). Proven.

- **Risk**: a vessel publishes events that other vessels misinterpret because the event taxonomy is open-ended.
  **Mitigation**: this change defines the canonical type names. New event types added by other vessels must follow the `<source>.<noun>.<verb>` pattern documented in the spec. Subscribers ignore event types they don't recognize.

## Out of scope (deliberately)

- **Migrating concept-db's internal EventEmitter onto the bus.** Iter008 #3. Concept-db's internal `concept:created` / `edge:created` events have legitimate use cases for external subscribers (audit-vessel, future analyzers). But the migration is independent of the lifecycle-bridge work — it requires concept-db to call `/v2/events/publish` from `dispatcher.ts:34-97`. Filed as future work; recommended path is to copy this spec's pattern verbatim once it's proven on the lifecycle path.

- **Backpressure / dropping policy.** Today the broadcaster has no per-subscriber backpressure (a slow consumer can balloon memory). This change does not address it; it's a substrate-wide concern that should be specced separately if it becomes a problem.

- **Event-typed schemas / strict validation.** The publish endpoint accepts `{ type: string, payload: unknown }`. Type-level enforcement is a future iteration; consumers validate on receipt today.

## Open questions

1. Should `lifecycle.execution.succeeded` carry the full `ExecutionTrace` payload, or just an id + summary? **Decision**: id + summary (template_id, parent_execution_id, status, duration_ms). Subscribers needing full trace fetch from `/v2/activities/execution-traces/:id`. Keeps WS message size bounded.

2. Should the publish endpoint be auth-gated by API key only, or also require a known `source_vessel_id`?  **Decision**: API key only for v1. Source vessel id is informational, not authoritative. If spoofing becomes a concern, switch to per-vessel API keys.

3. Goal-host reactive registration on `vessel.registered`: should we use a debounce window? **Decision**: yes, 500ms debounce — multiple registers in quick succession (e.g. dev-vessel restarts) coalesce into one re-fetch. Implementation: standard `setTimeout` + cancel.
